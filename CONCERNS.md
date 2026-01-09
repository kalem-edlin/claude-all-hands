# System Concerns & Mitigations

Track concerns, watch for symptoms, apply fixes if needed.

---

## 1. CLI-based Approach Writing May Yield Low-Quality Context

**A. Concern:**
Discovery agents write approaches via `envoy plan write-approach --context "..."`. LLMs tend to truncate content in CLI args vs file writes. Critical pseudocode/details may be too brief.

**B. Watch For:**
- Approaches missing pseudocode in `approach_detail`
- Vague 1-2 sentence contexts instead of detailed implementation notes
- Missing file references or best practice comments
- Planner struggling to build prompts from sparse approach data

**C. Solutions If Seen:**
1. Switch to template-fill pattern: `envoy plan init-approach` creates template, agent uses Edit tool, `envoy plan validate-approach` checks structure
2. Add `--context-file` flag to accept file path instead of inline string
3. Add validation that rejects approaches under N characters/missing required sections

---

## 2. [Template for Future Concerns]

**A. Concern:**
[Description]

**B. Watch For:**
- [Symptom 1]
- [Symptom 2]

**C. Solutions If Seen:**
1. [Fix 1]
2. [Fix 2]
