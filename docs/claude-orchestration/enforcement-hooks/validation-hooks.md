---
description: Artifact validation hooks - startup validation, scan patterns, frontmatter requirements, skill reference checking.
---

# Validation Hooks

## Overview

Validation hooks ensure orchestration artifacts meet structural requirements. They run at session start, scanning agents, skills, and commands for common configuration errors. Early validation prevents runtime failures from malformed artifacts.

## Key Decisions

- **Session start validation**: The startup.sh hook [ref:.claude/hooks/startup.sh::e303012] triggers validate_artifacts.py [ref:.claude/hooks/validate_artifacts.py::e99bf1f] at session start. Errors appear immediately as system messages, not mid-workflow failures. User sees warnings before starting work.

- **Unified vs granular scanners**: System has both unified validator (validate_artifacts.py) and individual scanners (scan_agents.py [ref:.claude/hooks/scan_agents.py::e99bf1f], scan_skills.py [ref:.claude/hooks/scan_skills.py::e99bf1f], scan_commands.py [ref:.claude/hooks/scan_commands.py::e99bf1f]). Unified runs on startup; granular available for targeted validation or debugging.

- **Warning over blocking**: Validation errors emit systemMessage warnings but don't prevent session start (exit 0 always). This allows work to continue while alerting to issues. Some errors may be acceptable during development.

- **Frontmatter as contract**: All artifacts require YAML frontmatter with specific fields. Agents need description; skills need name matching directory and description; commands need description. This standardization enables tooling and discovery.

## Patterns

**Skill reference validation**: Agent validator checks that declared skills actually exist. If curator.md declares `skills: nonexistent-skill`, validation warns. Catches typos and stale references before runtime invocation fails.

**Name/filename consistency**: Skill validator ensures frontmatter name matches directory name. Agent validator checks frontmatter name (if present) matches filename. This consistency enables predictable lookups and prevents confusion.

**Aggregated reporting**: Validators collect all errors, emit single systemMessage with bulleted list. User sees complete picture rather than stopping at first error. Enables batch fixing.

## Use Cases

- **New session with broken skill**: User modified skill but introduced typo in name. Session starts → startup hook runs validators → warning appears: "skill/hooks-dev/SKILL.md: name 'hooks-development' != dir 'hooks-dev'" → user fixes before attempting to use skill.

- **Agent references deleted skill**: User deleted a skill directory but agent still references it. Session starts → validator scans agent skills → warns "agent/curator.md: skill 'deleted-skill' not found" → user updates agent or restores skill.

- **Command missing description**: User created command without frontmatter. Session starts → validator scans commands → warns "command/my-cmd.md: missing frontmatter" → user adds required YAML.
