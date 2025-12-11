---
description: Review implementation against plan
argument-hint: [branch-name]
---

<objective>
Create and switch to a new branch, then initiate planning workflow if on a feature branch (non-direct mode).
</objective>

<quick_start>
1. Get branch name (ask if not provided)
2. Create branch and switch to it
3. If not direct-mode branch, run `/plan`
</quick_start>

<success_criteria>
- New branch created with given name
- Switched to new branch
- Planning initiated (if feature branch)
</success_criteria>

<process>

If the branch name is not provided, you MUST use AskUserQuestion to ask for the branch name.

Create a new branch with the given name and switch to it.

If the branch name is not one of "main", "master", "develop", "staging", "production", or starts with "quick/" (ie not in direct mode), run `/plan` to start planning.

</process>

<constraints>
- MUST ask for branch name if not provided
- Direct-mode branches: main, master, develop, staging, production, quick/*
- Non-direct-mode branches trigger `/plan` automatically
</constraints>
