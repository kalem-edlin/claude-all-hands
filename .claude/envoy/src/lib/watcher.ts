/**
 * File watching utilities for blocking gates.
 * Uses chokidar for cross-platform file watching.
 */

import chokidar, { type FSWatcher } from "chokidar";
import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import { logInfo, logWarn } from "./observability.js";

export interface WatchResult {
  content: Record<string, unknown>;
  duration_ms: number;
}

/**
 * Watch a file until it has `done: true` in its YAML content.
 * Used by blocking gate commands.
 *
 * @param filePath - Path to the YAML file to watch
 * @param timeoutMs - Optional timeout (default: no timeout)
 * @returns The parsed YAML content when done is true
 */
export async function watchForDone(
  filePath: string,
  timeoutMs?: number
): Promise<WatchResult> {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;

    // Check if file already exists and is done
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const parsed = parseYaml(content) as Record<string, unknown>;
        if (parsed.done === true) {
          logInfo("watcher.already_done", { filePath });
          resolve({
            content: parsed,
            duration_ms: Math.round(performance.now() - start),
          });
          return;
        }
      } catch {
        // File exists but isn't valid YAML yet, continue to watch
      }
    }

    logInfo("watcher.start", { filePath, timeoutMs });

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      watcher.close();
    };

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        cleanup();
        logWarn("watcher.timeout", { filePath, timeoutMs });
        reject(new Error(`Timeout waiting for ${filePath} after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    const checkFile = () => {
      try {
        if (!existsSync(filePath)) return;
        const content = readFileSync(filePath, "utf-8");
        const parsed = parseYaml(content) as Record<string, unknown>;
        if (parsed.done === true) {
          cleanup();
          logInfo("watcher.done", {
            filePath,
            duration_ms: Math.round(performance.now() - start),
          });
          resolve({
            content: parsed,
            duration_ms: Math.round(performance.now() - start),
          });
        }
      } catch {
        // Not valid YAML yet, keep watching
      }
    };

    watcher.on("add", checkFile);
    watcher.on("change", checkFile);

    watcher.on("error", (error) => {
      cleanup();
      logWarn("watcher.error", { filePath, error: String(error) });
      reject(error);
    });
  });
}

/**
 * Watch multiple files until any one has `done: true`.
 * Returns which file triggered and its content.
 */
export async function watchForAnyDone(
  filePaths: string[],
  timeoutMs?: number
): Promise<WatchResult & { triggeredFile: string }> {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    const watchers: FSWatcher[] = [];

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      watchers.forEach((w) => w.close());
    };

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for any of ${filePaths.length} files`));
      }, timeoutMs);
    }

    for (const filePath of filePaths) {
      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      watchers.push(watcher);

      const checkFile = () => {
        try {
          if (!existsSync(filePath)) return;
          const content = readFileSync(filePath, "utf-8");
          const parsed = parseYaml(content) as Record<string, unknown>;
          if (parsed.done === true) {
            cleanup();
            resolve({
              content: parsed,
              duration_ms: Math.round(performance.now() - start),
              triggeredFile: filePath,
            });
          }
        } catch {
          // Not valid YAML yet
        }
      };

      watcher.on("add", checkFile);
      watcher.on("change", checkFile);
    }
  });
}
