---
name: specialist-builder
description: Use when user asks to "create an agent", "add a subagent", or needs guidance on agent frontmatter, triggering examples, system prompts, tools, or colors.
---

# Specialist Builder

Build specialist agents tailored to repository domains.

For initial research this is a great researouce of specialist plugins (which ship agents with their commands and skills) (see their agent.md files):
**https://github.com/wshobson/agents/tree/main/plugins**

## When Triggered

Main agent calls curator with this skill when:
- No existing specialists match user's prompt domain
- User confirms they want to architect a specialist
- User says "create an agent", "add an agent", "write a subagent"

## Process

### Inference Logic

When curator invocation already specifies details, skip those questions:
- Specialist name specified → skip name confirmation
- Source directories specified → skip directory question
- Specific domain described → skip option proposal, go direct to requirements

### 1. Research Phase (required)

Before proposing options, research the domain:
- Use research-tools skill to query best practices for the inferred domain
- Gather documentation URLs for the specialist's area of focus
- Synthesize findings for system prompt inclusion

**AskUserQuestion**: "What documentation should this specialist learn from?"
- Option A: [Inferred docs based on domain]
- Option B: I'll provide specific URLs
- Option C: Skip documentation research

### 2. Extract Repo Patterns

Use repomix-extraction skill to understand existing patterns:

