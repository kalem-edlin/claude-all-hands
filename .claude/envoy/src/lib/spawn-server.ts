/**
 * Spawn server lifecycle management.
 * Spawns `opencode serve` as daemon process and manages connections via PID.
 */

import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import { execSync, spawn } from "child_process";
import { getProjectRoot } from "./git.js";
import { SPAWN_AGENTS, type AgentName } from "./spawn-agents.js";
import {
  cleanupStaleTasks,
  deleteTaskState,
  isProcessAlive,
  readTaskState,
  writeTaskState,
  type SpawnTaskState,
} from "./spawn-state.js";

/**
 * Find opencode binary path.
 * Checks: OPENCODE_BIN env var → which opencode → common bun/npm paths
 */
function findOpencodeBin(): string {
  // Check env var first
  if (process.env.OPENCODE_BIN) {
    return process.env.OPENCODE_BIN;
  }

  // Try which
  try {
    const result = execSync("which opencode", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
    if (result) return result;
  } catch {
    // Not found via which
  }

  // Common installation paths (bun first, then npm)
  const homedir = process.env.HOME || "";
  const commonPaths = [
    `${homedir}/.bun/bin/opencode`,
    `${homedir}/.local/bin/opencode`,
    "/usr/local/bin/opencode",
    `${homedir}/.npm-global/bin/opencode`,
  ];

  for (const p of commonPaths) {
    try {
      execSync(`test -x "${p}"`, { stdio: ["pipe", "pipe", "pipe"] });
      return p;
    } catch {
      // Not found at this path
    }
  }

  // Fallback - assume it's in PATH
  return "opencode";
}

/**
 * Find an available port in range.
 */
async function findAvailablePort(min: number = 3000, max: number = 6000): Promise<number> {
  const net = await import("net");

  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > max) {
        reject(new Error("No available port found"));
        return;
      }

      const server = net.createServer();
      server.listen(port, "127.0.0.1");
      server.on("listening", () => {
        server.close(() => resolve(port));
      });
      server.on("error", () => {
        tryPort(port + 1);
      });
    };

    // Start with random port in range
    const startPort = Math.floor(Math.random() * (max - min)) + min;
    tryPort(startPort);
  });
}

/**
 * Wait for server to be ready by polling health endpoint.
 */
async function waitForServer(port: number, timeoutMs: number = 15000): Promise<boolean> {
  const client = createOpencodeClient({ baseUrl: `http://localhost:${port}` });
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      await client.session.list();
      return true;
    } catch {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return false;
}

/**
 * Spawn a new OpenCode server as headless daemon process.
 * Returns real PID for process management.
 */
export async function spawnServer(agent: AgentName, cwd?: string): Promise<{ pid: number; port: number; client: OpencodeClient }> {
  // Cleanup stale tasks first
  cleanupStaleTasks();

  const agentConfig = SPAWN_AGENTS[agent];
  if (!agentConfig) {
    throw new Error(`Unknown agent: ${agent}`);
  }

  const port = await findAvailablePort();
  const workDir = cwd || getProjectRoot();
  const opencodeBin = findOpencodeBin();


  // Spawn opencode serve using nohup to ensure it survives parent exit
  // We spawn via shell and then find the actual PID by port
  const shellCmd = `nohup "${opencodeBin}" serve --port ${port} > /dev/null 2>&1 & echo $!`;

  let opencodePid: number;
  try {
    const result = execSync(shellCmd, {
      cwd: workDir,
      env: process.env,
      encoding: "utf-8",
    });
    opencodePid = parseInt(result.trim(), 10);
    if (isNaN(opencodePid)) {
      throw new Error("Failed to get PID from shell");
    }
  } catch (e) {
    throw new Error(`Failed to spawn opencode server: ${e}`);
  }


  // Wait for server to be ready
  const ready = await waitForServer(port);
  if (!ready) {
    // Kill the process if server didn't start
    try {
      process.kill(opencodePid, "SIGTERM");
    } catch {
      // Ignore - process might already be dead
    }
    throw new Error(`OpenCode server failed to start on port ${port}`);
  }


  const client = createOpencodeClient({
    baseUrl: `http://localhost:${port}`,
    directory: workDir,
  });

  return { pid: opencodePid, port, client };
}

