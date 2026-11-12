
import { z } from 'zod';

import {
  QueueSchema,
  QueueStateSchema,
} from '../core/schemas.js';

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  status: z.literal('prepared'),
  createdAt: z.string().datetime(),
  queue: QueueSchema,
  state: QueueStateSchema,
});

export const TransactionJournalSchema = z.object({
  schemaVersion: z.literal(1),
  transaction: TransactionSchema.nullable(),
});

export type Transaction = z.infer<typeof TransactionSchema>;
export type TransactionJournal = z.infer<
  typeof TransactionJournalSchema
>;


