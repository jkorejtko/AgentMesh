# Task State Machine

## States

- pending: waiting for execution
- ready: dependencies satisfied, eligible for execution
- delegating: delegation request is being submitted
- running: external agent is executing the task
- awaiting_approval: result requires human approval
- completed: successfully completed and verified
- failed: maximum attempts exhausted or unrecoverable error
- blocked: dependency failed or was cancelled
- skipped: manually skipped
- cancelled: manually cancelled

## Retry policy

- Maximum attempts: 3
- Retry delay: 30 seconds
- Failed attempts return to pending while retries remain
- After the final failed attempt, transition to failed
- Never retry an already completed task

## Dependency rules

- A task is ready only when all dependencies are completed
- If a dependency fails, is blocked or cancelled, dependent tasks become blocked
- Circular dependencies are forbidden

## Execution rules

- Maximum concurrent agents: 3
- Every delegation must have a persisted external task ID
- Never delegate a task that is already delegating or running
- Persist state before and after every external action
- Recover running tasks by querying their external task IDs
- Never assume an external task failed just because the local process stopped

## Completion rules

- A task can be completed only when:
  - The agent returned a result
  - Acceptance criteria were checked
  - Required approval was granted, if applicable

## Safety

- Code changes require explicit approval
- Analysis and planning tasks can run without approval
- Cancellation must not silently discard completed work

