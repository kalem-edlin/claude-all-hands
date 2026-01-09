/**
 * Repomix utilities for token counting.
 * Extracted from commands/repomix.ts for reuse by blocking gates.
 */

import { spawnSync } from "child_process";

export interface TreeEntry {
  path: string;
  tokens: number;
}

export interface RepomixResult {
  success: boolean;
  output: string;
  tokenCount: number;
  tree: TreeEntry[];
  error?: string;
}

/**
 * Parse the token count tree from repomix output.
 * Builds full paths by tracking parent directories.
 */
export function parseTokenTree(output: string, maxDepth: number): TreeEntry[] {
  const entries: TreeEntry[] = [];

  const treeMatch = output.match(/Token Count Tree:[\s\S]*?(?=\n\n|\n🔎|\n📊|$)/);
  if (!treeMatch) return entries;

  const lines = treeMatch[0].split("\n").slice(2);
  const pathStack: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([│├└─\s]+)(.+?)\s+\(([0-9,]+)\s+tokens?\)/);
    if (!match) continue;

    const prefix = match[1];
    const name = match[2].trim();
    const tokens = parseInt(match[3].replace(/,/g, ""), 10);
    const depth = Math.floor(prefix.length / 4);

    pathStack.length = depth;
    const fullPath = [...pathStack, name].join("");

    if (name.endsWith("/")) {
      pathStack.push(name);
    }

    if (maxDepth <= 0 || depth <= maxDepth) {
      entries.push({ path: fullPath, tokens });
    }
  }

  return entries.sort((a, b) => b.tokens - a.tokens);
}

/**
 * Run repomix on paths and return token info.
 */
export function runRepomix(paths: string[], tokenCountOnly: boolean): RepomixResult {
  const cmd = ["npx", "repomix@latest", ...paths];

  if (tokenCountOnly) {
    cmd.push("--token-count-tree");
  } else {
    cmd.push("--stdout");
  }

  const result = spawnSync(cmd[0], cmd.slice(1), {
    encoding: "utf-8",
    timeout: 300000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.status !== 0) {
    return {
      success: false,
      output: result.stderr || "repomix failed",
      tokenCount: 0,
      tree: [],
      error: result.stderr || "repomix failed",
    };
  }

  const output = result.stdout || "";

  let tokenCount = 0;
  const tokenMatch = output.match(/Total\s+Tokens?:\s+([\d,]+)/i);
  if (tokenMatch) {
    tokenCount = parseInt(tokenMatch[1].replace(/,/g, ""), 10);
  }

  const maxDepth = parseInt(process.env.REPOMIX_MAX_DEPTH || "0", 10);
  const tree = parseTokenTree(output, maxDepth);

  return { success: true, output, tokenCount, tree };
}

/**
 * Get token count for a single file.
 * Returns the file's token count (not wrapper overhead).
 */
export function getFileTokenCount(filePath: string): {
  success: boolean;
  tokenCount: number;
  error?: string;
} {
  const result = runRepomix([filePath], true);

  if (!result.success) {
    return { success: false, tokenCount: 0, error: result.error };
  }

  // Find the specific file in the tree (it will be the only file entry)
  const fileEntry = result.tree.find((e) => !e.path.endsWith("/"));
  const tokenCount = fileEntry?.tokens ?? 0;

  return { success: true, tokenCount };
}

/**
 * Get max log tokens from env or default.
 * Default: 10000 tokens
 */
export function getMaxLogTokens(): number {
  const envVal = process.env.MAX_LOGS_TOKENS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10000;
}
