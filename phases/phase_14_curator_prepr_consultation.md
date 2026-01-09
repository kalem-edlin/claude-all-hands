# Phase 14: Curator Pre-PR Consultation

## ⛔ IMPLEMENTATION BLOCKED

**Do not implement this phase until the following section is filled out.**

The curator pre-PR review requires detailed guidance on:
- What patterns indicate staleness/invalidation in orchestration config
- How to leverage Context7 MCP for external documentation queries
- How to use LSP for semantic understanding of new types/interfaces
- Specific heuristics for detecting when specialists need updates
- Decision criteria for "new skill" vs "update existing skill" vs "ignore"

Until this guidance exists, curator lacks the information needed to make useful recommendations. This phase is currently a **design document only**.

### Required Before Implementation
```
[ ] Context7 MCP integration available and documented
[ ] LSP support for type/interface discovery
[ ] Staleness detection heuristics defined (below)
[ ] Invalidation patterns documented (below)
```

### Staleness/Invalidation Patterns (TO BE FILLED)
<!--
Fill this section with:
- How to detect when a specialist's domain_files are stale
- How to detect when a skill references outdated patterns
- How to detect when new deps introduce capabilities specialists should know
- How to cross-reference commit history with orchestration config changes
-->

---

## Objective
Curators review feature branch diffs before PR creation to identify improvements to the agentic orchestration system (agents, skills, hooks, commands, protocols).

## Rationale
Feature development often introduces new technologies, patterns, or dependencies that specialists should know about. Without systematic review, orchestration system falls out of sync with codebase evolution.

## Scope
- Add curator consultation step in `/continue` workflow (between documentation audit and `envoy plan complete`)
- Curator reviews git diff against base branch
- Curator proposes orchestration improvements (if any)
- User decides what to implement before PR

---

## Implementation Details

### 1. Workflow Step (in /continue)
After step 8 (documentation audit), before step 9 (plan complete + PR):

```
8.5. Pre-PR Review (parallel agents):
    * Delegate in PARALLEL:
        a) **curator agent** with **pre-pr-review** workflow
           * INPUTS: `{ feature_branch: <current_branch> }`
           * OUTPUTS: `{ recommendations: [...], has_changes: boolean }`
        b) **code-simplifier agent** with **simplification-review** workflow
           * INPUTS: `{ feature_branch: <current_branch> }`
           * OUTPUTS: `{ simplifications: [...], has_changes: boolean }`

    * After both return:
        * Present curator recommendations (orchestration improvements)
        * Present code-simplifier suggestions (complexity reduction)
        * User decides per item: (I)mplement, (D)efer, (S)kip
        * If implement: delegate to respective agent, commit
        * If defer: add to plan's curator.md / technical-debt tracking
        * If skip: continue without changes
```

---

### 2. Code-Simplifier Review Scope

Runs in parallel with curator. Reviews diff for complexity that can be reduced:

| Category | What to Check | Potential Action |
|----------|--------------|------------------|
| **Over-abstraction** | Unnecessary indirection, premature generalization | Inline or flatten |
| **Dead code** | Unused exports, unreachable branches | Remove |
| **Redundant patterns** | Duplicate logic across files | Extract shared util or inline |
| **Complex conditionals** | Nested ifs, long boolean chains | Simplify or extract to named fn |
| **Large functions** | Functions > ~50 lines | Split into focused units |
| **Unnecessary deps** | New deps that replicate existing functionality | Use existing or stdlib |

---

### 3. Curator Review Scope

When reviewing diff, curator looks for:

| Category | What to Check | Potential Action |
|----------|--------------|------------------|
| **New Dependencies** | New packages in package.json, imports from new libs | Update relevant specialist's domain knowledge |
| **New Directories/Patterns** | New src/ subdirectories, new file patterns | Update specialist's domain_files, add glob patterns |
| **New Technologies** | New frameworks, APIs, services | Consider new specialist or skill |
| **New CLI Commands** | New scripts in package.json, new CLI tools | Add to envoy commands or hooks |
| **New Protocols/Workflows** | Recurring multi-step patterns | Consider protocol extraction |
| **Documentation Patterns** | New doc formats, conventions | Update documentor skills |

---

### 4. Proposed Approaches (Simple → Complex)

