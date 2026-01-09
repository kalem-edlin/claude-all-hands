/**
 * Design manifest operations.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { getPlanPaths } from "./paths.js";

export interface DesignEntry {
  screenshot_file_name: string;
  description: string;
}

export interface DesignManifest {
  designs: DesignEntry[];
}

/**
 * Get the design manifest file path.
 */
export function getDesignManifestPath(): string {
  const paths = getPlanPaths();
  return join(paths.design, "manifest.yaml");
}

/**
 * Read the design manifest.
 */
export function readDesignManifest(): DesignManifest | null {
  const manifestPath = getDesignManifestPath();
  if (!existsSync(manifestPath)) {
    return null;
  }
  try {
    const content = readFileSync(manifestPath, "utf-8");
    return parseYaml(content) as DesignManifest;
  } catch {
    return null;
  }
}
