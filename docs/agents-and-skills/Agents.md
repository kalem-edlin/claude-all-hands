---
description: Agent definitions, roles, and implementation patterns. Covers discovery vs implementation agents, YAML configuration, and XML structure requirements.
---

# Agents

## Overview

Agents are specialized Claude instances defined in `.claude/agents/*.md` files. Each agent has a focused role with constrained tools and auto-loaded skills. The main agent routes tasks to specialists based on description field matching.

## Agent Categories

### Discovery Agents

Read-only agents that gather context without modifying code.

| Agent | Role | Skills |
|-------|------|--------|
| **surveyor** | Generic codebase exploration fallback | - |
| **researcher** | External research via web APIs | research-tools |
| **documentation-taxonomist** | Documentation segmentation planning | - |

Discovery agents write findings via envoy commands, returning only confirmations to caller.

### Implementation Agents

Agents that modify code and produce artifacts.

| Agent | Role | Skills |
|-------|------|--------|
| **worker** | Generic implementation fallback | - |
| **curator** | Orchestration infrastructure expert | claude-code-patterns, research-tools, claude-envoy-patterns, orchestration-idols, skills-development, subagents-development, hooks-development, commands-development, discovery-mode |
| **planner** | Plan and prompt creation | - |
| **code-simplifier** | Code clarity and consistency | - |
| **documentation-writer** | Documentation creation with symbol refs | - |

### Routing Priority

1. Domain-specific specialist (if `description` matches task)
2. Generic fallback (`surveyor` for discovery, `worker` for implementation)
3. External research (`researcher` if web info needed)

## Agent Configuration

### YAML Frontmatter

```yaml
---
name: agent-name           # lowercase-with-hyphens
description: |             # Used for routing - include trigger keywords
  What this agent does. When to use it proactively.
tools: Read, Glob, Grep, Bash, Write, Edit  # Comma-separated
model: opus | sonnet | haiku | inherit
skills: skill1, skill2     # Auto-loaded at spawn
color: cyan                # Terminal output color
---
```

**Critical fields:**
- `description`: Determines automatic routing; include explicit triggers
- `skills`: Dictates domain expertise; agent has NO specialized knowledge without skills
- `tools`: Least privilege principle; grant only what's needed

### XML Body Structure

Agent prompts use pure XML (no markdown headings):

```xml
<role>
Who the agent is and primary responsibility.
</role>

<capabilities>
What the agent can do, tools available, patterns.
</capabilities>

<workflow name="workflow-name">
Specific procedure with inputs/outputs/steps.
</workflow>

<constraints>
MUST/NEVER/ALWAYS rules using strong modals.
</constraints>

<success_criteria>
Task complete when: [measurable conditions]
</success_criteria>
```

## Implementation Patterns

### Discovery Agent Pattern

```xml
<role>
Discovery specialist for [domain]. Read-only analysis, writes findings via envoy.
</role>

<fallback_workflow>
> Fallback workflow. Use only when no protocol explicitly requested.

**INPUTS**: segment_context, target_paths
**OUTPUTS**: Concise summary, file paths with purposes, recommendations

**STEPS:**
1. Parse requirements
2. Discovery (Glob/Grep)
3. Read key files
4. Analyze patterns
5. Return structured findings
</fallback_workflow>

<constraints>
- DISCOVERY ONLY - NEVER implement code
- Return concise findings - no bulk data dumps
</constraints>
```

### Implementation Agent Pattern

```xml
<role>
Implementation specialist for [domain].
</role>

<fallback_workflow>
**INPUTS**: task_description, target_files, success_criteria
**OUTPUTS**: Summary, files modified, verification results

**STEPS:**
1. Parse requirements
2. Gather context (Glob/Grep/Read)
3. Plan implementation
4. Execute changes
5. Verify/test
6. Return summary
</fallback_workflow>

<constraints>
- MUST gather context before implementing
- MUST follow codebase conventions
- MUST verify changes work
</constraints>
```

### Protocol-Compatible Agents

Agents used by orchestrated workflows have explicit protocol workflows:

```xml
<some_workflow>
**INPUTS** (from main agent):
- `mode`: "create" | "refine"
- `context`: required data

**OUTPUTS** (to main agent):
- `{ success: true }` or `{ success: false, reason: string }`

**STEPS:**
1. Explicit step with envoy command
2. Next step
3. Return structured result
</some_workflow>
```

## Agent Registry

### curator

Orchestration infrastructure expert. Owns CLAUDE.md, agents, skills, hooks, commands, envoy.

**Skills**: claude-code-patterns, research-tools, claude-envoy-patterns, orchestration-idols, skills-development, subagents-development, hooks-development, commands-development, discovery-mode

**Key patterns**:
- Context efficiency (minimal sufficient context)
- Envoy context triad (return data, input data, stored data)
- Discovery vs implementation separation

### planner

Planning specialist creating prompts from specialist findings.

**Modes**: create, refine, quick

**Key commands**:
- `envoy plan write-plan` - create plan metadata
- `envoy plan write-prompt` - create prompt files
- `envoy plan block-plan-gate` - user approval

### researcher

External research via web APIs.

**Skills**: research-tools

**Tools**:
- `envoy perplexity research` - deep synthesis
- `envoy tavily search/extract` - web search
- `envoy xai search` - X/Twitter insights

### surveyor

Generic codebase discovery fallback. Used when no domain specialist matches.

**Pattern**: Glob/Grep discovery -> Read key files -> Pattern analysis -> Concise findings

### worker

Generic implementation fallback. Used when no domain specialist matches.

**Pattern**: Gather context -> Plan -> Implement -> Test -> Return summary

### code-simplifier

Refines code for clarity/consistency. Applies project standards from CLAUDE.md.

**Focus**:
- Preserve functionality
- Apply project standards
- Enhance clarity (avoid nested ternaries)
- Maintain balance (avoid over-simplification)

### documentation-taxonomist

Plans documentation by analyzing codebase structure.

**Commands**:
- `envoy docs tree` - structure with coverage
- `envoy docs complexity` - complexity metrics

**Output**: Non-overlapping segments with depth guidance

### documentation-writer

Writes documentation with LSP symbol references.

**Commands**:
- `envoy docs format-reference` - get symbol ref with hash

**Pattern**: Worktree isolation -> Analyze source -> Write docs with refs -> Commit

## Edge Cases

- **Subagents cannot use AskUserQuestion**: All user interaction in main agent
- **Context limit**: Agents at ~50% context should return early with partial results
- **Envoy failures**: Agents infer recovery based on workflow context
- **Skill loading**: Without skills field, agent has no specialized knowledge
