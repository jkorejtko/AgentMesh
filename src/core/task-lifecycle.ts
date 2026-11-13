import type { TaskStatus } from './schemas.js';

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['ready', 'blocked', 'skipped', 'cancelled'],
  ready: ['delegating', 'skipped', 'blocked', 'cancelled'],
  delegating: ['running', 'pending', 'failed', 'cancelled'],
  running: ['completed', 'awaiting_approval', 'pending', 'failed', 'cancelled'],
  awaiting_approval: ['completed', 'pending', 'cancelled'],
  completed: [],
  failed: [],
  blocked: ['pending', 'skipped', 'cancelled'],
  skipped: [],
  cancelled: [],
};

export function canTransition(current: TaskStatus, next: TaskStatus): boolean {
  return transitions[current].includes(next);
}

export function assertTransition(current: TaskStatus, next: TaskStatus): void {
  if (!canTransition(current, next)) {
    throw new Error(`Invalid task transition: ${current} -> ${next}`);
  }
}
