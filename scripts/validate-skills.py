#!/usr/bin/env python3
"""Validate skill metadata and layout."""

from __future__ import annotations

import sys
from pathlib import Path


def extract_frontmatter_value(content: str, key: str) -> str:
    lines = content.splitlines()
    if not lines or lines[0] != "---":
        return ""

    for index in range(1, len(lines)):
        line = lines[index]
        if line == "---":
            break
        if line.startswith(f"{key}:"):
            return line.split(":", 1)[1].strip()
    return ""


def validate_skill(skill_md: Path) -> list[str]:
    content = skill_md.read_text(encoding="utf-8")
    lines = content.splitlines()
    errors: list[str] = []
    skill_dir = skill_md.parent.name

    if not lines or lines[0] != "---" or "---" not in lines[1:]:
        return [f"{skill_md} missing YAML frontmatter delimiters"]

    name = extract_frontmatter_value(content, "name")
    description = extract_frontmatter_value(content, "description")

    if not name:
        errors.append(f"{skill_md} missing frontmatter name")
    elif name != skill_dir:
        errors.append(
            f"{skill_md} frontmatter name '{name}' does not match directory '{skill_dir}'"
        )

    if not description:
        errors.append(f"{skill_md} missing frontmatter description")
    elif description == "TODO":
        errors.append(f"{skill_md} description still set to TODO")

    if not any(line.startswith("# ") for line in lines):
        errors.append(f"{skill_md} missing top-level Markdown heading")

    return errors


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    skills = sorted(repo_root.glob("*/SKILL.md"))

    if not skills:
        print("ERROR: No skills found (expected */SKILL.md)", file=sys.stderr)
        print("Validation failed: 1 error(s) across 0 skill(s).", file=sys.stderr)
        return 1

    checked = 0
    errors: list[str] = []
    for skill_md in skills:
        checked += 1
        for error in validate_skill(skill_md):
            errors.append(error)
            print(f"ERROR: {error}", file=sys.stderr)

    if errors:
        print(
            f"Validation failed: {len(errors)} error(s) across {checked} skill(s).",
            file=sys.stderr,
        )
        return 1

    print(f"Validation passed: {checked} skill(s) checked.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
