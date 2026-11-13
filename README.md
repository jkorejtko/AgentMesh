# Agentmesh

<sub>🚧 Work in Progress — Early Development</sub>

A persistent, provider-agnostic orchestration engine for AI agents.

Agentmesh coordinates AI agents across complex, multi-step workflows. It manages task dependencies, execution, concurrency, failures, and recovery — while keeping orchestration independent of the underlying AI provider.

**The goal:** define a workflow once, delegate its tasks to AI agents, and reliably track execution across interruptions and restarts.

Agentmesh is an orchestration layer, not an AI agent runtime. It coordinates external agents rather than implementing or managing their internal reasoning and tool execution.

This project is in an early development stage. APIs, architecture, and features are actively evolving. It is not ready for production use.

## Vision

AI agents are increasingly capable of handling complex development tasks. However, coordinating multiple agents across larger workflows remains challenging.

Agentmesh aims to solve this by providing a persistent orchestration layer between task definitions and AI agent execution providers.

Instead of focusing on how individual agents work, Agentmesh focuses on coordinating their work:

- **Task management** — define tasks, priorities, and acceptance criteria.
- **Dependency management** — execute tasks only when their dependencies are satisfied.
- **Agent delegation** — delegate work to external AI agents through provider adapters.
- **Execution control** — manage concurrency and execution limits.
- **Failure handling** — handle failures, retries, and interrupted executions.
- **Persistence** — preserve workflow state across application restarts.
- **Human control** — support approval workflows for sensitive operations.

The orchestration engine should remain independent of the underlying AI provider, model, or execution environment.

## Project Principles

A few principles guide the architecture:

1. **Provider independence** — orchestration logic must not depend on a specific AI provider.
2. **Persistence first** — execution state must survive application restarts.
3. **Explicit lifecycle** — task transitions should be predictable and validated.
4. **Safe delegation** — every agent execution must be traceable to a specific task and attempt.
5. **Failure is expected** — retries, interruptions, and recovery are fundamental parts of the design.
6. **Human control** — potentially sensitive operations should support explicit approval.
7. **Separation of concerns** — Agentmesh coordinates work; providers execute it.

## Architecture

Agentmesh separates workflow orchestration from external agent execution.

```text
                         Agentmesh
                             |
                  +----------+----------+
                  |                     |
                  v                     v
              Task Queue             Storage
                  |
                  v
              Task Manager
                  |
                  v
               Scheduler
                  |
                  v
          Provider Interface
                  |
          +-------+-------+
          |       |       |
          v       v       v
         T3     Codex   Claude
       Adapter  Adapter Adapter
          |       |       |
          v       v       v
       AI Agents AI Agents AI Agents
```

The **Core** manages tasks, dependencies, execution state, and workflow coordination.

The **Scheduler** determines which tasks are ready for execution and when they should be delegated.

The **Provider Interface** defines a common contract for interacting with external agent execution environments.

**Provider adapters** translate between Agentmesh's internal model and provider-specific APIs, identifiers, and execution states.

T3 Code is the initial integration target. Additional providers may be supported through independent adapters.

The architecture is designed so that adding a new provider does not require changes to the core orchestration engine.

## Current Status

The project is currently focused on building its core orchestration engine.

### Implemented

- TypeScript project setup.
- Zod-based data schemas and runtime validation.
- Task lifecycle and state transitions.
- Task dependency resolution.
- Persistent JSON-based queue and state storage.
- Atomic JSON file writes.
- Transaction journal with roll-forward recovery.
- In-process asynchronous mutex.
- Task manager with delegation preparation and completion.
- Persistent delegation metadata.
- Validation of delegation responses.
- Protection against outdated delegation responses.
- Runtime data isolation in `.agentmesh/`.
- First-run storage initialization.
- Unit tests for core functionality and storage.

### In Progress

- Provider abstraction and interface.
- Provider registry.
- T3 Code adapter.
- Agent execution and status reconciliation.
- Workflow execution engine.
- Retry and interruption handling.
- Approval workflows.
- CLI workflow management.

The implemented features represent the current foundation. The orchestration workflow and provider integrations are still under development.

## Tech Stack

- **TypeScript** — application language.
- **Node.js** — runtime environment.
- **Zod** — schema definition and runtime validation.
- **JSON storage** — persistent queue and execution state.
- **Node.js built-in test runner** — automated testing.
- **Oxlint** — linting.
- **Oxfmt** — formatting.
- **pnpm** — package management.

T3 Code is the initial planned agent execution integration, not a dependency of the core engine.

## Getting Started

> Development setup only. Agentmesh is not yet intended for production use.

### Requirements

- Node.js 24+
- pnpm 10+

### Installation

```bash
git clone <repository-url>
cd agentmesh
pnpm install
```

### Development

```bash
# Run the CLI
pnpm dev

# Run tests
pnpm test

# Type-check
pnpm typecheck

# Run lint
pnpm lint

# Check formatting
pnpm format:check

# Run all quality checks
pnpm check
```

### Runtime Data

Agentmesh stores its local runtime data in the `.agentmesh/` directory.

```text
.agentmesh/
├── queue.json
├── state.json
└── journal.json
```

The directory is created automatically on first startup.

Runtime data is intentionally excluded from version control. The default queue configuration is maintained separately in `templates/queue.json`.

## Roadmap

### Core Orchestration

- [x] Initial TypeScript project and schemas
- [x] Task lifecycle management
- [x] Dependency resolution
- [x] Persistent JSON storage
- [x] Transaction journal and recovery
- [x] Delegation metadata and validation
- [x] Runtime data isolation and initialization
- [ ] Provider interface
- [ ] Provider registry
- [ ] Workflow execution engine
- [ ] Concurrency management
- [ ] Retry and interruption handling
- [ ] Provider status reconciliation
- [ ] Approval workflows

### Provider Integrations

- [ ] T3 Code adapter
- [ ] Additional provider adapters
- [ ] Provider capability discovery

### Developer Experience

- [ ] CLI workflow management
- [ ] Execution history
- [ ] Configuration documentation
- [ ] Examples and tutorials
- [ ] Integration testing

### Ecosystem

- [ ] Stable public API
- [ ] npm package
- [ ] Contribution guidelines
- [ ] Public package release

## Contributing

Agentmesh is currently under active development. Its architecture and public interfaces are not stable yet.

Issues, ideas, and architectural discussions are welcome.

Contribution guidelines and a stable extension API will be introduced as the project matures.

## License

MIT License. See [LICENSE](LICENSE) for details.
