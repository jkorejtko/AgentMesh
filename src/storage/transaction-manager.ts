import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { QueueSchema, QueueStateSchema } from '../core/schemas.js';

import {
  TransactionJournalSchema,
  type Transaction,
  type TransactionJournal,
} from './transaction-schema.js';

import { readJson, writeJsonRaw } from './json-store.js';

import type { Queue, QueueState } from '../core/schemas.js';

export class TransactionManager {
  private readonly journalPath: string;
  private readonly queuePath: string;
  private readonly statePath: string;

  constructor(rootDir: string) {
    this.journalPath = resolve(rootDir, 'journal.json');
    this.queuePath = resolve(rootDir, 'queue.json');
    this.statePath = resolve(rootDir, 'state.json');
  }

  async commit(queue: Queue, state: QueueState): Promise<void> {
    const validatedQueue = QueueSchema.parse(queue);
    const validatedState = QueueStateSchema.parse(state);

    const transaction: Transaction = {
      id: randomUUID(),
      status: 'prepared',
      createdAt: new Date().toISOString(),
      queue: validatedQueue,
      state: validatedState,
    };

    const journal: TransactionJournal = {
      schemaVersion: 1,
      transaction,
    };

    await writeJsonRaw(this.journalPath, TransactionJournalSchema.parse(journal));

    await this.applyTransaction(transaction);

    await writeJsonRaw(this.journalPath, {
      schemaVersion: 1,
      transaction: null,
    });
  }

  async recover(): Promise<boolean> {
    const journal = await readJson(this.journalPath, TransactionJournalSchema);

    if (!journal.transaction) {
      return false;
    }

    await this.applyTransaction(journal.transaction);

    await writeJsonRaw(this.journalPath, {
      schemaVersion: 1,
      transaction: null,
    });

    return true;
  }

  private async applyTransaction(transaction: Transaction): Promise<void> {
    await writeJsonRaw(this.queuePath, transaction.queue);
    await writeJsonRaw(this.statePath, transaction.state);
  }
}
