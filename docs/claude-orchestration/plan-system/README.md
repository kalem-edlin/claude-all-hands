# plan-system

Human-in-the-loop orchestration for multi-agent feature development. Stages work through findings, planning, implementation, and testing with blocking gates at critical decision points.

## Documentation

| Document | Description |
|----------|-------------|
| [index.md](index.md) | System overview, branch-scoped state, artifact separation |
| [gate-system.md](gate-system.md) | Blocking gates, feedback schemas, validation |
| [findings-design-prompts.md](findings-design-prompts.md) | Findings, design artifacts, prompt generation |
| [prompt-lifecycle.md](prompt-lifecycle.md) | Prompt states, dependencies, execution |
| [healing-recovery.md](healing-recovery.md) | Session recovery, crash handling, state repair |

## Workflow Stages

```
draft -> findings -> plan -> implementation -> testing -> completed
          |            |          |              |
          v            v          v              v
     [findings]   [plan gate] [per-prompt]  [variants]
        gate                   testing gate    gate
```

## Key Concepts

- **Branch-scoped plans** isolate feature state per branch
- **Blocking gates** pause execution until human marks `done: true`
- **Dependency graph** orders prompts via `depends_on` field
- **Walkthroughs** capture implementation rationale for each prompt
