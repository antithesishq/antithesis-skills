#!/usr/bin/env python3
"""Update metadata.version in all skill SKILL.md frontmatter.

Reads the current date from the first ## heading in CHANGELOG.md and
combines it with a provided short SHA to produce a version string like
"2026-04-14 077d0ea".

Usage:
  update_skill_versions.py update --sha <short-sha>
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = REPO_ROOT / "CHANGELOG.md"


def _read_changelog_date() -> str:
    """Extract the date from the first ## heading in CHANGELOG.md."""
    if not CHANGELOG.exists():
        print(f"ERROR: {CHANGELOG} not found", file=sys.stderr)
        sys.exit(1)

    for line in CHANGELOG.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^## (\d{4}-\d{2}-\d{2})$", line)
        if match:
            return match.group(1)

    print("ERROR: no date heading found in CHANGELOG.md", file=sys.stderr)
    sys.exit(1)


def _find_skills() -> list[Path]:
    """Find all top-level SKILL.md files."""
    skills = sorted(REPO_ROOT.glob("*/SKILL.md"))
    if not skills:
        print("ERROR: no SKILL.md files found", file=sys.stderr)
        sys.exit(1)
    return skills


def _update_frontmatter_version(content: str, version: str) -> str:
    """Update or insert metadata.version in YAML frontmatter."""
    lines = content.split("\n")

    if not lines or lines[0] != "---":
        print("ERROR: file does not start with frontmatter delimiter", file=sys.stderr)
        sys.exit(1)

    # Find the closing --- delimiter.
    close_idx = None
    for i in range(1, len(lines)):
        if lines[i] == "---":
            close_idx = i
            break

    if close_idx is None:
        print("ERROR: no closing frontmatter delimiter found", file=sys.stderr)
        sys.exit(1)

    # Check if metadata.version already exists.
    metadata_idx = None
    version_idx = None
    for i in range(1, close_idx):
        if lines[i].startswith("metadata:"):
            metadata_idx = i
        elif metadata_idx is not None and re.match(r"^\s+version:\s", lines[i]):
            version_idx = i
            break

    version_line = f'  version: "{version}"'

    if version_idx is not None:
        # Replace existing version line.
        lines[version_idx] = version_line
    elif metadata_idx is not None:
        # metadata: exists but no version — insert after metadata:.
        lines.insert(metadata_idx + 1, version_line)
    else:
        # No metadata block — insert before closing ---.
        lines.insert(close_idx, f"metadata:\n{version_line}")

    return "\n".join(lines)


def cmd_update(sha: str) -> int:
    """Update metadata.version in all skills."""
    date = _read_changelog_date()
    version = f"{date} {sha}"

    skills = _find_skills()
    for skill_md in skills:
        content = skill_md.read_text(encoding="utf-8")
        updated = _update_frontmatter_version(content, version)
        skill_md.write_text(updated, encoding="utf-8")
        print(f"Updated {skill_md.relative_to(REPO_ROOT)}")

    print(f'Set version to "{version}" across {len(skills)} skill(s)')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Update metadata.version in skill frontmatter"
    )
    sub = parser.add_subparsers(dest="command")

    update_parser = sub.add_parser(
        "update", help="Update version in all SKILL.md files"
    )
    update_parser.add_argument(
        "--sha", required=True, help="Short commit SHA for the version"
    )

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return 1

    if args.command == "update":
        return cmd_update(args.sha)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
