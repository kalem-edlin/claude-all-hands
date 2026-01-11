---
name: ui-ux-design
description: Delegates visual design work to Gemini agent via envoy spawn. Auto-triggered for UI styling, component design, CSS, Tailwind, layout, and visual enhancement tasks. Use when implementing designs from screenshots or enhancing component aesthetics.
---

<objective>
Enable Claude to delegate visual design work to a specialized Gemini agent while retaining control over functional implementation. Claude builds structure and logic; Gemini enhances aesthetics.
</objective>

<quick_start>
```bash
# One-shot: spawn, execute, kill
envoy spawn gemini-ui-ux "Add beautiful styling to this component"

# Persistent session with design reference
envoy spawn gemini-ui-ux "Recreate this design" --persistent --images design.png
# Returns: { pid: 12345, response: "..." }

# Multiple images (reference + component states)
envoy spawn gemini-ui-ux "Match main design with hover state" --persistent --images design.png mockup-hover.png

# Follow-up using PID
envoy spawn gemini-ui-ux "Add hover animations" --pid 12345

# Kill when done
envoy spawn kill 12345
```
</quick_start>

<workflow>
### 1. Claude: Understand Structure
Read design images/screenshots to understand:
- Component hierarchy and relationships
- Functional requirements (buttons, inputs, forms)
- State logic needed (hover, active, disabled)

### 2. Claude: Build Functional Boilerplate
Create:
- Semantic HTML structure
- Component scaffolding (React/Vue/etc.)
- State management and event handlers
- Basic accessible markup

### 3. Claude: Delegate Visual Design
```bash
# With design reference
envoy spawn gemini-ui-ux "Enhance this component to match design" \
  --persistent --images /path/to/design.png

# Without reference (general enhancement)
envoy spawn gemini-ui-ux "Add modern styling with subtle shadows and transitions" \
  --persistent
```

### 4. Claude: Review Changes
After Gemini returns, review:
- CSS/Tailwind classes applied
- Animation and transition quality
- Consistency with design system
- Accessibility preserved

### 5. Claude: Iterate (conditional)
```bash
# Refine with follow-ups
envoy spawn gemini-ui-ux "Add hover states to buttons" --pid 12345
envoy spawn gemini-ui-ux "Increase contrast on labels" --pid 12345
```

### 6. Claude: Session Lifecycle (conditional)

**Standalone UI task** (no active plan/todo list with multiple UI items):
```bash
# Kill session when satisfied with this task
envoy spawn kill 12345
```

**Multi-step workflow** (part of larger plan with multiple UI tasks):
```bash
# DON'T kill - return PID to calling agent for reuse
# Calling agent tracks PID across plan steps
# Kill only on FINAL UI task in workflow
```
</workflow>

<workflow_context_detection>
**Detecting external workflow context:**

| Indicator | Session Behavior |
|-----------|------------------|
| Active todo list with multiple UI items | Persistent across steps |
| Plan file with multiple UI tasks | Persistent across steps |
| Single user request, no active plan | Kill when satisfied |
| Calling agent provides existing PID | Reuse, don't spawn new |

**First UI task in workflow:**
```bash
envoy spawn gemini-ui-ux "<task>" --persistent --images design.png
# Return PID to main agent: { pid: 12345, summary: "..." }
```

**Subsequent UI tasks in workflow:**
```bash
# Receive PID from main agent
envoy spawn gemini-ui-ux "<next task>" --pid 12345
# Return summary only (PID unchanged)
```

**Final UI task in workflow:**
```bash
envoy spawn gemini-ui-ux "<final task>" --pid 12345
envoy spawn kill 12345
# Return confirmation session closed
```
</workflow_context_detection>

<workflow_examples>
**Example: Standalone task**
```
User: "Style this login form to look modern"
  → spawn --persistent
  → iterate until satisfied
  → kill session
```

**Example: Multi-step plan**
```
Plan step 1: "Style header component"
  → spawn --persistent, return PID to main agent

Plan step 2: "Style navigation menu"
  → receive PID, use --pid, return summary

Plan step 3: "Style footer component" (final UI task)
  → receive PID, use --pid, kill session
```

**Note**: Main agent is responsible for tracking PID across plan steps. This skill returns PID on spawn; main agent passes it back on subsequent invocations.
</workflow_examples>

<command_reference>
| Command | Purpose |
|---------|---------|
| `envoy spawn gemini-ui-ux "<task>"` | One-shot: spawn, execute, kill |
| `envoy spawn gemini-ui-ux "<task>" --persistent` | Creates session, returns PID |
| `envoy spawn gemini-ui-ux "<task>" --persistent --images <path>` | Session with visual reference (single image) |
| `envoy spawn gemini-ui-ux "<task>" --persistent --images <p1> <p2>` | Session with multiple images |
| `envoy spawn gemini-ui-ux "<task>" --pid <N>` | Follow-up in existing session |
| `envoy spawn gemini-ui-ux "<task>" --cwd <dir>` | Set working directory |
| `envoy spawn kill <pid>` | Terminate session |
| `envoy spawn list` | List active sessions |
</command_reference>

<when_to_use>
**Use this skill when:**
- Implementing UI from design mockups/screenshots
- Creating styled components (buttons, cards, modals)
- Adding CSS/Tailwind styling to functional code
- Enhancing visual polish (shadows, gradients, animations)
- Building layouts (grid, flexbox compositions)
- Working with: *.tsx, *.jsx, *.css, *.html, *.vue, *.svelte

**Skip this skill when:**
- Pure logic changes (no visual component)
- Simple CSS tweaks (single color/padding change)
- Performance optimization
- Backend/API work
- Test files
</when_to_use>

<division_of_labor>
| Claude Handles | Gemini Handles |
|----------------|----------------|
| Component structure | Color schemes |
| State management | Typography choices |
| Event handlers | Spacing/layout fine-tuning |
| Accessibility attrs | Animations/transitions |
| Form validation | Shadows/gradients |
| Data binding | Hover/focus states |
| Error states | Visual consistency |
</division_of_labor>

<best_practices>
- **Always build functional first** - Gemini enhances, not replaces structure
- **Use --persistent for iterations** - avoids repeated context setup
- **Provide image context** - designs yield better results than descriptions
- **Review accessibility** - verify Gemini's styling preserves a11y
- **Lifecycle-aware cleanup** - kill immediately for standalone tasks; defer to final UI task in multi-step workflows
- **Return PID to caller** - when part of larger workflow, main agent tracks PID across steps
- **CRITICAL: Include file paths** - Gemini agent doesn't know which files to modify. Always include explicit file paths in the task description (e.g., "enhance src/components/Button.tsx" not just "enhance this button")
</best_practices>

<success_criteria>
- Functional boilerplate created before delegation
- Gemini session used for visual enhancement
- Changes reviewed for quality and accessibility
- Session lifecycle follows workflow context:
  - Standalone: terminated after satisfaction
  - Multi-step: PID returned for reuse, killed only on final UI task
</success_criteria>
