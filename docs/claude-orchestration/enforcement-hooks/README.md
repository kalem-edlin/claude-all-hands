# enforcement-hooks

Hook-based capability enforcement for Claude Code agents. Blocks, redirects, and validates tool usage at runtime.

## Documentation

| Document | Description |
|----------|-------------|
| [security-enforcement.md](security-enforcement.md) | Research blocking, GitHub URL redirection, capability restriction |
| [validation-hooks.md](validation-hooks.md) | Input/output validation patterns |
| [notification-hooks.md](notification-hooks.md) | Session event notifications and alerts |
| [session-initialization.md](session-initialization.md) | Context setup on agent session start |

## Key Concepts

- **PreToolUse blocking** intercepts tools before execution
- **Security hooks** use deny decisions (not approval prompts) for consistent enforcement
- **Graceful redirection** provides actionable alternatives in denial messages
- **Domain-based matching** catches cross-cutting concerns (GitHub URLs) across multiple tools
