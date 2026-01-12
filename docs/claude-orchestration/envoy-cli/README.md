# envoy-cli

Agent tooling CLI providing structured commands for plan management, knowledge indexing, code analysis, and observability. Invoked via `envoy <group> <command> [args]`.

## Documentation

| Document | Description |
|----------|-------------|
| [command-architecture.md](command-architecture.md) | Auto-discovery, BaseCommand, JSON-only output |
| [provider-abstraction.md](provider-abstraction.md) | LLM provider abstraction layer |
| [oracle-system.md](oracle-system.md) | Context-aware code understanding |
| [knowledge-indexing.md](knowledge-indexing.md) | RAG indexing and semantic search |
| [observability.md](observability.md) | Logging, timing, instrumentation |
| [notification-system.md](notification-system.md) | Cross-platform desktop notifications |
| [tree-sitter-integration.md](tree-sitter-integration.md) | AST parsing for code analysis |
| [retry-resilience.md](retry-resilience.md) | Retry strategies and error recovery |
| [plan-commands.md](plan-commands.md) | Plan lifecycle and gate commands |
| [docs-commands.md](docs-commands.md) | Documentation generation commands |
| [gates-feedback.md](gates-feedback.md) | Gate feedback file handling |

## Key Concepts

- **Auto-discovery** loads commands from filesystem at startup
- **JSON-only output** enables reliable parsing by consuming agents
- **BaseCommand** provides consistent result structure and observability
- **Command groups** via directory structure (oracle/, plan/, docs/)
