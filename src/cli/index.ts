import { QueueStorage } from "../storage/queue-storage.js";

async function main(): Promise<void> {
  const storage = new QueueStorage(process.cwd());

  const [queue, state] = await Promise.all([storage.loadQueue(), storage.loadState()]);

  console.log("My Agent Workflows");
  console.log("------------------");
  console.log(`Queue: ${queue.name}`);
  console.log(`Queue ID: ${queue.queueId}`);
  console.log(`Queue status: ${state.status}`);
  console.log(`Tasks defined: ${queue.tasks.length}`);
  console.log(`Active agents: ${state.activeAgents.length}`);
  console.log("Storage: OK");
}

main().catch((error: unknown) => {
  console.error("Failed to initialize workflow engine:", error);
  process.exitCode = 1;
});
