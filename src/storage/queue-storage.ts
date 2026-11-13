import { constants } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { QueueSchema, QueueStateSchema, type Queue, type QueueState } from '../core/schemas.js';

import { AsyncMutex } from './async-mutex.js';
import { readJson } from './json-store.js';
import { TransactionManager } from './transaction-manager.js';

export class QueueStorage {
  private readonly queuePath: string;
  private readonly statePath: string;
  private readonly journalPath: string;
  private readonly transactions: TransactionManager;
  private readonly mutex = new AsyncMutex();

  constructor(rootDir: string) {
    this.queuePath = resolve(rootDir, 'queue.json');
    this.statePath = resolve(rootDir, 'state.json');
    this.journalPath = resolve(rootDir, 'journal.json');
    this.transactions = new TransactionManager(rootDir);
  }

  async initialize(templatePath: string): Promise<void> {
    await mkdir(resolve(this.queuePath, '..'), { recursive: true });

    try {
      await copyFile(templatePath, this.queuePath, constants.COPYFILE_EXCL);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    const queue = await readJson(this.queuePath, QueueSchema);

    const initialState: QueueState = {
      schemaVersion: 1,
      queueId: queue.queueId,
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

    try {
      await writeFile(this.statePath, JSON.stringify(initialState, null, 2), { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    try {
      await writeFile(
        this.journalPath,
        JSON.stringify({ schemaVersion: 1, transaction: null }, null, 2),
        { flag: 'wx' },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    await readJson(this.statePath, QueueStateSchema);
  }

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(operation);
  }

  async loadQueue(): Promise<Queue> {
    return readJson(this.queuePath, QueueSchema);
  }

  async loadState(): Promise<QueueState> {
    return readJson(this.statePath, QueueStateSchema);
  }

  async saveSnapshot(queue: Queue, state: QueueState): Promise<void> {
    await this.transactions.commit(queue, state);
  }

  async recover(): Promise<boolean> {
    return this.transactions.recover();
  }
}
