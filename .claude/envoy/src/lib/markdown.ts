/**
 * Markdown with YAML front matter parsing utilities.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/**
 * Parse a markdown file with YAML front matter.
 * Returns { frontMatter: object, content: string }
 */
export function parseMarkdownWithFrontMatter(text: string): {
  frontMatter: Record<string, unknown>;
  content: string;
} {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontMatter: {}, content: text };
  }
  try {
    const frontMatter = parseYaml(match[1]) as Record<string, unknown>;
    return { frontMatter, content: match[2] };
  } catch {
    return { frontMatter: {}, content: text };
  }
}

/**
 * Write a markdown file with YAML front matter.
 */
export function writeMarkdownWithFrontMatter(
  filePath: string,
  frontMatter: Record<string, unknown>,
  content: string
): void {
  const yaml = stringifyYaml(frontMatter, { lineWidth: 0 });
  const fileContent = `---\n${yaml}---\n\n${content}`;
  writeFileSync(filePath, fileContent, "utf-8");
}

/**
 * Read a markdown file and parse front matter.
 * Returns null if file doesn't exist.
 */
export function readMarkdownFile(filePath: string): {
  frontMatter: Record<string, unknown>;
  content: string;
} | null {
  if (!existsSync(filePath)) {
    return null;
  }
  const text = readFileSync(filePath, "utf-8");
  return parseMarkdownWithFrontMatter(text);
}

/**
 * Log file placeholder patterns - these are stripped when reading if no other content.
 */
const LOG_PLACEHOLDER_PATTERNS = [
  /^<!--\s*Paste\s+(test|debug)\s+logs\s+here\s*-->\s*$/i,
  /^<!--\s*ENVOY_LOG_PLACEHOLDER\s*-->\s*$/i,
];

/**
 * Strip log placeholder if file only contains placeholder text.
 */
export function stripLogPlaceholder(content: string): string {
  const trimmed = content.trim();
  for (const pattern of LOG_PLACEHOLDER_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "";
    }
  }
  return content;
}
