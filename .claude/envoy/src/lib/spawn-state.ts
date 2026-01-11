/**
 * Spawn task state management.
 * State files keyed by PID: .claude/spawn/tasks/<pid>.json
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { getProjectRoot } from "./git.js";

export interface SpawnTaskState {
  pid: number;
  port: number;
  sessionId: string;
  agent: string;
  createdAt: number;
  lastActivityAt: number;
}

const SPAWN_DIR = ".claude/spawn/tasks";
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get the spawn tasks directory, creating if needed.
 */
export function getSpawnDir(): string {
  const root = getProjectRoot();
  const dir = join(root, SPAWN_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get the state file path for a PID.
 */
export function getTaskStatePath(pid: number): string {
  return join(getSpawnDir(), `${pid}.json`);
}

/**
 * Read task state for a PID. Returns null if not found.
 */
export function readTaskState(pid: number): SpawnTaskState | null {
  const path = getTaskStatePath(pid);
  if (!existsSync(path)) {
    return null;
  }
  try {
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as SpawnTaskState;
  } catch {
    return null;
  }
}

/**
 * Write task state for a PID.
 */
export function writeTaskState(state: SpawnTaskState): void {
  const path = getTaskStatePath(state.pid);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

/**
 * Update lastActivityAt timestamp for a task.
 */
export function touchTaskState(pid: number): boolean {
  const state = readTaskState(pid);
  if (!state) return false;
  state.lastActivityAt = Date.now();
  writeTaskState(state);
  return true;
}

/**
 * Delete task state file.
 */
export function deleteTaskState(pid: number): boolean {
  const path = getTaskStatePath(pid);
  if (!existsSync(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
}

/**
 * List all task states.
 */
export function listTaskStates(): SpawnTaskState[] {
  const dir = getSpawnDir();
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  const states: SpawnTaskState[] = [];

  for (const file of files) {
    const pid = parseInt(file.replace(".json", ""), 10);
    if (isNaN(pid)) continue;
    const state = readTaskState(pid);
    if (state) states.push(state);
  }

  return states;
}

/**
 * Check if a process is alive.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find stale tasks (timeout exceeded or process dead).
 */
export function findStaleTasks(): SpawnTaskState[] {
  const now = Date.now();
  return listTaskStates().filter(state => {
    const timedOut = (now - state.lastActivityAt) > TIMEOUT_MS;
    const dead = !isProcessAlive(state.pid);
    return timedOut || dead;
  });
}

/**
 * Clean up stale tasks (kill process + delete state).
 * Returns list of cleaned PIDs.
 */
export function cleanupStaleTasks(): number[] {
  const stale = findStaleTasks();
  const cleaned: number[] = [];

  for (const task of stale) {
    // Try to kill if still alive
    if (isProcessAlive(task.pid)) {
      try {
        process.kill(task.pid, "SIGTERM");
      } catch {
        // Ignore errors
      }
    }
    // Delete state file
    deleteTaskState(task.pid);
    cleaned.push(task.pid);
  }

  return cleaned;
}
