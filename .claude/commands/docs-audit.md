---
description: Audit documentation for stale/invalid symbol references
argument-hint: [--fix] [optional docs path]
---

<objective>
Validate all documentation symbol references and optionally fix stale/invalid references. Uses `envoy docs validate` for detection and documentation-writer for fixes.
</objective>

<context>
Current branch: !`git branch --show-current`
</context>

<process>
<step name="parse_arguments">
Parse $ARGUMENTS:
- `--fix` flag: automatically fix issues after presenting findings
- Path: specific docs path to audit (default: docs/)
</step>

<step name="run_validation">
Run validation:
```bash
envoy docs validate [--path <docs_path>]
```

Parse output for:
- `stale`: references with outdated hashes
- `invalid`: references to non-existent symbols/files
- `total_refs`: count of all references
</step>

<step name="present_findings">
Present findings to user:

```markdown
## Documentation Audit Results

**Total references:** {total_refs}
**Stale:** {stale_count} (symbol changed since documentation)
**Invalid:** {invalid_count} (symbol/file no longer exists)

### Stale References
| Doc File | Reference | Stored Hash | Current Hash |
|----------|-----------|-------------|--------------|
| ... | ... | ... | ... |

### Invalid References
| Doc File | Reference | Reason |
|----------|-----------|--------|
| ... | ... | ... |
```

If no issues:
- Report "All references valid" and exit
</step>

<step name="user_decision">
If issues found and `--fix` not provided:

AskUserQuestion: "How should we handle these issues?"
Options:
- "Fix all" - Update stale hashes, remove/update invalid refs
- "Fix stale only" - Only update outdated hashes
- "Review individually" - Go through each issue
- "Skip" - Don't fix, just report

If `--fix` provided:
- Proceed to fix step automatically
</step>

<step name="delegate_fixes">
If user chooses to fix:

Delegate to **documentation-writer agent** with fix-workflow:

**INPUTS:**
```yaml
mode: "fix"
stale_refs: [<list of stale references to update>]
invalid_refs: [<list of invalid references to fix/remove>]
worktree_branch: "<current_branch>/docs-audit-fixes"
```

**OUTPUTS:**
```yaml
success: true
fixed: <count>
removed: <count>
```
</step>

<step name="commit_and_report">
If fixes were made:
- Merge worktree to current branch
- Clean up worktree

Report completion:
```markdown
## Audit Complete

- Fixed {fixed} stale references
- Removed/updated {removed} invalid references
- All references now valid
```

If standalone (not in workflow):
- Create PR with fixes
</step>
</process>

<success_criteria>
- Validation run on docs
- Findings presented clearly
- User decision collected (if not --fix)
- Fixes applied correctly
- All references valid after fixes
</success_criteria>

<constraints>
- MUST run validation first
- MUST present findings before fixing (unless --fix)
- MUST use documentation-writer for fixes
- MUST verify validation passes after fixes
- MUST clean up worktrees
- All delegations MUST follow INPUTS/OUTPUTS format
</constraints>
