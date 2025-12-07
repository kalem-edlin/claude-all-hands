#!/usr/bin/env python3
"""UserPromptSubmit hook - enforces planning workflow based on plan status."""

import json
import subprocess
import sys
from pathlib import Path


def get_envoy_path() -> Path:
    """Get path to envoy CLI."""
    cwd = Path.cwd()
    return cwd / ".claude" / "envoy" / "envoy"


def get_plan_status() -> dict:
    """Get current plan status via envoy."""
    envoy = get_envoy_path()
    if not envoy.exists():
        return {"error": "envoy not found"}

    result = subprocess.run(
        [str(envoy), "plans", "frontmatter"],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return {"error": result.stderr}

    try:
        data = json.loads(result.stdout)
        return data.get("data", {})
    except json.JSONDecodeError:
        return {"error": "invalid json"}


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        return

    # Get plan status
    plan_data = get_plan_status()

    # Direct mode - no planning enforcement
    if plan_data.get("mode") == "direct":
        return

    # No plan exists yet
    if not plan_data.get("exists"):
        print("No plan file. Run /plan to create one.")
        return

    frontmatter = plan_data.get("frontmatter", {})
    status = frontmatter.get("status", "draft")
    plan_path = plan_data.get("path", "")

    if status == "draft":
        print("PLANNING REQUIRED: Plan status is draft.")
        print(f"Plan file: {plan_path}")
        print("Run /plan to begin planning workflow.")
        print("To skip planning this session, decline when prompted.")

    elif status == "active":
        print(f"Plan status: active | Plan file: {plan_path}")
        print("IMPORTANT: If this prompt is NOT related to the current plan, you MUST run /plan to challenge the user to follow workflow best practices.")

    elif status == "deactivated":
        # User opted out - no enforcement, silent pass
        return


if __name__ == "__main__":
    main()