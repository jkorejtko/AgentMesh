import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { QueueStorage } from '../storage/queue-storage.js';
import { TaskManager } from './task-manager.js';

async function createManager() {
  const root = await mkdtemp(join(tmpdir(), 'agent-workflows-'));

  const queue = {
    schemaVersion: 1,
    queueId: 'default',
    name: 'Test Queue',
    description: 'Test',
    config: {
      maxConcurrency: 3,
      maxAttempts: 3,
      retryDelaySeconds: 30,
      stopOnFailure: false,
      requireApprovalForCodeChanges: true,
    },
    tasks: [],
  };

  const state = {
    schemaVersion: 1,
    queueId: 'default',
    status: 'idle',
    activeRunId: null,
    createdAt: null,
    updatedAt: null,
    tasks: {},
    activeAgents: [],
    stats: {
      total: 0,
      pending: 0,
      ready: 0,
      delegating: 0,
      running: 0,
      awaitingApproval: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
      cancelled: 0,
    },
  };

  await writeFile(join(root, 'queue.json'), JSON.stringify(queue, null, 2));
  await writeFile(join(root, 'state.json'), JSON.stringify(state, null, 2));

  const storage = new QueueStorage(root);

  return {
    root,
    storage,
    manager: new TaskManager(storage),
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

function createTask(id: string, dependencies: string[] = []) {
  return {
    id,
    title: `Task ${id}`,
    description: 'Test task',
    type: 'analysis' as const,
    priority: 2,
    dependencies,
    preferredAgent: 'auto',
    requiredSkills: [],
    approvalRequired: false,
    acceptanceCriteria: [],
    context: {
      projectPath: null,
      files: [],
      notes: null,
    },
  };
}

describe('TaskManager', () => {
  it('adds a task and initializes its runtime state', async () => {
    const ctx = await createManager();

    try {
      const task = await ctx.manager.addTask(createTask('task-001'));

      const queue = await ctx.storage.loadQueue();
      const state = await ctx.storage.loadState();

      assert.equal(queue.tasks.length, 1);
      assert.equal(task.id, 'task-001');
      assert.equal(state.tasks['task-001']?.status, 'pending');
      assert.equal(state.stats.total, 1);
    } finally {
      await ctx.cleanup();
    }
  });

  it('makes a task without dependencies ready', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const readyTasks = await ctx.manager.getReadyTasks();

      assert.equal(readyTasks.length, 1);
      assert.equal(readyTasks[0]?.id, 'task-001');
    } finally {
      await ctx.cleanup();
    }
  });

  it('waits for dependencies to complete', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.addTask(createTask('task-002', ['task-001']));

      await ctx.manager.refreshReadyTasks();

      let readyTasks = await ctx.manager.getReadyTasks();

      assert.equal(readyTasks.length, 1);
      assert.equal(readyTasks[0]?.id, 'task-001');

      const clientRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      await ctx.manager.completeDelegation('task-001', clientRequestId, {
        taskIdExternal: 't3-task-001',
        childThreadId: 'thread-001',
        childRunId: 'run-001',
        providerInstanceId: 'codex',
        model: 'gpt-6',
      });

      await ctx.manager.transitionTask('task-001', 'completed');

      await ctx.manager.refreshReadyTasks();

      readyTasks = await ctx.manager.getReadyTasks();

      assert.equal(readyTasks.length, 1);
      assert.equal(readyTasks[0]?.id, 'task-002');
    } finally {
      await ctx.cleanup();
    }
  });

  it('persists agent metadata when delegating a task', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const clientRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      assert.equal(runtime?.status, 'delegating');
      assert.equal(runtime?.attempts, 1);

      assert.ok(runtime?.agent);
      assert.equal(runtime.agent.taskId, 'task-001');
      assert.equal(runtime.agent.clientRequestId, clientRequestId);
      assert.equal(runtime.agent.parentThreadId, 'parent-001');
      assert.equal(runtime.agent.attempt, 1);
      assert.ok(runtime.agent.delegatedAt);

      assert.equal(runtime.agent.taskIdExternal, null);
      assert.equal(runtime.agent.childThreadId, null);
    } finally {
      await ctx.cleanup();
    }
  });

  it('completes delegation and stores external agent metadata', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const clientRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      await ctx.manager.completeDelegation('task-001', clientRequestId, {
        taskIdExternal: 't3-task-001',
        childThreadId: 'thread-001',
        childRunId: 'run-001',
        providerInstanceId: 'codex',
        model: 'gpt-6',
      });

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      assert.equal(runtime?.status, 'running');
      assert.ok(runtime?.startedAt);

      assert.equal(runtime?.agent?.taskIdExternal, 't3-task-001');
      assert.equal(runtime?.agent?.childThreadId, 'thread-001');
      assert.equal(runtime?.agent?.childRunId, 'run-001');
      assert.equal(runtime?.agent?.parentThreadId, 'parent-001');
      assert.equal(runtime?.agent?.providerInstanceId, 'codex');
      assert.equal(runtime?.agent?.model, 'gpt-6');
    } finally {
      await ctx.cleanup();
    }
  });

  it('rejects a delegation result from an outdated request', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const oldRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      await ctx.manager.transitionTask('task-001', 'pending');
      await ctx.manager.refreshReadyTasks();

      const newRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      assert.notEqual(oldRequestId, newRequestId);

      await assert.rejects(
        ctx.manager.completeDelegation('task-001', oldRequestId, {
          taskIdExternal: 'old-task',
          childThreadId: 'old-thread',
          childRunId: 'old-run',
          providerInstanceId: 'codex',
          model: 'gpt-6',
        }),
        /Delegation request mismatch/,
      );

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      assert.equal(runtime?.status, 'delegating');
      assert.equal(runtime?.agent?.clientRequestId, newRequestId);
      assert.equal(runtime?.agent?.parentThreadId, 'parent-001');
      assert.equal(runtime?.agent?.taskIdExternal, null);
    } finally {
      await ctx.cleanup();
    }
  });

  it('preserves delegating task metadata after restart', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const clientRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      // Simulujeme restart vytvořením nové instance TaskManageru.
      const restartedManager = new TaskManager(ctx.storage);

      await restartedManager.initialize();

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      assert.equal(runtime?.status, 'delegating');
      assert.equal(runtime?.attempts, 1);

      assert.ok(runtime?.agent);
      assert.equal(runtime.agent.taskId, 'task-001');
      assert.equal(runtime.agent.clientRequestId, clientRequestId);
      assert.equal(runtime.agent.parentThreadId, 'parent-001');
      assert.equal(runtime.agent.attempt, 1);
      assert.ok(runtime.agent.delegatedAt);
    } finally {
      await ctx.cleanup();
    }
  });

  it('rejects an unknown dependency', async () => {
    const ctx = await createManager();

    try {
      await assert.rejects(
        () => ctx.manager.addTask(createTask('task-001', ['missing-task'])),
        /Unknown dependency/,
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('preserves tasks when adding them concurrently', async () => {
    const ctx = await createManager();

    try {
      await Promise.all([
        ctx.manager.addTask(createTask('task-001')),
        ctx.manager.addTask(createTask('task-002')),
      ]);

      const queue = await ctx.storage.loadQueue();
      const state = await ctx.storage.loadState();

      assert.equal(queue.tasks.length, 2);
      assert.ok(queue.tasks.some((task) => task.id === 'task-001'));
      assert.ok(queue.tasks.some((task) => task.id === 'task-002'));

      assert.ok(state.tasks['task-001']);
      assert.ok(state.tasks['task-002']);
      assert.equal(state.stats.total, 2);
    } finally {
      await ctx.cleanup();
    }
  });

  it('blocks dependent tasks when a dependency fails', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.addTask(createTask('task-002', ['task-001']));
      await ctx.manager.addTask(createTask('task-003', ['task-002']));

      await ctx.manager.refreshReadyTasks();

      await ctx.manager.prepareDelegation('task-001', 'parent-001');

      await ctx.manager.transitionTask('task-001', 'failed');

      await ctx.manager.refreshReadyTasks();

      const state = await ctx.storage.loadState();

      assert.equal(state.tasks['task-001']?.status, 'failed');
      assert.equal(state.tasks['task-002']?.status, 'blocked');
      assert.equal(state.tasks['task-003']?.status, 'blocked');
    } finally {
      await ctx.cleanup();
    }
  });

  it('rejects delegation result with empty external metadata', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      const clientRequestId = await ctx.manager.prepareDelegation('task-001', 'parent-001');

      await assert.rejects(
        ctx.manager.completeDelegation('task-001', clientRequestId, {
          taskIdExternal: '',
          childThreadId: 'thread-001',
          childRunId: 'run-001',
          providerInstanceId: 'codex',
          model: 'gpt-6',
        }),
        /Invalid delegation result/,
      );

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      // Neplatná odpověď nesmí změnit stav ani metadata.
      assert.equal(runtime?.status, 'delegating');
      assert.equal(runtime?.agent?.clientRequestId, clientRequestId);
      assert.equal(runtime?.agent?.taskIdExternal, null);
    } finally {
      await ctx.cleanup();
    }
  });

  it('rejects delegation without parent thread ID', async () => {
    const ctx = await createManager();

    try {
      await ctx.manager.addTask(createTask('task-001'));
      await ctx.manager.refreshReadyTasks();

      await assert.rejects(
        ctx.manager.prepareDelegation('task-001', ''),
        /Parent thread ID is required/,
      );

      const state = await ctx.storage.loadState();
      const runtime = state.tasks['task-001'];

      assert.equal(runtime?.status, 'ready');
      assert.equal(runtime?.attempts, 0);
      assert.equal(runtime?.agent, null);
    } finally {
      await ctx.cleanup();
    }
  });
});
