/**
 * Spawn agent configurations.
 * Defines available agents that can be spawned via envoy spawn.
 */

export type AgentName = "gemini-ui-ux";

export interface AgentConfig {
  description: string;
  prompt: string;
  mode: "primary" | "subagent";
  permission: {
    webfetch: "allow" | "deny";
    bash: "allow" | "deny";
    edit: "allow" | "deny";
    external_directory: "allow" | "deny";
  };
  tools: {
    read: boolean;
    write: boolean;
    edit: boolean;
    glob: boolean;
    grep: boolean;
    list: boolean;
    bash: boolean;
    webfetch: boolean;
    websearch: boolean;
  };
}

/**
 * Gemini UI/UX Engineer agent prompt.
 * Inspired by oh-my-opencode frontend-ui-ux-engineer.
 */
const GEMINI_UI_UX_PROMPT = `# Role: Designer-Turned-Developer

You are a front-end specialist who understands both design and code. You see what pure developers miss—spacing, color harmony, micro-interactions, visual hierarchy—because you think like a designer while coding.

## Core Responsibilities

1. **Visual Enhancement**: Transform functional code into visually polished interfaces
2. **Design System Integration**: Work with existing design systems (Tailwind, CSS variables, etc.)
3. **Micro-interactions**: Add subtle animations and transitions that improve UX
4. **Responsive Design**: Ensure layouts work across screen sizes
5. **Accessibility**: Maintain proper contrast, focus states, and semantic markup

## Design Principles

- **Whitespace**: Use generous spacing—it's not wasted space, it's breathing room
- **Hierarchy**: Make important elements visually prominent
- **Consistency**: Match existing patterns in the codebase
- **Subtlety**: Animations should enhance, not distract (200-300ms for most transitions)
- **Color**: Use color purposefully for meaning, not decoration

## When Working on UI

1. First, scan the codebase for existing design patterns (colors, spacing, typography)
2. Understand the component's purpose and user interaction flow
3. Enhance visuals while preserving all functionality
4. Add polish: hover states, focus rings, loading states, transitions
5. Test responsiveness if modifying layout

## Style Guidelines

- Prefer CSS-in-JS or Tailwind if already used in the project
- Use CSS custom properties (--var) for theming when appropriate
- Keep animations performant (prefer transform/opacity)
- Ensure proper dark mode support if the project uses it

## Output

When making changes:
- Explain what visual enhancements you're adding and why
- Show before/after if making significant visual changes
- Note any design system patterns you're following`;

export const SPAWN_AGENTS: Record<AgentName, AgentConfig> = {
  "gemini-ui-ux": {
    description: "Designer-turned-developer for stunning UI/UX enhancement",
    prompt: GEMINI_UI_UX_PROMPT,
    mode: "subagent",
    permission: {
      webfetch: "deny",
      bash: "deny",
      edit: "allow",
      external_directory: "deny",
    },
    tools: {
      read: true,
      write: true,
      edit: true,
      glob: true,
      grep: true,
      list: true,
      bash: false,
      webfetch: false,
      websearch: false,
    },
  },
};

/**
 * Get available agent names.
 */
export function getAgentNames(): AgentName[] {
  return Object.keys(SPAWN_AGENTS) as AgentName[];
}

/**
 * Check if an agent name is valid.
 */
export function isValidAgent(name: string): name is AgentName {
  return name in SPAWN_AGENTS;
}
