---
description: Trigger this when the plan file requests its use WITHOUT USER INPUT
argument-hint: [--last-commit]
---

<objective>
Trigger automated checkpoint review during plan execution. Called by plan file markers, not user input. Validates progress and determines next steps.
</objective>

<quick_start>
Delegate immediately to planner agent with:
- Current branch name
- `--last-commit` flag if reviewing incremental changes
</quick_start>

<success_criteria>
- Planner has reviewed current state
- Plan status updated appropriately
- Next action determined (continue, pause, complete)
</success_criteria>

<process>

Delegate checkpoint review to planner agent.

Provide planner:
- Current branch name
- `--last-commit` if reviewing incremental changes

Planner handles full checkpoint workflow and returns status.

</process>

<constraints>
- DO NOT trigger manually - plan file requests this command
- DO NOT modify plan directly - planner agent handles all updates
</constraints>
