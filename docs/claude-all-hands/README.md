# claude-all-hands

CLI tool for distributing Claude Code agent configurations across repositories via manifest-based file sync. Enables consumers to receive upstream updates and contribute improvements back via GitHub PRs.

## Documentation

| Document | Description |
|----------|-------------|
| [sync-architecture.md](sync-architecture.md) | Manifest-based file distribution with .internal.json and gitignore filtering |
| [push-pull-workflow.md](push-pull-workflow.md) | Bidirectional sync - pull for updates, push for contributing via fork/PR |
| [git-integration.md](git-integration.md) | Git/gh CLI integration patterns for repository operations |
| [build-packaging.md](build-packaging.md) | esbuild bundling and npm packaging with dotfile restoration |

## Key Technologies

- **yargs**: Declarative CLI command definition with subcommand routing
- **esbuild**: Single-file bundling for zero-runtime-dependency distribution

## Entry Points

- **Setting up a new repo**: See [sync-architecture.md](sync-architecture.md) for manifest system
- **Contributing changes back**: See [push-pull-workflow.md](push-pull-workflow.md) for fork-based contribution
- **Understanding CLI internals**: See [build-packaging.md](build-packaging.md) for packaging decisions
