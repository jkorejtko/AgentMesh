import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TransactionManager } from './transaction-manager.js';
import { TransactionJournalSchema } from './transaction-schema.js';

describe('TransactionManager', () => {
  let rootDir: string;
  let manager: TransactionManager;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'agent-workflows-'));
    manager = new TransactionManager(rootDir);
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('commits queue and state and clears the journal', async () => {
    const queue = {
      schemaVersion: 1 as const,
      queueId: 'default',
      name: 'Test queue',
      description: 'Test transaction',
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
      schemaVersion: 1 as const,
      queueId: 'default',
      status: 'idle' as const,
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

    await manager.commit(queue, state);

    const savedQueue = JSON.parse(await readFile(join(rootDir, 'queue.json'), 'utf8'));

    const savedState = JSON.parse(await readFile(join(rootDir, 'state.json'), 'utf8'));

    const journal = JSON.parse(await readFile(join(rootDir, 'journal.json'), 'utf8'));

    assert.equal(savedQueue.name, 'Test queue');
    assert.equal(savedState.queueId, 'default');
    assert.equal(journal.transaction, null);
  });

  it('recovers an interrupted transaction', async () => {
    const queue = {
      schemaVersion: 1 as const,
      queueId: 'default',
      name: 'Recovered queue',
      description: 'Recovered transaction',
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
      schemaVersion: 1 as const,
      queueId: 'default',
      status: 'idle' as const,
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

    const transaction = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      status: 'prepared' as const,
      createdAt: new Date().toISOString(),
      queue,
      state,
    };

    await writeFile(
      join(rootDir, 'journal.json'),
      JSON.stringify({
        schemaVersion: 1,
        transaction,
      }),
    );

    await writeFile(join(rootDir, 'queue.json'), JSON.stringify({ name: 'Old queue' }));

    await writeFile(join(rootDir, 'state.json'), JSON.stringify({ status: 'old' }));

    const recovered = await manager.recover();

    const savedQueue = JSON.parse(await readFile(join(rootDir, 'queue.json'), 'utf8'));

    const savedState = JSON.parse(await readFile(join(rootDir, 'state.json'), 'utf8'));

    const journal = TransactionJournalSchema.parse(
      JSON.parse(await readFile(join(rootDir, 'journal.json'), 'utf8')),
    );

    assert.equal(recovered, true);
    assert.equal(savedQueue.name, 'Recovered queue');
    assert.equal(savedState.queueId, 'default');
    assert.equal(journal.transaction, null);
  });
});