/**
 * Connect to an existing server by PID.
 */
export async function connectToServer(pid: number): Promise<{ state: SpawnTaskState; client: OpencodeClient }> {
  const state = readTaskState(pid);
  if (!state) {
    throw new Error(`No task state found for PID ${pid}`);
  }

  if (!isProcessAlive(pid)) {
    // Cleanup dead state
    deleteTaskState(pid);
    throw new Error(`Server process ${pid} is no longer running`);
  }

  const client = createOpencodeClient({
    baseUrl: `http://localhost:${state.port}`,
  });

  // Verify server is responding
  try {
    await client.session.list();
  } catch {
    deleteTaskState(pid);
    throw new Error(`Server at port ${state.port} is not responding`);
  }

  // Update last activity
  writeTaskState({ ...state, lastActivityAt: Date.now() });

  return { state, client };
}

/**
 * Create a session on a server.
 */
export async function createSession(client: OpencodeClient): Promise<string> {
  const session = await client.session.create();
  if (session.error || !session.data?.id) {
    throw new Error("Failed to create session");
  }
  return session.data.id;
}

/**
 * Send a prompt to a session and collect response via event stream.
 */
export async function sendPrompt(
  client: OpencodeClient,
  sessionId: string,
  _agent: AgentName,
  prompt: string,
  imagePaths?: string[]
): Promise<string> {
  const parts: Array<{ type: string; text?: string; mime?: string; url?: string; filename?: string }> = [
    { type: "text", text: prompt },
  ];

  // Add images if provided (using pathToFileURL like oh-my-opencode)
  if (imagePaths && imagePaths.length > 0) {
    const path = await import("path");
    const { pathToFileURL } = await import("url");

    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };

    for (const imagePath of imagePaths) {
      const ext = path.extname(imagePath).toLowerCase();
      const mime = mimeTypes[ext] || "image/png";
      const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);
      const filename = path.basename(imagePath);

      parts.push({
        type: "file",
        mime,
        url: pathToFileURL(absolutePath).href,
        filename,
      });
    }
  }

  // Subscribe to event stream first
  const abortController = new AbortController();
  const eventResult = await client.event.subscribe({ signal: abortController.signal } as any);
  const eventStream = eventResult.stream;

  // Fire the prompt (doesn't wait for response)
  client.session.prompt({
    path: { id: sessionId },
    body: {
      agent: "build",
      model: {
        providerID: "google",
        modelID: "antigravity-gemini-3-pro",
      },
      parts: parts as any,
    },
  });

  // Collect text from events until session.idle
  const textChunks: string[] = [];

  for await (const event of eventStream) {
    const eventType = (event as any).type;
    const props = (event as any).properties || {};

    // Filter events for this session
    if (props.sessionID && props.sessionID !== sessionId) {
      continue;
    }

    // Collect text from message.part.updated events
    if (eventType === "message.part.updated") {
      const part = props.part;
      if (part?.type === "text" && part?.text) {
        textChunks.push(part.text);
      }
    }

    // Stop on session.idle
    if (eventType === "session.idle") {
      break;
    }

    // Handle errors
    if (eventType === "session.error") {
      abortController.abort();
      const errorMsg = props.error?.message || props.error?.name || "Unknown session error";
      throw new Error(`Session error: ${errorMsg}`);
    }
  }

  // Abort the event stream to release resources
  abortController.abort();

  // Return the last text part (final response) or join all
  return textChunks.length > 0 ? textChunks[textChunks.length - 1] : "";
}

/**
 * Kill a server by PID.
 */
export function killServer(pid: number): boolean {
  const state = readTaskState(pid);

  if (isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process might have died between check and kill
    }
  }

  if (state) {
    deleteTaskState(pid);
    return true;
  }

  return false;
}

/**
 * Check if a server is alive by PID.
 */
export function isServerAlive(pid: number): boolean {
  return isProcessAlive(pid);
}
