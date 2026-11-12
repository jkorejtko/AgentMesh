# T3 Code Integration Contract

## Delegation

- Use delegate_task with mode="async".
- Always provide a stable clientRequestId.
- Never generate a new clientRequestId when recovering an uncertain delegation.
- Use the same clientRequestId to safely retry the same submission.
- Use a new clientRequestId for a genuinely new execution attempt.
- Persist delegation metadata immediately after receiving the response.

## Delegation metadata

Persist:

- clientRequestId
- taskId
- childThreadId
- childRunId
- parentThreadId
- providerInstanceId
- model
- attempt number
- delegation timestamp

## Status tracking

- Use task_status from the original parent thread.
- Persist every observed status transition.
- Store summary and resultContextTransferId.
- A terminal task status must be acknowledged through task_status.
- Do not treat an interrupted local process as a failed external task.

## Recovery

- Reuse the original parent thread whenever possible.
- On uncertain delegation, retry with the same clientRequestId.
- Never create a duplicate delegation with a new key during recovery.
- If continuing from another parent thread, use t3_thread_read with childThreadId.
- Do not assume task_status or task_cancel works across parent thread boundaries.

## Cancellation

- Use task_cancel with taskId.
- Persist cancellation requests and returned status.
- Do not assume cancellation is immediate.
- Preserve results of tasks that already completed.

## Concurrency

- Enforce maxConcurrency locally.
- Default maximum: 3 active agents.
- Use isolation="worktree" for implementation tasks.
- Use isolation="shared" for read-only analysis tasks.

## Results

- Request structured JSON in the child agent's final response.
- Parse and validate the returned summary locally.
- Never mark a task completed without validating its result.
- Require human approval for code changes.

## Provider selection

- Provider and model can be selected per task using target.
- Verify available providers and models through orchestrator_capabilities.
- Never assume a provider or model is available.

## Persistence

- Local queue state is the source of truth for workflow management.
- T3 Code SQLite is the source of truth for external execution state.
- Persist local state before and after external actions.
