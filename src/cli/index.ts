import { resolve } from 'node:path';

import { TaskManager } from '../core/task-manager.js';
import { QueueStorage } from '../storage/queue-storage.js';

async function main(): Promise<void> {
  const projectRoot = process.cwd();
  const runtimeDir = resolve(projectRoot, '.agentmesh');
  const templatePath = resolve(projectRoot, 'templates/queue.json');

  const storage = new QueueStorage(runtimeDir);
  const manager = new TaskManager(storage);

  await storage.initialize(templatePath);
  await manager.initialize();

  const [queue, state] = await Promise.all([storage.loadQueue(), storage.loadState()]);

  console.log('Agentmesh');
  console.log('---------');
  console.log(`Queue: ${queue.name}`);
  console.log(`Queue ID: ${queue.queueId}`);
  console.log(`Queue status: ${state.status}`);
  console.log(`Tasks defined: ${queue.tasks.length}`);
  console.log(`Active agents: ${state.activeAgents.length}`);
  console.log(`Runtime: ${runtimeDir}`);
  console.log('Storage: OK');
}

main().catch((error: unknown) => {
  console.error('Failed to initialize Agentmesh:', error);
  process.exitCode = 1;
});
