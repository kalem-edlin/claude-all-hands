---
name: command-development
description: Use when user asks to "create a slash command", "add a command", "write custom command", or needs guidance on command frontmatter, dynamic arguments, or bash execution.
---

<objective>
Guide creation of Claude Code slash commands with proper structure, frontmatter, and dynamic features. Commands are Markdown files containing prompts that Claude executes when invoked, providing reusability and quick access to complex workflows.
</objective>

<quick_start>
1. Create `.claude/commands/command-name.md`
2. Add frontmatter if needed (description, allowed-tools, argument-hint)
3. Write prompt body with dynamic arguments (`$1`, `$ARGUMENTS`, `@file`)
4. Test with `/command-name [args]`
</quick_start>

<success_criteria>
- Command file exists in correct location with `.md` extension
- Frontmatter valid YAML (if present)
- Dynamic arguments work as expected
- Tool restrictions appropriate for command scope
</success_criteria>

<constraints>
- Commands are instructions FOR Claude, not messages TO users
- Be restrictive with tools: `Bash(git:*)` not `Bash(*)`
- Descriptions under 60 characters
- Single responsibility per command
</constraints>

## Command Locations

| Type | Location | Scope | Label |
|------|----------|-------|-------|
| Project | `.claude/commands/` | Shared with team | (project) |
| Personal | `~/.claude/commands/` | All your projects | (user) |
| Plugin | `plugin/commands/` | Plugin users | (plugin-name) |

Project commands take precedence over personal commands with same name.

## File Format

**Minimal command** (no frontmatter):
```markdown
Review this code for security vulnerabilities including:
- SQL injection
- XSS attacks
- Authentication issues
```

**With frontmatter**:
```markdown
---
description: Review code for security issues
allowed-tools: Read, Grep, Bash(git:*)
model: sonnet
argument-hint: [file-path]
---

Review @$1 for security vulnerabilities...
```

## YAML Frontmatter Fields

| Field | Purpose | Default |
|-------|---------|---------|
| `description` | Brief description for `/help` | First line of prompt |
| `allowed-tools` | Tools command can use | Inherits from conversation |
| `model` | Model to use (sonnet/opus/haiku) | Inherits from conversation |
| `argument-hint` | Document expected arguments | None |
| `disable-model-invocation` | Prevent SlashCommand tool from calling | false |

For detailed field specifications, see `references/frontmatter-reference.md`.

## Dynamic Arguments

### $ARGUMENTS - All arguments

```markdown
---
argument-hint: [issue-number]
---
Fix issue #$ARGUMENTS following coding standards.
```

Usage: `/fix-issue 123 high-priority` expands `$ARGUMENTS` to "123 high-priority"

### Positional - $1, $2, $3...

```markdown
---
argument-hint: [pr-number] [priority] [assignee]
---
Review PR #$1 with priority $2, assign to $3.
```

## File References

Use `@` prefix to include file contents:

```markdown
# Static reference
Review @src/utils/helpers.js for issues.

# Dynamic with argument
Generate docs for @$1
```

## Bash Execution

Execute bash commands inline with exclamation-backtick syntax. Requires `allowed-tools` with Bash.

```markdown
---
allowed-tools: Bash(git:*)
---

Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`
Status: !`git status --short`

Review changes and suggest commit message.
```

**Tool patterns**:
- `Bash(git:*)` - Only git commands
- `Bash(npm:*)` - Only npm commands
- `Bash(kubectl:*), Bash(helm:*)` - Multiple specific tools

## Command Organization

### Flat (5-15 commands)

```
.claude/commands/
├── build.md
├── test.md
├── deploy.md
└── review.md
```

### Namespaced (15+ commands)

```
.claude/commands/
├── ci/
│   ├── build.md    # /build (project:ci)
│   └── test.md     # /test (project:ci)
├── git/
│   ├── commit.md   # /commit (project:git)
│   └── pr.md       # /pr (project:git)
└── docs/
    └── generate.md # /generate (project:docs)
```

<examples>

### Read-Only Analysis
```markdown
---
allowed-tools: Read, Grep
---
Analyze code without modifications...
```

### Git Operations
```markdown
---
allowed-tools: Bash(git:*)
---
!`git status`
Analyze and suggest...
```

### File Comparison
```markdown
Compare @$1 with @$2 and identify differences...
```

### User Interaction (AskUserQuestion)
```markdown
---
description: Deploy with environment selection
---

Use AskUserQuestion to confirm deployment:

Question: "Deploy to which environment?"
Options:
1. Development - Lower risk, fast iteration
2. Staging - Pre-production testing
3. Production - Live deployment (requires approval)

After user selection, proceed with deployment to chosen environment.
```

</examples>

## Additional Resources

### Reference Files
- **`references/frontmatter-reference.md`** - Complete field specifications and constraints

### Examples
- **`examples/simple-commands.md`** - Basic command patterns
- **`examples/plugin-commands.md`** - Plugin-specific patterns with ${CLAUDE_PLUGIN_ROOT}
