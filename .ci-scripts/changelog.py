#!/usr/bin/env python3
"""Manage CHANGELOG.md for a rolling, date-based changelog.

Subcommands:
  add-entry    Add an entry under today's UTC date section.
  validate     Check that CHANGELOG.md is well-formed.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = REPO_ROOT / "CHANGELOG.md"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

CATEGORIES = ("### Breaking Changes", "### Non-breaking Changes")

SECTION_MAP = {
    "breaking": CATEGORIES[0],
    "non-breaking": CATEGORIES[1],
}

EXPECTED_HEADER_FRAGMENT = "# Change Log"


def _read_changelog() -> str:
    if not CHANGELOG.exists():
        print(f"ERROR: {CHANGELOG} not found", file=sys.stderr)
        sys.exit(1)
    return CHANGELOG.read_text(encoding="utf-8")


def _write_changelog(content: str) -> None:
    CHANGELOG.write_text(content, encoding="utf-8")


def _split_sections(content: str) -> tuple[str, list[tuple[str, str]]]:
    """Split changelog into header and a list of (heading_line, body) pairs."""
    lines = content.split("\n")
    header_lines: list[str] = []
    sections: list[tuple[str, str]] = []
    current_heading: str | None = None
    current_body_lines: list[str] = []

    for line in lines:
        if line.startswith("## "):
            if current_heading is not None:
                sections.append((current_heading, "\n".join(current_body_lines)))
            else:
                header_lines = current_body_lines
            current_heading = line
            current_body_lines = []
        else:
            current_body_lines.append(line)

    if current_heading is not None:
        sections.append((current_heading, "\n".join(current_body_lines)))
    else:
        header_lines = current_body_lines

    header = "\n".join(header_lines)
    return header, sections


def _reassemble(header: str, sections: list[tuple[str, str]]) -> str:
    parts = [header]
    for heading, body in sections:
        parts.append(heading)
        parts.append(body)
    return "\n".join(parts)


def _parse_date_heading(heading: str) -> str | None:
    """Extract date from a heading like '## 2026-04-08'."""
    match = re.match(r"^## (\d{4}-\d{2}-\d{2})$", heading)
    if not match:
        return None
    return match.group(1)


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# -- Subcommands -------------------------------------------------------------


def cmd_add_entry(section: str, entry: str) -> int:
    """Add an entry under today's UTC date section."""
    target = SECTION_MAP.get(section)
    if target is None:
        print(f"ERROR: unknown section '{section}'", file=sys.stderr)
        print(f"Valid sections: {', '.join(SECTION_MAP)}", file=sys.stderr)
        return 1

    today = _today_utc()
    today_heading = f"## {today}"

    content = _read_changelog()
    header, sections = _split_sections(content)

    # If today's section doesn't exist, create it at the top.
    if not sections or sections[0][0] != today_heading:
        new_body = f"\n{CATEGORIES[0]}\n\n\n{CATEGORIES[1]}\n"
        sections.insert(0, (today_heading, new_body))

    _, body = sections[0]
    body_lines = body.split("\n")

    # Find the target category heading and insert after it + one blank line.
    insert_idx = None
    for i, line in enumerate(body_lines):
        if line == target:
            insert_idx = i + 2
            break

    if insert_idx is None:
        print(
            f"ERROR: category '{target}' not found in today's section",
            file=sys.stderr,
        )
        return 1

    body_lines.insert(insert_idx, f"- {entry}")
    sections[0] = (today_heading, "\n".join(body_lines))

    _write_changelog(_reassemble(header, sections))
    print(f"Added entry to {target} under {today}")
    return 0


def cmd_validate() -> int:
    """Check that CHANGELOG.md is well-formed."""
    content = _read_changelog()
    header, sections = _split_sections(content)
    errors: list[str] = []

    if EXPECTED_HEADER_FRAGMENT not in header:
        errors.append("missing expected header ('# Change Log')")

    # An empty changelog (no sections yet) is valid.
    if not sections:
        if errors:
            _report_errors(errors)
            return 1
        print("Changelog validation passed.")
        return 0

    seen_dates: set[str] = set()
    prev_date: str | None = None

    for heading, body in sections:
        date_str = _parse_date_heading(heading)

        if date_str is None:
            errors.append(f"cannot parse date from heading: '{heading}'")
            continue

        if not DATE_RE.match(date_str):
            errors.append(f"invalid date format: '{date_str}'")

        if date_str in seen_dates:
            errors.append(f"duplicate date: {date_str}")
        seen_dates.add(date_str)

        if prev_date is not None and date_str >= prev_date:
            errors.append(
                f"dates out of order: {date_str} should come before {prev_date}"
            )
        prev_date = date_str

        for cat in CATEGORIES:
            if cat not in body:
                errors.append(f"section {date_str} missing '{cat}'")

    if errors:
        _report_errors(errors)
        return 1

    print("Changelog validation passed.")
    return 0


def _report_errors(errors: list[str]) -> None:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(f"Changelog validation failed: {len(errors)} error(s).", file=sys.stderr)


# -- Main --------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage CHANGELOG.md")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("validate", help="Check changelog format")

    add_entry_parser = sub.add_parser(
        "add-entry", help="Add an entry under today's date section"
    )
    add_entry_parser.add_argument(
        "--section",
        required=True,
        choices=list(SECTION_MAP),
        help="Category section (breaking or non-breaking)",
    )
    add_entry_parser.add_argument("entry", help="Entry text (without leading '- ')")

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return 1

    if args.command == "validate":
        return cmd_validate()
    elif args.command == "add-entry":
        return cmd_add_entry(args.section, args.entry)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
