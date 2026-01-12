# agent-config

Agent specialization and capability injection patterns for Claude Code multi-agent system.

## Documentation

| Document | Description |
|----------|-------------|
| [agent-specialization.md](agent-specialization.md) | Role-based isolation, tool restriction, delegation boundaries |
| [skill-system.md](skill-system.md) | SKILL.md format, router patterns, progressive disclosure |
| [slash-commands.md](slash-commands.md) | Custom command registration and invocation |
| [composition-patterns.md](composition-patterns.md) | Multi-agent coordination and skill composition |

## Key Concepts

- **Specialists** own distinct responsibility domains (curator, researcher, writer)
- **Skills** inject domain expertise without duplicating knowledge across agents
- **Slash commands** expose skill workflows via `/command` syntax
- **Composition** enables agents to declare multiple skills for broad capability
