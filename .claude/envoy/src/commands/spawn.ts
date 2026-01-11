/**
 * Spawn commands - spawn OpenCode-based agents for specialized tasks.
 *
 * Commands:
 * - spawn gemini-ui-ux "<task>" - UI/UX enhancement agent
 * - spawn kill <pid> - Kill a persistent session
 * - spawn list - List active sessions
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";
import {
  spawnServer,
  connectToServer,
  createSession,
  sendPrompt,
  killServer,
  isServerAlive,
} from "../lib/spawn-server.js";
import {
  writeTaskState,
  listTaskStates,
  cleanupStaleTasks,
  isProcessAlive,
  type SpawnTaskState,
} from "../lib/spawn-state.js";
import { type AgentName } from "../lib/spawn-agents.js";

/**
 * Base class for agent spawn commands.
 */
abstract class BaseAgentSpawnCommand extends BaseCommand {
  abstract readonly agentName: AgentName;

  defineArguments(cmd: Command): void {
    cmd
      .argument("<task>", "Task description for the agent")
      .option("--persistent", "Create persistent session, returns PID for follow-ups")
      .option("--pid <pid>", "Reuse existing persistent session by PID", parseInt)
      .option("--images <paths...>", "Image files for visual context")
      .option("--cwd <dir>", "Working directory for file operations");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const task = args.task as string;
    const persistent = args.persistent as boolean | undefined;
    const existingPid = args.pid as number | undefined;
    const imagePaths = args.images as string[] | undefined;
    const cwd = args.cwd as string | undefined;

    try {
      // Cleanup stale tasks first
      cleanupStaleTasks();

      let pid: number;
      let sessionId: string;
      let client: Awaited<ReturnType<typeof spawnServer>>["client"];

      if (existingPid) {
        // Reuse existing session
        const connection = await connectToServer(existingPid);
        pid = connection.state.pid;
        sessionId = connection.state.sessionId;
        client = connection.client;
      } else {
        // Spawn new server
        const server = await spawnServer(this.agentName, cwd);
        pid = server.pid;
        client = server.client;

        // Create session
        sessionId = await createSession(client);

        // Write state for persistent sessions
        if (persistent) {
          const state: SpawnTaskState = {
            pid,
            port: server.port,
            sessionId,
            agent: this.agentName,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
          };
          writeTaskState(state);
        }
      }

      // Send the prompt
      const response = await sendPrompt(client, sessionId, this.agentName, task, imagePaths);

      // Debug: log response

      // For one-shot (non-persistent), kill the server
      if (!persistent && !existingPid) {
        killServer(pid);
        return this.success({
          response: response || "(empty response)",
        });
      }

      // For persistent, return PID
      return this.success({
        pid,
        response,
      });
    } catch (e) {
      return this.error(
        "spawn_error",
        e instanceof Error ? e.message : String(e),
        "Check that opencode CLI is installed: npm i -g opencode"
      );
    }
  }
}

/**
 * Gemini UI/UX agent spawn command.
 */
class SpawnGeminiUiUxCommand extends BaseAgentSpawnCommand {
  readonly name = "gemini-ui-ux";
  readonly description = "Designer-turned-developer for stunning UI/UX enhancement";
  readonly agentName: AgentName = "gemini-ui-ux";
}

/**
 * Kill a persistent spawn session.
 */
class SpawnKillCommand extends BaseCommand {
  readonly name = "kill";
  readonly description = "Kill a persistent spawn session by PID";

  defineArguments(cmd: Command): void {
    cmd.argument("<pid>", "Process ID to kill", parseInt);
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const pid = args.pid as number;

    if (isNaN(pid) || pid <= 0) {
      return this.error("invalid_pid", "PID must be a positive integer");
    }

    const killed = killServer(pid);

    if (killed) {
      return this.success({
        pid,
        message: `Session ${pid} terminated`,
      });
    } else {
      return this.error(
        "not_found",
        `No active session found for PID ${pid}`,
        "Use 'envoy spawn list' to see active sessions"
      );
    }
  }
}

/**
 * List active spawn sessions.
 */
class SpawnListCommand extends BaseCommand {
  readonly name = "list";
  readonly description = "List active spawn sessions";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    // Cleanup stale tasks first
    const cleaned = cleanupStaleTasks();

    const states = listTaskStates();
    const sessions = states.map((state) => ({
      pid: state.pid,
      agent: state.agent,
      port: state.port,
      alive: isServerAlive(state.pid),
      created_at: new Date(state.createdAt).toISOString(),
      last_activity: new Date(state.lastActivityAt).toISOString(),
    }));

    return this.success({
      sessions,
      active_count: sessions.filter((s) => s.alive).length,
      cleaned_count: cleaned.length,
    });
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  "gemini-ui-ux": SpawnGeminiUiUxCommand,
  kill: SpawnKillCommand,
  list: SpawnListCommand,
};
