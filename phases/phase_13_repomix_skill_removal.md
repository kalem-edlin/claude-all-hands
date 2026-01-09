# Phase 13: Repomix Skill Removal

## Objective
Remove repomix-extraction skill from agent workflows. Agents use vanilla Claude Code discovery tools (grep, glob, read) instead of prescriptive repomix extraction. Envoy CLI repomix commands remain available for direct human/main-agent invocation.

## Rationale
- Repomix positioned as context-saver but actually overcomplicates deterministic workflow orchestration
- Discovery agents should be context-hungry for their purpose (gathering info)
- Implementation agents should focus on reading instructions, not additional extraction
- Arbitrary 50% context rule isn't deterministically trackable
- Future: lean into LSP support for smarter discovery
- Agents naturally use grep/read/glob via RLHF - no explicit tooling needed

## Scope
- Delete repomix-extraction skill
- Update agent declarations (remove skill reference)
- Update protocols (remove repomix workflow steps)
- Update related skills (remove repomix mentions)
- Keep envoy repomix CLI commands (for direct usage, not agent workflows)

## Implementation Details

### 1. Delete Skill Directory
```
rm -rf .claude/skills/repomix-extraction/
```

---

### 2. Update Agent Declarations

#### .claude/agents/curator.md
Remove `repomix-extraction` from skills frontmatter (keep research-tools)

#### .claude/agents/surveyor.md
Remove `repomix-extraction` from skills frontmatter

#### .claude/agents/worker.md
Remove `repomix-extraction` from skills frontmatter

#### .claude/agents/documentor.md
Remove `repomix-extraction` from skills frontmatter

---

### 3. Update Protocols

#### .claude/protocols/discovery.yaml
Remove any workflow steps that reference repomix extraction. Replace with generic guidance like "gather relevant codebase files" or remove step entirely if redundant.

---

### 4. Update Related Skills

#### .claude/skills/implementation-mode/SKILL.md
Remove repomix references. Implementation agents read instructions and relevant files directly.

#### .claude/skills/discovery-mode/SKILL.md
Remove repomix references. Discovery agents use standard file discovery tools.

#### .claude/skills/subagents-development/SKILL.md
Remove repomix skill from examples/documentation

#### .claude/skills/subagents-development/references/subagents.md
Remove repomix skill from agent skill tables/examples

---

### 5. Keep Envoy CLI Commands (NO CHANGES)
These files remain unchanged - CLI-level repomix is still valid:
- `.claude/envoy/src/commands/repomix.ts`
- `.claude/envoy/src/lib/repomix.ts`
- `.claude/envoy/src/lib/index.ts` (export stays)

---

### 6. Settings.json Review
Check `.claude/settings.json` for any repomix-specific settings that should be removed if they only applied to the skill workflow.

---

## Cross-Phase Context

### Prior Phases
- Phase 10 (Agents): Agent skill assignments now simplified
- Phase 12 (Hooks): Startup validation will no longer expect repomix-extraction skill

### FULL_PLAN.md
Already updated:
- Skills table: repomix-extraction removed from all agents
- Workflow steps: generic "gather relevant files" language
- Agent descriptions: repomix mentions removed

---

## Success Criteria
- [ ] .claude/skills/repomix-extraction/ deleted
- [ ] curator.md skills frontmatter updated
- [ ] surveyor.md skills frontmatter updated
- [ ] worker.md skills frontmatter updated
- [ ] documentor.md skills frontmatter updated
- [ ] discovery.yaml protocol updated
- [ ] implementation-mode/SKILL.md updated
- [ ] discovery-mode/SKILL.md updated
- [ ] subagents-development files updated
- [ ] Envoy CLI repomix commands preserved and functional
- [ ] No broken skill references in codebase
