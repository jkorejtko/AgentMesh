import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QueueStorage } from './queue-storage.js';

describe('QueueStorage initialization', () => {
  it('creates runtime files from the queue template', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agentmesh-'));
    const runtimeDir = join(rootDir, '.agentmesh');
    const templatePath = join(rootDir, 'queue-template.json');

    const template = {
      schemaVersion: 1,
      queueId: 'default',
      name: 'Test queue',
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

    await writeFile(templatePath, JSON.stringify(template));

    try {
      const storage = new QueueStorage(runtimeDir);

      await storage.initialize(templatePath);

      const queue = await storage.loadQueue();
      const state = await storage.loadState();
      const journal = JSON.parse(await readFile(join(runtimeDir, 'journal.json'), 'utf8'));

      assert.equal(queue.name, 'Test queue');
      assert.equal(state.queueId, 'default');
      assert.equal(state.status, 'idle');
      assert.equal(journal.transaction, null);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it('preserves existing runtime data on repeated initialization', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agentmesh-'));
    const runtimeDir = join(rootDir, '.agentmesh');
    const templatePath = join(rootDir, 'queue-template.json');

    const template = {
      schemaVersion: 1,
      queueId: 'default',
      name: 'Template queue',
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

    await writeFile(templatePath, JSON.stringify(template));

    try {
      const storage = new QueueStorage(runtimeDir);

      await storage.initialize(templatePath);

      const existingQueue = await storage.loadQueue();
      existingQueue.name = 'My customized queue';

      await storage.saveSnapshot(existingQueue, await storage.loadState());

      await storage.initialize(templatePath);

      const queue = await storage.loadQueue();

      assert.equal(queue.name, 'My customized queue');
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects an invalid existing queue instead of overwriting it', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'agentmesh-'));
    const runtimeDir = join(rootDir, '.agentmesh');
    const templatePath = join(rootDir, 'queue-template.json');

    const template = {
      schemaVersion: 1,
      queueId: 'default',
      name: 'Template queue',
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

    await writeFile(templatePath, JSON.stringify(template));

    try {
      const storage = new QueueStorage(runtimeDir);

      await storage.initialize(templatePath);

      const invalidQueue = '{ invalid json';
      await writeFile(join(runtimeDir, 'queue.json'), invalidQueue);

      await assert.rejects(storage.initialize(templatePath));

      assert.equal(await readFile(join(runtimeDir, 'queue.json'), 'utf8'), invalidQueue);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
