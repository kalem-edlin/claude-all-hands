---
description: Agent specialization patterns for Claude Code - role-based isolation, capability scoping, and delegation boundaries.
---

# Agent Specialization

## Overview

Agents provide specialized execution contexts with scoped capabilities. Rather than one monolithic agent, the system decomposes into focused specialists - curator for orchestration, researcher for external information, writers for documentation. This separation enforces clean boundaries and prevents capability creep.

## Key Decisions

- **Role-based isolation**: Each agent owns a distinct responsibility domain. The curator [ref:.claude/agents/curator.md::1c0097c] owns all orchestration infrastructure. The researcher [ref:.claude/agents/researcher.md::1c0097c] owns external information gathering. Prevents agents from overstepping into areas where they lack expertise.

- **Tool restriction by role**: Agents receive only tools necessary for their function. Researcher gets read-only tools plus bash for envoy commands - cannot write files. Documentation writers get full file operations. This least-privilege model prevents accidental cross-domain actions.

- **Discovery vs implementation split**: Agents that gather information NEVER implement. Researcher discovers patterns but returns findings to main agent. This prevents context pollution where discovery artifacts leak into implementation.

- **Skills as capability injection**: Rather than duplicating knowledge across agents, skills [ref:.claude/skills/skills-development/SKILL.md::4dcde68] provide domain expertise on demand. Agent declares which skills it uses; those get loaded into context when agent runs.

## Patterns

**Specialist routing**: Main agent selects specialists based on description field keywords. Descriptions include trigger phrases that help routing decisions. Example: curator description includes "ALWAYS DELEGATE for: .claude/, CLAUDE.md, hooks, skills" to ensure orchestration tasks route correctly.

**Subagent black-box execution**: Agents run in isolated contexts. User never sees intermediate steps - only final output returns to main conversation. This means subagents cannot ask clarifying questions; all requirements must be gathered before delegation.

**Protocol-based workflows**: Complex agents define input/output contracts. Curator expects `{ mode: 'create' | 'audit', artifact_type: 'specialist' | 'skill', initial_context: string }` and returns `{ success: true, clarifying_questions?: string[] }`. This enables deterministic delegation.

## Use Cases

- **Orchestration changes**: User wants to modify CLAUDE.md or create a new agent. Main agent delegates to curator, which uses /claude-code-patterns skill for current best practices, makes changes, returns confirmation.

- **External research**: User needs API documentation or library patterns. Main agent delegates to researcher, which uses envoy research tools, synthesizes findings, returns actionable summary without implementation.

- **Parallel documentation**: Large codebase needs docs. Taxonomist segments into domains, spawns up to 15 documentation-writer agents in parallel [ref:.claude/agents/documentation-writer.md::1c0097c], each writing to non-overlapping directories.
