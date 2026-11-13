import { randomUUID } from 'node:crypto';

import type { Queue, QueueState, TaskDefinition, TaskRuntime, TaskStatus } from './schemas.js';

import { assertTransition } from './task-lifecycle.js';
import { QueueStorage } from '../storage/queue-storage.js';

export interface DelegationResult {
  taskIdExternal: string;
  childThreadId: string;
  childRunId: string;
  providerInstanceId: string;
  model: string | null;
}

export class TaskManager {
  constructor(private readonly storage: QueueStorage) {}

  async initialize(): Promise<void> {
    await this.storage.runExclusive(async () => {
      // Recovery must happen before reading queue or state.
      await this.storage.recover();

      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      for (const task of queue.tasks) {
        if (!state.tasks[task.id]) {
          state.tasks[task.id] = this.createRuntime();
        }
      }

      this.recalculateStats(queue, state);
      await this.storage.saveSnapshot(queue, state);
    });
  }

  async addTask(input: Omit<TaskDefinition, 'id'> & { id?: string }): Promise<TaskDefinition> {
    return this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      const task: TaskDefinition = {
        ...input,
        id: input.id ?? randomUUID(),
      };

      if (queue.tasks.some((item) => item.id === task.id)) {
        throw new Error(`Task already exists: ${task.id}`);
      }

      for (const dependency of task.dependencies) {
        if (dependency === task.id) {
          throw new Error('Task cannot depend on itself');
        }

        if (!queue.tasks.some((item) => item.id === dependency)) {
          throw new Error(`Unknown dependency: ${dependency}`);
        }
      }

      queue.tasks.push(task);
      state.tasks[task.id] = this.createRuntime();

      this.recalculateStats(queue, state);

      await this.storage.saveSnapshot(queue, state);

      return task;
    });
  }

  async getReadyTasks(): Promise<TaskDefinition[]> {
    return this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      return queue.tasks.filter((task) => {
        const runtime = state.tasks[task.id];

        if (!runtime || runtime.status !== 'ready') {
          return false;
        }

        return task.dependencies.every(
          (dependency) => state.tasks[dependency]?.status === 'completed',
        );
      });
    });
  }

  async prepareDelegation(taskId: string, parentThreadId: string): Promise<string> {
    if (!parentThreadId.trim()) {
      throw new Error('Parent thread ID is required');
    }

    return this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      const runtime = state.tasks[taskId];

      if (!runtime) {
        throw new Error(`Unknown task: ${taskId}`);
      }

      if (runtime.status !== 'ready') {
        throw new Error(`Task must be ready before delegation: ${taskId}`);
      }

      const attempt = runtime.attempts + 1;
      const clientRequestId = randomUUID();

      state.tasks[taskId] = {
        ...runtime,
        status: 'delegating',
        attempts: attempt,
        agent: {
          taskId,
          taskIdExternal: null,
          clientRequestId,
          childThreadId: null,
          childRunId: null,
          parentThreadId,
          providerInstanceId: null,
          model: null,
          attempt,
          delegatedAt: new Date().toISOString(),
        },
      };

      this.recalculateStats(queue, state);
      await this.storage.saveSnapshot(queue, state);

      return clientRequestId;
    });
  }

  async completeDelegation(
    taskId: string,
    clientRequestId: string,
    result: DelegationResult,
  ): Promise<void> {
    await this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      const runtime = state.tasks[taskId];

      if (!runtime) {
        throw new Error(`Unknown task: ${taskId}`);
      }

      if (runtime.status !== 'delegating' || !runtime.agent) {
        throw new Error(`Task is not awaiting delegation: ${taskId}`);
      }

      if (runtime.agent.clientRequestId !== clientRequestId) {
        throw new Error(`Delegation request mismatch: ${taskId}`);
      }

      const requiredFields = [
        result.taskIdExternal,
        result.childThreadId,
        result.childRunId,
        result.providerInstanceId,
      ];

      if (requiredFields.some((value) => !value.trim())) {
        throw new Error(`Invalid delegation result: missing required metadata`);
      }

      state.tasks[taskId] = {
        ...runtime,
        status: 'running',
        agent: {
          ...runtime.agent,
          taskIdExternal: result.taskIdExternal,
          childThreadId: result.childThreadId,
          childRunId: result.childRunId,
          providerInstanceId: result.providerInstanceId,
          model: result.model,
        },
        startedAt: new Date().toISOString(),
      };

      this.recalculateStats(queue, state);
      await this.storage.saveSnapshot(queue, state);
    });
  }

  async transitionTask(
    taskId: string,
    nextStatus: TaskStatus,
    patch: Partial<TaskRuntime> = {},
  ): Promise<void> {
    await this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      const runtime = state.tasks[taskId];

      if (!runtime) {
        throw new Error(`Unknown task: ${taskId}`);
      }

      assertTransition(runtime.status, nextStatus);

      let updatedRuntime: TaskRuntime = {
        ...runtime,
        ...patch,
        status: nextStatus,
      };

      state.tasks[taskId] = updatedRuntime;

      this.recalculateStats(queue, state);
      await this.storage.saveSnapshot(queue, state);
    });
  }

  async refreshReadyTasks(): Promise<void> {
    await this.storage.runExclusive(async () => {
      const queue = await this.storage.loadQueue();
      const state = await this.storage.loadState();

      let hasChanges = true;

      while (hasChanges) {
        hasChanges = false;

        for (const task of queue.tasks) {
          const runtime = state.tasks[task.id];

          if (!runtime || runtime.status !== 'pending') {
            continue;
          }

          const dependencyStatuses = task.dependencies.map(
            (dependency) => state.tasks[dependency]?.status,
          );

          const hasFailedDependency = dependencyStatuses.some(
            (status) => status === 'failed' || status === 'blocked' || status === 'cancelled',
          );

          if (hasFailedDependency) {
            assertTransition(runtime.status, 'blocked');

            state.tasks[task.id] = {
              ...runtime,
              status: 'blocked',
            };

            hasChanges = true;
            continue;
          }

          const dependenciesCompleted = dependencyStatuses.every(
            (status) => status === 'completed',
          );

          if (dependenciesCompleted) {
            assertTransition(runtime.status, 'ready');

            state.tasks[task.id] = {
              ...runtime,
              status: 'ready',
            };

            hasChanges = true;
          }
        }
      }

      this.recalculateStats(queue, state);
      await this.storage.saveSnapshot(queue, state);
    });
  }

  private createRuntime(): TaskRuntime {
    return {
      status: 'pending',
      attempts: 0,
      agent: null,
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };
  }

  private recalculateStats(queue: Queue, state: QueueState): void {
    const runtimes = Object.values(state.tasks);

    state.stats = {
      total: queue.tasks.length,
      pending: runtimes.filter((task) => task.status === 'pending').length,
      ready: runtimes.filter((task) => task.status === 'ready').length,
      delegating: runtimes.filter((task) => task.status === 'delegating').length,
      running: runtimes.filter((task) => task.status === 'running').length,
      awaitingApproval: runtimes.filter((task) => task.status === 'awaiting_approval').length,
      completed: runtimes.filter((task) => task.status === 'completed').length,
      failed: runtimes.filter((task) => task.status === 'failed').length,
      blocked: runtimes.filter((task) => task.status === 'blocked').length,
      skipped: runtimes.filter((task) => task.status === 'skipped').length,
      cancelled: runtimes.filter((task) => task.status === 'cancelled').length,
    };

    state.updatedAt = new Date().toISOString();
  }
}
