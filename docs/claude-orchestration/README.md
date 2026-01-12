# claude-orchestration

Multi-agent orchestration infrastructure for Claude Code. Provides agent specialization, capability enforcement via hooks, the envoy CLI for agent tooling, and human-in-the-loop plan system for feature development.

## Subdomains

| Subdomain | Description |
|-----------|-------------|
| [agent-config/](agent-config/) | Agent specialization, skills, slash commands, composition patterns |
| [enforcement-hooks/](enforcement-hooks/) | Security enforcement, validation, notification hooks |
| [envoy-cli/](envoy-cli/) | Command architecture, providers, oracle, knowledge indexing |
| [plan-system/](plan-system/) | Human-supervised workflow with gates, prompts, findings |

## Architecture Overview

```
                    +------------------+
                    |   Main Agent     |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v----+  +------v------+  +----v--------+
     | Specialist  |  | Specialist  |  | Specialist  |
     | (curator)   |  | (researcher)|  | (writer)    |
     +------+------+  +------+------+  +------+------+
            |                |                |
            v                v                v
     +------+------+  +------+------+  +------+------+
     |   Skills    |  | envoy CLI   |  |   Skills    |
     | (expertise) |  | (tools)     |  | (expertise) |
     +-------------+  +-------------+  +-------------+
            |
            v
     +-------------+
     |   Hooks     |
     | (enforce)   |
     +-------------+
```

## Entry Points

- **Understanding agent design**: Start with [agent-config/agent-specialization.md](agent-config/agent-specialization.md)
- **Security model**: See [enforcement-hooks/security-enforcement.md](enforcement-hooks/security-enforcement.md)
- **Building new commands**: See [envoy-cli/command-architecture.md](envoy-cli/command-architecture.md)
- **Feature development workflow**: See [plan-system/index.md](plan-system/index.md)
