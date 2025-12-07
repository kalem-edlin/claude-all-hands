---
description: Begin planning workflow for current feature branch
---

# Planning Workflow

Run `envoy plans frontmatter` to get current status.

## If direct mode
Inform user: planning disabled on protected branches (main, master, develop, staging, production) and quick/* branches.

## If status is draft or active
Use the **AskUserQuestion** tool to ask: "Would you like to enter planning mode?"

**If user declines:**
- Run `envoy plans set-status deactivated`
- Planning skipped for remainder of session
- Proceed with user's original request without planning

**If user accepts:** Continue to Planning Flow below.

## Planning Flow

### Step 1: Gather Specialist Context
Check available agent descriptions for relevant specialists (exclude researcher agent).

**If relevant specialists found:**
- Dispatch to ALL relevant specialists in parallel
- Query each: "What repo context, patterns, or best practices are relevant to: {user's original prompt}?"
- Collect findings

**If NO relevant specialists found:**
- WARN user: "No specialist agents available for this domain."
- Use **AskUserQuestion**: "Would you like to architect a specialist agent for this area?"
  - If yes → delegate to curator agent with specialist-builder skill
  - If no → proceed without specialist context

### Step 2: Call Planner Agent
Package and send to planner agent:
- User's original prompt
- Specialist findings (if any)
- Current plan file path: `.claude/plans/<branch>/plan.md`

The planner agent will:
1. Convert prompt into specs (spec-driven development)
2. Incorporate specialist context
3. Research unknown technologies
4. Write plan to plan file
5. Run validation (`envoy vertex validate`)
6. Handle validation feedback loop
7. Ask user to approve and activate plan
8. When approved: run `envoy plans set-status active` AND `envoy plans clear-queries` to reset tracking

### Step 3: Implementation Handoff
Once planner returns with status=active:
- Read the plan file
- Begin delegating implementation tasks
- Mark tasks complete as you finish them

## Status Values
- `draft` → planning required, query tracking enabled
- `active` → plan approved, implementation allowed, query tracking disabled
- `deactivated` → user opted out this session, query tracking disabled (resets on new session)
