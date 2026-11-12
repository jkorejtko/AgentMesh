
import { z } from 'zod';

// -----------------------------------------------------------------------------
// Task definition
// -----------------------------------------------------------------------------

export const TaskTypeSchema = z.enum([
  'analysis',
  'implementation',
  'testing',
  'review',
  'documentation',
]);

export const TaskPrioritySchema = z.number().int().min(1).max(5);

export const TaskDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  type: TaskTypeSchema,
  priority: TaskPrioritySchema,
  dependencies: z.array(z.string()).default([]),
  preferredAgent: z.string().default('auto'),
  requiredSkills: z.array(z.string()).default([]),
  approvalRequired: z.boolean().default(false),
  acceptanceCriteria: z.array(z.string()).default([]),
    context: z.object({
    projectPath: z.string().nullable().default(null),
    files: z.array(z.string()).default([]),
    notes: z.string().nullable().default(null),
  }).default({
    projectPath: null,
    files: [],
    notes: null,
  }),
});

export const QueueConfigSchema = z.object({
  maxConcurrency: z.number().int().min(1).max(20).default(3),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  retryDelaySeconds: z.number().min(0).default(30),
  stopOnFailure: z.boolean().default(false),
  requireApprovalForCodeChanges: z.boolean().default(true),
});

export const QueueSchema = z.object({
  schemaVersion: z.literal(1),
  queueId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  config: QueueConfigSchema,
  tasks: z.array(TaskDefinitionSchema),
});

// -----------------------------------------------------------------------------
// Runtime state
// -----------------------------------------------------------------------------

export const TaskStatusSchema = z.enum([
  'pending',
  'ready',
  'delegating',
  'running',
  'awaiting_approval',
  'completed',
  'failed',
  'blocked',
  'skipped',
  'cancelled',
]);



export const AgentSchema = z.object({
  // Identifikace lokální úlohy
  taskId: z.string(),

  // Identifikace delegace v T3
  taskIdExternal: z.string().nullable(),
  clientRequestId: z.string(),

  // Identifikace vláken a běhu v T3
  childThreadId: z.string().nullable(),
  childRunId: z.string().nullable(),
  parentThreadId: z.string().nullable(),

  // Informace o použitém agentovi
  providerInstanceId: z.string().nullable(),
  model: z.string().nullable(),

  // Informace o pokusu
  attempt: z.number().int().min(1),
  delegatedAt: z.string().datetime(),
});


export const TaskRuntimeSchema = z.object({
  status: TaskStatusSchema,
  attempts: z.number().int().min(0),
  agent: AgentSchema.nullable().default(null),
  startedAt: z.string().datetime().nullable().default(null),
  completedAt: z.string().datetime().nullable().default(null),
  result: z.string().nullable().default(null),
  error: z.string().nullable().default(null),
});

export const QueueStatsSchema = z.object({
  total: z.number().int().min(0),
  pending: z.number().int().min(0),
  ready: z.number().int().min(0),
  delegating: z.number().int().min(0),
  running: z.number().int().min(0),
  awaitingApproval: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  blocked: z.number().int().min(0),
  skipped: z.number().int().min(0),
  cancelled: z.number().int().min(0),
});


export const QueueStateSchema = z.object({
  schemaVersion: z.literal(1),
  queueId: z.string().min(1),
  status: z.enum(['idle', 'running', 'paused', 'completed']),
  activeRunId: z.string().nullable(),
  createdAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime().nullable(),
  tasks: z.record(z.string(), TaskRuntimeSchema),
  activeAgents: z.array(AgentSchema),
  stats: QueueStatsSchema,
});

// -----------------------------------------------------------------------------
// Inferred TypeScript types
// -----------------------------------------------------------------------------

export type TaskDefinition = z.infer<typeof TaskDefinitionSchema>;
export type TaskRuntime = z.infer<typeof TaskRuntimeSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Queue = z.infer<typeof QueueSchema>;
export type QueueState = z.infer<typeof QueueStateSchema>;
export type Agent = z.infer<typeof AgentSchema>;