#### Approach A: Full Branch History + LLM Inference (Recommended for Now)
- Curator gets full feature branch commit history (`git log <base>..HEAD`)
- Curator gets `envoy git diff-base` (full diff, not just summary)
- Reviews commits + changes against current orchestration config
- Uses existing knowledge + LLM reasoning to identify gaps
- **Pro**: Works now, no new tooling; commit messages provide intent context
- **Con**: Quality depends on curator's prompt quality; large branches = large context

#### Approach B: Structured Checklist
- Define explicit checklist of things curator always checks
- Curator walks through checklist against diff
- Reports findings per category
- **Pro**: Consistent, predictable
- **Con**: May miss novel patterns

#### Approach C: Context7 MCP Integration (Future)
- When Context7 MCP available, curator can query external docs
- Verify new deps have proper handling
- Check for breaking changes in updated deps
- **Pro**: External knowledge enrichment
- **Con**: Depends on tool availability

#### Approach D: LSP-Enhanced Review (Future)
- Use LSP to understand new type definitions, interfaces
- Identify new public APIs that specialists should know
- **Pro**: Precise, semantic understanding
- **Con**: Requires LSP integration

---

### 5. Curator Pre-PR Protocol

```yaml
# .claude/protocols/curator-prepr.yaml
name: pre-pr-review
description: Review feature branch before PR for orchestration improvements

steps:
  1: |
    Get full feature branch context:
    - Commit history: `git log $(envoy git get-base-branch)..HEAD --oneline`
    - Full diff: `envoy git diff-base`

  2: |
    Identify changed file patterns:
    - New directories created
    - New file types introduced
    - New dependencies added

  3: |
    Cross-reference against orchestration config:
    - Read all agent definitions (.claude/agents/*.md)
    - Read skill definitions (.claude/skills/*/SKILL.md)
    - Read protocols (.claude/protocols/*.yaml)

  4: |
    Generate recommendations:
    - Which specialist(s) need domain updates?
    - Any new skill opportunities?
    - New envoy command needs?
    - Hook opportunities?

  5: |
    Return findings:
    {
      recommendations: [
        { type: "agent_update", target: "<agent>", change: "<description>" },
        { type: "new_skill", name: "<name>", rationale: "<why>" },
        { type: "new_command", name: "<name>", purpose: "<why>" },
        { type: "deferred", note: "<what to track>" }
      ],
      has_changes: boolean
    }
```

---

### 6. Decision Flow

```
┌─────────────────────────────────────┐
│     PARALLEL AGENT DISPATCH         │
├──────────────────┬──────────────────┤
│  Curator Agent   │  Code-Simplifier │
│  reviews diff    │  reviews diff    │
│  for orchestr.   │  for complexity  │
└────────┬─────────┴────────┬─────────┘
         │                  │
         └────────┬─────────┘
                  ▼
         Both agents return
                  │
                  ▼
    Any recommendations? ──No──► Continue to PR
                  │
                 Yes
                  │
                  ▼
    Present to user:
    "Pre-PR Review found:"
    - Curator: [orchestration improvements]
    - Simplifier: [complexity reductions]
                  │
                  ▼
    User chooses per item:
    (I)mplement - respective agent makes changes
    (D)efer - track in curator.md / tech-debt
    (S)kip - ignore, continue
                  │
                  ▼
    If any implemented: commit changes
                  │
                  ▼
    Continue to PR
```

---

## Cross-Phase Context

### Phase 11 (Slash Commands)
Update `/continue` workflow to include this step.

### Phase 10 (Agents)
Curator agent already exists; this adds a new workflow mode.

### Phase 9 (Protocols)
Add `curator-prepr.yaml` protocol.

---

## Deferred Considerations

### When Context7 MCP Available
- Curator can query package documentation
- Verify proper usage of new dependencies
- Check for known issues/deprecations

### When LSP Support Matures
- Curator can understand new type definitions
- Identify new public interfaces
- Semantic understanding of code changes

---

## Success Criteria
- [ ] Curator consultation step added to /continue workflow
- [ ] curator-prepr.yaml protocol created
- [ ] Curator can read diff summary and generate recommendations
- [ ] User can implement/defer/skip recommendations
- [ ] Implemented changes committed before PR
- [ ] Deferred items tracked in curator.md
