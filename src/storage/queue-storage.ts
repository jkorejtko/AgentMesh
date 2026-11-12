
import { resolve } from 'node:path';

import {
  QueueSchema,
  QueueStateSchema,
  type Queue,
  type QueueState,
} from '../core/schemas.js';

import { AsyncMutex } from './async-mutex.js';
import { readJson } from './json-store.js';
import { TransactionManager } from './transaction-manager.js';

export class QueueStorage {
  private readonly queuePath: string;
  private readonly statePath: string;
  private readonly transactions: TransactionManager;
  private readonly mutex = new AsyncMutex();

  constructor(rootDir: string) {
    this.queuePath = resolve(rootDir, 'queues/queue.json');
    this.statePath = resolve(rootDir, 'queues/state.json');
    this.transactions = new TransactionManager(rootDir);
  }

  async runExclusive<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
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
