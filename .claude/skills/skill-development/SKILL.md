---
name: skill-development
description: Use when user asks to "create a skill", "build a new skill", "write skill instructions", "improve skill description", "organize skill content", or needs guidance on skill structure, progressive disclosure, or skill development best practices. (project)
---

<objective>
Guide creation of effective Claude Code skills with proper structure, progressive disclosure, and validation. Skills extend Claude's capabilities through specialized knowledge and workflows, packaged as discoverable capabilities invoked autonomously based on description triggers.
</objective>

<quick_start>
1. Create `.claude/skills/skill-name/SKILL.md`
2. Add frontmatter: `name` (lowercase-hyphenated) + `description` (trigger phrases)
3. Write body in imperative form (~500-700 words)
4. Add references/examples/scripts only if content exceeds body capacity
</quick_start>

<success_criteria>
- SKILL.md exists with valid YAML frontmatter
- `name`: lowercase-hyphenated, max 64 chars
- `description`: max 1024 chars, includes trigger phrases
- Body uses imperative form (not second person)
- Body ~500-700 words (excess moved to references/)
</success_criteria>

<constraints>
- Description MUST use "Use when..." format with specific triggers
- Body MUST use imperative/infinitive form (not "you should")
- Resources only created when necessary (most skills are SKILL.md only)
- Max 1024 chars for description field
</constraints>

## Skill Anatomy

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description)
│   └── Markdown body (~500-700 words target)
└── Bundled Resources (only if needed)
    ├── references/     - Detailed docs, loaded as needed
    ├── examples/       - Working code, copyable
    └── scripts/        - Utilities, executable
```

## Progressive Disclosure

| Level | Contents | When Loaded | Size Target |
|-------|----------|-------------|-------------|
| Metadata | name + description | Always | ~100 words |
| Body | SKILL.md content | Skill triggers | ~500-700 words |
| Resources | references/, examples/, scripts/ | As needed | Unlimited |

<workflow name="creation-process">

### Step 1: Understand Use Cases
- What specific phrases trigger this skill?
- What tasks does it help accomplish?
- What would a user say to invoke it?

### Step 2: Plan Reusable Contents
1. **Scripts**: Code rewritten repeatedly or needing deterministic reliability
2. **References**: Documentation Claude should consult while working
3. **Assets**: Files used in output (templates, images)

### Step 3: Create Structure
```bash
mkdir -p .claude/skills/skill-name
touch .claude/skills/skill-name/SKILL.md
```

### Step 4: Write SKILL.md

**Frontmatter**:
```yaml
---
name: skill-name          # lowercase-hyphenated, max 64 chars
description: Use when user asks to "create X", "configure Y". Provides [capability].
---
```

**Body structure**:
```markdown
# Skill Name

Overview (2-3 sentences).

## Quick Reference
Essential patterns, commands, key concepts.

## Key Workflows
Step-by-step procedures for main use cases.

## Additional Resources
- **`references/detailed-guide.md`** - Extended documentation
```

### Step 5: Validate
- [ ] SKILL.md exists with valid YAML frontmatter
- [ ] `name` field: lowercase-hyphenated, max 64 chars
- [ ] `description` field: max 1024 chars, includes triggers
- [ ] Body uses imperative form
- [ ] Body ~500-700 words

### Step 6: Iterate
1. Notice struggles or inefficiencies during use
2. Identify improvements
3. Implement changes
4. Test again

</workflow>

## Degrees of Freedom

| Level | When to Use | Example |
|-------|-------------|---------|
| High (text) | Multiple valid approaches | "Generate appropriate tests" |
| Medium (parameterized) | Preferred pattern exists | Script with configurable params |
| Low (exact) | Fragile/critical ops | Exact shell commands |

<examples>

### Weak Trigger Description
**Bad**:
```yaml
description: Provides guidance for working with hooks.
```

**Good**:
```yaml
description: Use when user asks to "create a hook", "add a PreToolUse hook", "validate tool use". Provides hooks API guidance.
```

### Second Person Writing
**Bad**: "You should start by reading the configuration."

**Good**: "Start by reading the configuration."

### Skill Structures

**Minimal**:
```
skill-name/
└── SKILL.md
```

**Standard** (Recommended):
```
skill-name/
├── SKILL.md
├── references/
│   └── detailed-guide.md
└── examples/
    └── working-example.sh
```

</examples>

## Additional Resources

### Reference Files
- **`references/progressive-disclosure.md`** - Directory structure patterns
- **`references/writing-style.md`** - Imperative form rules

### Examples
- **`examples/complete-skill-examples.md`** - Annotated complete skills

### Scripts
- **`scripts/validate-skill.sh`** - Validate skill file structure