**AskUserQuestion**: "Which directories contain patterns this specialist should learn?"
- Option A: [Inferred directory from prompt context]
- Option B: Browse repository (I'll suggest directories)
- Option C: Skip (no repo patterns needed)
- Option D: New directory (specialist for new feature set)

If directories specified:
1. Use repomix-extraction skill to pack and analyze
2. Extract patterns for system prompt embedding

### 3. Confirm Name

Suggest specialist name based on domain/scope:

**AskUserQuestion**: "[suggested-name]?"
- Option A: Yes, use this name
- Option B: I'll provide a different name

### 4. Propose Options (if not already specified)

Use **AskUserQuestion** to present specialist options:

```
Based on your prompt, these specialist types could help:

1. [Domain] Specialist - [what it would handle]
2. [Domain] Specialist - [what it would handle]
3. Custom - describe your own
```

### 5. Gather Requirements

After user selects, use **AskUserQuestion** for each:

**Scope**: "What specific areas should this specialist cover?"
- Option A: [narrow scope]
- Option B: [broader scope]
- Option C: Custom

**Agent Pattern**: "What type of agent is this?"
- Analysis (code review, security audit, research)
- Generation (code, tests, docs)
- Validation (linting, checking, verification)
- Orchestration (multi-step workflows)

**Skills**: "What skills should this specialist have access to?"
- repomix-extraction (always included for pattern discovery)
- research-tools (web search, documentation)
- claude-code-patterns (Claude Code best practices)
- Custom skill (will need to be built)

**Tools**: "What tools does this specialist need?"
- Read-only (Read, Glob, Grep) - for analysis/research
- With Bash - for running commands
- Full access - omit tools field to inherit all

### 6. Generate Agent Definition

Return to main agent with proposed agent file following the structure below.

**Pattern Embedding**: If repo patterns extracted, include in system prompt:
```
This specialist has learned patterns from: {directories}

**[Domain] Patterns:**
- File structure: {pattern}
- Naming: {pattern}
- Code style: {pattern}

Apply these patterns when {doing agent's task}.
```

### 7. Create Maintenance Skill (auto)

Auto-create companion directive skill for every specialist:

**File**: `.claude/skills/{specialist-name}-maintenance/SKILL.md`

```yaml
---
name: {specialist-name}-maintenance
description: Directives for maintaining {specialist-name} agent. Use when updating specialist knowledge.
---

# {Specialist Name} Maintenance

## Pattern Sources
Directories: {list of directories}

## Embedded Patterns
{High-level summary of extracted patterns}

## Update Process
1. Re-run repomix on source directories
2. Analyze for new/changed patterns
3. Update agent system prompt
```

### 8. Offer Custom Skill Creation

If custom skill selected in requirements:
"This specialist needs a custom skill. Would you like to define it now?"
- If yes: use skill-development skill to create it
- If no: note as TODO in agent file

## Agent File Structure

### Complete Format

```markdown
---
name: agent-identifier
description: |
  [Role description with trigger keywords and responsibility scope].

  <example>
  user: "trigger1 | trigger2 | trigger3"
  </example>
model: inherit
color: blue
allowed-tools: Read, Glob, Grep
skills: repomix-extraction, skill-name
---

You are [agent role description]...

**Your Core Responsibilities:**
1. [Responsibility 1]
2. [Responsibility 2]

**Process:**
[Step-by-step workflow]

**Output Format:**
[What to return]
```

## Frontmatter Fields

### name (required)

Agent identifier used for namespacing and invocation.

**Format:** lowercase, numbers, hyphens only
**Length:** 3-50 characters
**Pattern:** Must start and end with alphanumeric

**Good examples:**
- `code-reviewer`
- `test-generator`
- `api-docs-writer`

**Bad examples:**
- `helper` (too generic)
- `-agent-` (starts/ends with hyphen)
- `my_agent` (underscores not allowed)
- `ag` (too short)

### description (required)

Defines when Claude should trigger this agent. **Most critical field.**

**Must include:**
1. Concise description with trigger keywords and responsibility scope
2. ONE `<example>` block with variant syntax for compression

**Format (condensed pattern):**
```yaml
description: |
  [Role description with trigger keywords].

  <example>
  user: "trigger1 | trigger2 | trigger3"
  </example>
```

**Variant syntax:** Use `|` to separate trigger phrase variants within a single example. This compresses multiple triggering scenarios into minimal context.

**Example:**
```yaml
description: |
  Research specialist for web search, documentation lookup, external info gathering.

  <example>
  user: "Research [topic] | Find docs for [library] | What are best practices for [pattern]?"
  </example>
```

**Do NOT include:**
- Multiple `<example>` blocks (use variant syntax instead)
- `<commentary>` blocks (description conveys reasoning)
- Context or assistant response lines

See `references/triggering-examples.md` for additional patterns.

### model (required)

Which model the agent should use.

**Options:**
- `inherit` - Use same model as parent (recommended)
- `sonnet` - Claude Sonnet (balanced)
- `opus` - Claude Opus (most capable)
- `haiku` - Claude Haiku (fast)

### color (required)

Visual identifier for agent in UI.

**Guidelines:**
| Color | Use For |
|-------|---------|
| blue/cyan | Analysis, review |
| green | Success-oriented tasks |
| yellow | Caution, validation |
| red | Critical, security |
| magenta | Creative, generation |

### allowed-tools (optional)

Restrict agent to specific tools. **Principle of least privilege.**

**Common tool sets:**
- Read-only analysis: `Read, Grep, Glob`
- Code generation: `Read, Write, Grep`
- Testing: `Read, Bash, Grep`
- Full access: Omit field to inherit all

### skills (optional)

Skills to auto-load when agent starts. Comma-separated list.

## System Prompt Patterns

Four patterns for agent system prompts. See `references/system-prompt-patterns.md` for templates.

| Pattern | Use When |
|---------|----------|
| Analysis | Reviewing, auditing, researching |
| Generation | Creating code, tests, docs |
| Validation | Checking, verifying, linting |
| Orchestration | Multi-step workflows |

## AI-Assisted Agent Generation

For complex agents, use this prompt template:

```json
{
  "request": "[USER DESCRIPTION]",
  "requirements": {
    "core_intent": "Extract primary purpose",
    "persona": "Define expert role for domain",
    "system_prompt": {
      "behavioral_boundaries": true,
      "specific_methodologies": true,
      "edge_case_handling": true,
      "output_format": true
    },
    "identifier": "lowercase-hyphens, 3-50 chars",
    "description": "trigger keywords + ONE condensed example block",
    "example": "ONE <example> with variant syntax (trigger1 | trigger2 | trigger3)"
  }
}
```

## Key Principles

- Specialists are READ-ONLY - they return information, main agent implements
- Description must include WHEN to trigger (main agent uses this for dispatch)
- Keep scope focused - better to have multiple narrow specialists than one broad one
- Skills determine what knowledge/capabilities the specialist has access to
- Use ONE condensed `<example>` block with variant syntax (`|`) for trigger phrases

## Reference Files

| File | Content |
|------|---------|
| `references/triggering-examples.md` | Example block anatomy and patterns |
| `references/system-prompt-patterns.md` | Four agent pattern templates |
| `examples/complete-agent-examples.md` | Full working agent examples |
| `scripts/validate-agent.sh` | Validate agent file structure and content |

## Agent-Skill Workflow Pattern

When an agent has workflow skills, the agent profile should:
- Define the prompt pattern that triggers the skill
- Direct to "use" the skill (skills are automatically loaded into context)
- NOT duplicate the workflow steps

Example in agent file:
```markdown
## [Workflow Name]

When main agent asks to [prompt pattern], use the [skill-name] skill.
```

**Why this works:**
- Agent's `skills:` frontmatter lists skills to auto-load into context
- Main agent triggers agent based on description examples
- Agent body references skill by name - skill content already available
- No duplication: skill owns workflow logic, agent owns triggering conditions

This keeps agent files lean and workflow logic centralized in skills.
