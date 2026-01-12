/**
 * Notification commands for system notifications via jamf/Notifier.
 *
 * Layout: title (event) | subtitle (branch, auto) | message (details)
 */

import { Command } from "commander";
import { BaseCommand, CommandResult } from "./base.js";
import { sendNotification, sendGateNotification, sendHookNotification } from "../lib/notification.js";

/**
 * Send a generic notification.
 */
export class SendNotificationCommand extends BaseCommand {
  readonly name = "send";
  readonly description = "Send a system notification";

  defineArguments(cmd: Command): void {
    cmd.argument("<title>", "Event type (shown as title)");
    cmd.argument("<message>", "Details (shown as message body)");
    cmd.option("--sound <name>", "Sound name");
    cmd.option("-t, --type <type>", "Notification type: banner (auto-dismiss) or alert (persistent)", "banner");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const title = args.title as string;
    const message = args.message as string;
    const sound = args.sound as string | undefined;
    const type = args.type as "banner" | "alert" | undefined;

    const sent = sendNotification({ title, message, sound, type });

    if (sent) {
      return this.success({ sent: true, title, message });
    } else {
      return this.success({ sent: false, reason: "notifier not available or failed" });
    }
  }
}

/**
 * Send a gate notification (persistent alert).
 */
export class GateNotificationCommand extends BaseCommand {
  readonly name = "gate";
  readonly description = "Send a gate notification (alert type)";

  defineArguments(cmd: Command): void {
    cmd.argument("<gate_type>", "Gate type (findings, plan, testing, etc.)");
    cmd.argument("<message>", "Notification message");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const gateType = args.gate_type as string;
    const message = args.message as string;

    const sent = sendGateNotification(gateType, message);

    if (sent) {
      return this.success({ sent: true, gate_type: gateType });
    } else {
      return this.success({ sent: false, reason: "notifier not available or failed" });
    }
  }
}

/**
 * Send a hook notification (banner, auto-dismiss).
 */
export class HookNotificationCommand extends BaseCommand {
  readonly name = "hook";
  readonly description = "Send a hook notification (banner type)";

  defineArguments(cmd: Command): void {
    cmd.argument("<hook_type>", "Hook type (stop, permission, idle, elicitation)");
    cmd.argument("<message>", "Notification message");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const hookType = args.hook_type as string;
    const message = args.message as string;

    const sent = sendHookNotification(hookType, message);

    if (sent) {
      return this.success({ sent: true, hook_type: hookType });
    } else {
      return this.success({ sent: false, reason: "notifier not available or failed" });
    }
  }
}

export const COMMANDS = {
  send: SendNotificationCommand,
  gate: GateNotificationCommand,
  hook: HookNotificationCommand,
};
