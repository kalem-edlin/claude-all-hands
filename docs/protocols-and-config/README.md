---
description: Overview of agent protocols defining discovery and implementation workflows for feature development and debugging
---

# Protocols and Configuration

## Overview

This domain contains YAML-based protocol definitions that standardize agent workflows. Protocols define inputs, outputs, and step-by-step procedures for agents to follow during discovery and implementation phases.

## Key Concepts

- **Protocol**: A YAML file defining a workflow with inputs, outputs, and ordered steps
- **Extends**: Protocols can inherit from a base protocol (e.g., `debugging` extends `implementation`)
- **Steps**: Numbered procedures, can use `N+` notation to extend parent steps
- **Envoy Commands**: Protocols reference envoy CLI commands for plan management and coordination

## Architecture

```
protocols/
  discovery.yaml       # Base discovery workflow
  bug-discovery.yaml   # Discovery specialized for bugs (extends discovery)
  implementation.yaml  # Base implementation workflow
  debugging.yaml       # Debugging workflow (extends implementation)
```

### Protocol Inheritance

- `discovery.yaml` - Base protocol for feature requirement analysis
- `bug-discovery.yaml` - Extends discovery with bug-specific steps (compiler checks, hypothesis generation)
- `implementation.yaml` - Base protocol for feature implementation
- `debugging.yaml` - Extends implementation with debug logging and cleanup steps

## Entry Points

### Discovery Protocols

**discovery.yaml** - Feature requirement discovery
- Inputs: `agent_name`, `segment_context`, optional `approach_references`
- Output: Approaches written via `envoy plan write-approach`
- Key steps: Query docs, gather codebase context, generate approaches with variants

**bug-discovery.yaml** - Bug investigation discovery
- Same inputs as discovery
- Additional steps: Run compiler/linter checks, capture error context
- Approaches are framed as fix hypotheses

### Implementation Protocols

**implementation.yaml** - Feature implementation workflow
- Inputs: `prompt_num`, optional `variant`, `feature_branch`
- Outputs: `{ success: true, merged: true/false }`
- Key steps: Create worktree, implement from todo list, record walkthrough, review, test, merge

**debugging.yaml** - Debug-specific implementation
- Extends implementation with debug logging gates
- Uses `[DEBUG-TEMP]` markers for temporary logging
- Includes `envoy plan cleanup-debug-logs` step to remove markers

## Protocol Structure

Each protocol YAML contains:

```yaml
name: protocol-name
description: Brief description
extends: parent-protocol-or-null
inputs:
  - name: input_name
    type: string|integer|array
    optional: true|false
    description: What this input provides
outputs:
  - value: "{ success: true }"
    description: What this output means
steps:
  1: |
    Step description with envoy commands
  2+: |
    Extension step (adds to parent)
```

## Envoy Command Integration

Protocols reference these envoy plan commands:

| Command | Purpose |
|---------|---------|
| `envoy knowledge search docs` | Query documentation before implementation |
| `envoy plan write-approach` | Record discovery findings |
| `envoy plan read-prompt` | Get prompt context for implementation |
| `envoy plan start-prompt` | Begin prompt implementation |
| `envoy plan record-implementation` | Save implementation walkthrough |
| `envoy gemini review` | Request code review |
| `envoy plan block-prompt-testing-gate` | Wait for user testing |
| `envoy plan block-prompt-variants-gate` | Resolve variant selection |
| `envoy plan complete-prompt` | Mark prompt done |
| `envoy plan cleanup-debug-logs` | Remove debug markers |
