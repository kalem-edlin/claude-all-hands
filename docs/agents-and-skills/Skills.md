---
description: Skill taxonomy, structure patterns, and usage. Covers simple vs router skills, folder organization, and when to use each skill type.
---

# Skills

## Overview

Skills are modular, filesystem-based capabilities that provide domain expertise on demand. When an agent has a skill in its `skills:` frontmatter, the SKILL.md is auto-loaded at spawn.

## Skill Categories

### Infrastructure Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| **claude-code-patterns** | Official Claude Code docs reference | curator |
| **claude-envoy-patterns** | Envoy command patterns | curator |
| **orchestration-idols** | External orchestration patterns (wshobson/agents, claude-flow) | curator |

### Development Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| **skills-development** | Meta-skill for authoring skills | curator |
| **subagents-development** | Agent creation patterns | curator |
| **hooks-development** | Hook configuration | curator |
| **commands-development** | Slash command creation | curator |

### Workflow Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| **discovery-mode** | Read-only analysis protocol | curator |
| **implementation-mode** | Prompt execution lifecycle | (specialists) |
| **brainstorming** | Collaborative design process | (main agent) |

### External Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| **research-tools** | External research APIs (Tavily, Perplexity, Grok) | curator, researcher |
| **git-ops** | Git workflow standardization | (all agents) |

### Documentation Skills

| Skill | Purpose | Used By |
|-------|---------|---------|
| **documentation-taxonomy** | Doc system reference (commands, segmentation) | documentation-taxonomist, documentation-writer |

## Skill Structure

### Simple Skill (Single File)

```
skill-name/
└── SKILL.md
```

For focused, single-purpose skills:

```yaml
---
name: skill-name
description: What it does and when to use it.
---

<objective>What this skill accomplishes</objective>
<quick_start>Immediate actionable guidance</quick_start>
<workflow>Step-by-step procedure</workflow>
<success_criteria>How to know it worked</success_criteria>
```

### Router Skill (Complex)

```
skill-name/
├── SKILL.md              # Router + essential principles
├── workflows/            # Step-by-step procedures (FOLLOW)
├── references/           # Domain knowledge (READ)
├── templates/            # Output structures (COPY + FILL)
└── scripts/              # Executable code (EXECUTE)
```

SKILL.md routes to appropriate workflow based on user intent:

```yaml
---
name: skill-name
description: Complex skill with multiple workflows.
---

<essential_principles>
Core rules that ALWAYS apply regardless of workflow.
</essential_principles>

<intake>
What would you like to do?
1. Option A
2. Option B
</intake>

<routing>
| Response | Workflow |
|----------|----------|
| 1, "option a" | workflows/option-a.md |
| 2, "option b" | workflows/option-b.md |
</routing>
```

## Folder Purposes

| Folder | Content | Claude Action |
|--------|---------|---------------|
| **workflows/** | Multi-step procedures | FOLLOW step-by-step |
| **references/** | Domain knowledge, patterns | READ for context |
| **templates/** | Output structures (plans, specs) | COPY + FILL |
| **scripts/** | Executable code | EXECUTE as-is |

## Implementation Patterns

### Reference Skill

Provides domain knowledge without workflows. Example: `claude-code-patterns`

```yaml
<workflow>
### Doc Selection by Task

| Building | Read These |
|----------|------------|
| Skills | skills.md, plugins.md |
| Agents | sub-agents.md |
| Hooks | hooks-guide.md |
</workflow>
```

### Process Skill

Guides through specific workflow. Example: `git-ops`

```yaml
<workflow name="commit-message">
Conventional Commits: `<type>(<scope>): <description>`

### Process
1. Read current plan step context
2. `git diff --cached` for changes
3. Generate message
</workflow>
```

### Integration Skill

Wraps external tools. Example: `research-tools`

```yaml
<quick_start>
# Deep research (Perplexity)
envoy perplexity research "query"

# Web search (Tavily)
envoy tavily search "query"
</quick_start>

<workflow>
| Need | Tool |
|------|------|
| Broad question | perplexity research |
| Find sources | tavily search |
| Extract URL | tavily extract |
</workflow>
```

### Meta Skill

Skill for creating skills. Example: `skills-development`

```yaml
<routing>
| Response | Workflow |
|----------|----------|
| "create" | workflows/create-new-skill.md |
| "audit" | workflows/audit-skill.md |
| "add workflow" | workflows/add-workflow.md |
</routing>
```

## Key Skills Detail

### skills-development

Meta-skill for authoring Claude Code skills.

**Essential principles**:
- Skills are prompts (all prompting best practices apply)
- SKILL.md is always loaded (essential principles there)
- Router pattern for complex skills
- Pure XML structure (no markdown headings)
- Progressive disclosure (< 500 lines)

**Workflows**: create-new-skill, audit-skill, add-workflow, add-reference, upgrade-to-router

### subagents-development

Agent creation and Task tool usage patterns.

**Key configuration**:
- `skills` field CRITICAL - dictates capabilities
- `tools` - least privilege
- `description` - optimized for routing

**Constraint**: Subagents cannot use AskUserQuestion

### hooks-development

Event-driven automation for Claude Code.

**Hook types**:
- PreToolUse/PostToolUse - tool lifecycle
- UserPromptSubmit - prompt validation
- Stop/SubagentStop - completion control
- SessionStart/SessionEnd - session lifecycle

**Hook anatomy**:
- `command` - shell execution
- `prompt` - LLM evaluation

### commands-development

Slash command creation.

**Structure**:
```yaml
---
description: Command purpose
argument-hint: [input]
allowed-tools: [restrictions]
---

<objective>What and why</objective>
<process>How to execute</process>
<success_criteria>Definition of done</success_criteria>
```

### research-tools

External research via envoy commands.

**Tools**:
- `envoy perplexity research` - deep synthesis with citations
- `envoy tavily search` - web search for sources
- `envoy tavily extract` - content from known URLs
- `envoy xai search` - X/Twitter insights

**Constraint**: Only curator/researcher agents

### discovery-mode

Read-only codebase analysis protocol.

**Commands**:
- `envoy plans write-approach` - required findings
- `envoy plans write-option` - alternatives

**Pattern**: Analyze -> Write via envoy -> Return confirmation only

### implementation-mode

Prompt execution lifecycle.

**Workflow**: get-prompt -> implement -> append-history -> review -> commit

**Modes**: NORMAL (full workflow), FEEDBACK (address review issues)

## Edge Cases

- **Skill loading order**: Agent skills loaded before task context
- **Circular references**: Avoid skills referencing each other
- **Size limits**: SKILL.md < 500 lines; split to references/
- **Progressive disclosure**: Load only what's needed for current workflow
