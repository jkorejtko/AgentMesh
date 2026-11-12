# Agent Workflow Orchestrator

<sub>🚧 Work in Progress — Early Development</sub>

A persistent, dependency-aware task orchestration engine for AI agents.

**The goal:** define a set of tasks, delegate them to AI agents, manage dependencies, execute work in parallel, and reliably track progress — even across interruptions and restarts.

This project is in an early development stage. APIs, architecture, and features are actively evolving. It is not ready for production use.

## Vision

AI coding agents are becoming increasingly capable, but coordinating multiple agents across larger tasks is still challenging.

This project aims to provide a lightweight orchestration layer that handles the operational side of agent workflows:

- What needs to be done?
- Which tasks depend on other tasks?
- Which agent should execute each task?
- How many agents can work simultaneously?
- What happens when an agent fails or gets interrupted?
- How can execution safely resume after a restart?
- When should human approval be required?

The orchestrator should handle these concerns independently of the underlying AI provider.

## Planned Features

- **Persistent task queue** — store tasks and execution state.
- **Dependency management** — execute tasks only when their dependencies are satisfied.
- **Parallel execution** — control the maximum number of concurrent agents.
- **Agent delegation** — delegate individual tasks to external AI agents.
- **Retry handling** — retry failed tasks with configurable limits.
- **Crash recovery** — recover interrupted workflows and reconcile agent execution state.
- **Approval workflows** — require human approval before sensitive operations.
- **Provider abstraction** — support multiple AI agent providers through adapters.
- **Execution history** — track task attempts, results, and failures.

These are project goals, not a claim that all features are currently implemented.

## Current Status

The project is currently focused on its core orchestration engine.

### Implemented

- TypeScript project setup.
- Zod-based data schemas and runtime validation.
- Task lifecycle and state transitions.
- Task dependency resolution.
- Persistent JSON-based queue and state storage.
- Atomic file writes.
- Transaction journal with recovery.
- In-process asynchronous mutex.
- Task manager with delegation preparation and completion.
- Delegation metadata persistence.
- Validation of delegation responses.
- Protection against outdated delegation responses.
- Unit tests for core functionality and storage.

### In Progress

- T3 Code integration.
- Agent execution and status reconciliation.
- Workflow execution loop.
- Retry and recovery orchestration.
- Approval handling.
- CLI workflow management.

## Architecture

The intended architecture separates task orchestration from agent execution providers.

```text
                 Task Queue
                     |
                     v
                Task Manager
                     |
          +----------+----------+
          |          |          |
          v          v          v
      Lifecycle  Dependencies  State
          |                     |
          +----------+----------+
                     |
                     v
                Agent Adapter
                     |
          +----------+----------+
          |          |          |
          v          v          v
         T3        Provider B  Provider C
          |
          v
      AI Agents
```

The initial execution integration targets T3 Code. The long-term goal is to support multiple providers without coupling the core engine to a specific platform.

## Tech Stack

- TypeScript
- Node.js
- Zod
- JSON-based persistent storage
- Node.js built-in test runner
- T3 Code orchestration (planned integration)

## Getting Started

> Development setup only. The project is not yet intended for production use.

### Requirements

- Node.js
- npm

### Installation

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

### Development

```bash
# Run the CLI
npm run dev

# Run tests
npm test

# Type-check
npm run typecheck
```

## Project Principles

A few principles guide the architecture:

1. **Provider independence** — orchestration logic should not depend on a specific AI provider.
2. **Persistence first** — execution state must survive application restarts.
3. **Explicit lifecycle** — task transitions should be predictable and validated.
4. **Safe delegation** — every agent execution should be traceable to a specific task and attempt.
5. **Failure is expected** — retries, interruptions, and recovery are part of the design.
6. **Human control** — potentially sensitive operations should support explicit approval.

## Roadmap

- [x] Initial TypeScript project and schemas
- [x] Task lifecycle management
- [x] Dependency resolution
- [x] Persistent JSON storage
- [x] Transaction journal and recovery
- [x] Delegation metadata and validation
- [ ] T3 Code adapter
- [ ] Agent execution monitoring
- [ ] Workflow execution engine
- [ ] Retry and crash recovery
- [ ] Approval workflows
- [ ] Improved CLI
- [ ] Documentation and examples
- [ ] Public package release

## Contributing

The project is currently under active development. Its architecture and public interfaces are not stable yet.

Issues, ideas, and architectural discussions are welcome, but contribution guidelines and a stable extension API will be introduced later.

## License

License not selected yet.
