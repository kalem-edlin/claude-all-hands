---
description: Generate XML handoff document for session continuity
argument-hint: [--save]
---

<objective>
Generate structured XML handoff document capturing session state for seamless context transfer to next session. Prevents knowledge loss and repeated work.
</objective>

<quick_start>
1. Gather git status, branch, recent commits
2. Extract completed/remaining work from plan
3. Document failed approaches and critical context
4. Output XML to chat (or save to file with --save)
</quick_start>

<success_criteria>
- XML document captures all session work and state
- Failed approaches documented with WHY they failed
- Critical non-obvious context preserved
- Next session can resume without rediscovery
</success_criteria>

<process>

## Output Format

```xml
<handoff>
  <work_completed>
    <!-- Bullet list of completed tasks/changes this session -->
  </work_completed>

  <work_remaining>
    <!-- Bullet list of outstanding tasks from plan -->
  </work_remaining>

  <attempted_approaches>
    <!-- Any approaches tried that failed or were abandoned -->
    <!-- Include WHY they failed to prevent repetition -->
  </attempted_approaches>

  <critical_context>
    <!-- Non-obvious discoveries, constraints, or decisions -->
    <!-- Things that would be lost without explicit capture -->
  </critical_context>

  <current_state>
    <!-- Git status, branch, uncommitted changes -->
    <!-- Any blockers or pending decisions -->
  </current_state>
</handoff>
```

## Execution

### Step 1: Gather Session Context

Analyze:
1. Current git branch and status
2. Recent commits (if on feature branch)
3. Plan file contents (if exists at `.claude/plans/<branch>/plan.md`)
4. Any uncommitted changes

### Step 2: Extract Work Status

From plan file (if exists):
- `[x]` items → work_completed
- `[ ]` items → work_remaining

From session memory:
- What was attempted this session
- What succeeded vs failed
- Why failures occurred

### Step 3: Identify Critical Context

Capture:
- Design decisions made and rationale
- Discovered constraints or gotchas
- Dependencies or blockers identified
- Any deviations from plan and why

### Step 4: Document Current State

```bash
git status
git branch --show-current
git log --oneline -5  # if on feature branch
```

### Step 5: Generate Output

If `--save` argument provided:
- Save to `.claude/plans/<branch>/handoff.md`
- Confirm: "Handoff saved to .claude/plans/<branch>/handoff.md"

Otherwise:
- Output XML directly to chat for copy/paste

</process>

<constraints>
- ALWAYS include WHY for failed approaches - prevents repetition
- NEVER omit critical_context section - even if "none" is the value
- Be specific in work_completed: include file paths, commit hashes
</constraints>

## Usage Examples

**End of session:**
```
/whats-next
```
Outputs XML to chat for next session.

**Save for later:**
```
/whats-next --save
```
Persists to plan directory.

## Section Guidelines

### work_completed
- Be specific: "Added intake gate to /plan command" not "made changes"
- Include file paths modified
- Note commits made

### work_remaining
- Pull directly from plan's unchecked items
- Add any discovered tasks not in original plan

### attempted_approaches
- ONLY include if something failed or was abandoned
- Always include WHY: "X failed because Y"
- This prevents next session from repeating mistakes

### critical_context
- Non-obvious information that isn't in code comments
- Verbal agreements or decisions
- External constraints discovered
- "If I forget this, I'll waste time rediscovering it"

### current_state
- Factual: branch, status, blockers
- Any pending questions awaiting user input
