---
description: Blocking gate system for human-in-the-loop feedback using YAML files, file watching, and structured feedback schemas with Zod validation.
---

# Gates and Feedback

## Overview

Critical decisions require human judgment. Gates provide blocking synchronization points where agents pause for user feedback. YAML files enable structured data collection, file watching detects completion, Zod schemas validate responses.

## Key Decisions

- **YAML for feedback files**: Human-editable format [ref:.claude/envoy/src/lib/gates.ts::783a982]. Users can open in any editor, modify structured fields, set done flag. No special tooling required.

- **done flag pattern**: Gates check done:true to proceed. Users set flag after providing feedback. Simple boolean avoids complex completion detection.

- **File watching with polling**: watchForDone() [ref:.claude/envoy/src/lib/watcher.ts::fc672da] polls for done flag. Works across filesystems, no inotify dependencies. 12-hour default timeout for long reviews.

- **Zod schema validation**: Each gate type has schema defining expected fields. Validates feedback on read, catches malformed responses early.

- **Sibling log files for testing/logging gates**: YAML file for structured feedback, .md sibling for pasting logs. Separates structured data from freeform content.

- **Gate-specific notification**: Each gate type sends appropriate notification. User alerted when input needed without checking terminal.

- **Automatic cleanup**: Feedback files deleted after processing. Prevents stale files from confusing future runs.

## Patterns

Gate types: findings (approach feedback), plan (prompt edits), testing (test results), variants (approach selection), logging (debug log review), audit_questions (oracle clarification), review_questions (oracle review clarification)

Write gate: create YAML with default values + done:false -> send notification -> return path
Block gate: call watchForDone(path, timeout) -> polls until done:true or timeout
Read gate: parse YAML with Zod schema -> return validated feedback or error
Cleanup: deleteFeedbackFile() removes YAML and sibling log file

Feedback incorporation: gates append user input to user_input.md, update plan/prompt front-matter with audit/review entries. Feedback becomes part of plan record.

## Use Cases

- Findings review: agent writes approaches, user provides feedback per approach, rejects some
- Plan approval: user reviews prompts, requests changes to specific prompts
- Testing gate: user runs implementation, pastes test output, marks passed/failed
- Variant selection: multiple implementations complete, user picks winner with reasoning
- Oracle questions: LLM needs clarification, questions written to YAML, user answers inline
