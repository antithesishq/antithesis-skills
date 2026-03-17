#!/usr/bin/env python3
"""Compare skill context sizes between two git refs."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from functools import cache
from pathlib import PurePosixPath
from typing import Iterable

import tiktoken

COMMENT_MARKER = "<!-- skill-context-report -->"


@dataclass(frozen=True)
class SkillCounts:
    partial_tokens: int
    full_tokens: int
    partial_bytes: int
    full_bytes: int


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True)


def git_bytes(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])


@cache
def list_paths(ref: str) -> list[str]:
    output = git("ls-tree", "-r", "--name-only", ref)
    return [line for line in output.splitlines() if line]


@cache
def list_skills(ref: str) -> set[str]:
    skills: set[str] = set()
    for path in list_paths(ref):
        candidate = PurePosixPath(path)
        if len(candidate.parts) == 2 and candidate.name == "SKILL.md":
            skills.add(candidate.parts[0])
    return skills


def read_file(ref: str, path: str) -> bytes:
    return git_bytes("show", f"{ref}:{path}")


@cache
def get_references(ref: str, skill: str) -> list[str]:
    prefix = f"{skill}/references/"
    refs = [path for path in list_paths(ref) if path.startswith(prefix)]
    return sorted(path for path in refs if not path.endswith("/"))


def token_count(encoding, content: bytes) -> int:
    text = content.decode("utf-8", errors="replace")
    return len(encoding.encode(text, disallowed_special=()))


def count_skill(ref: str, skill: str, encoding) -> SkillCounts:
    skill_md_path = f"{skill}/SKILL.md"
    skill_md = read_file(ref, skill_md_path)
    partial_tokens = token_count(encoding, skill_md)
    partial_bytes = len(skill_md)

    full_tokens = partial_tokens
    full_bytes = partial_bytes
    for reference_path in get_references(ref, skill):
        content = read_file(ref, reference_path)
        full_tokens += token_count(encoding, content)
        full_bytes += len(content)

    return SkillCounts(
        partial_tokens=partial_tokens,
        full_tokens=full_tokens,
        partial_bytes=partial_bytes,
        full_bytes=full_bytes,
    )


def changed_skills(base_ref: str, head_ref: str) -> list[str]:
    base_skills = list_skills(base_ref)
    head_skills = list_skills(head_ref)
    known_skills = base_skills | head_skills

    output = git("diff", "--name-only", f"{base_ref}...{head_ref}")
    changed = set()
    for path in output.splitlines():
        if not path:
            continue
        skill = PurePosixPath(path).parts[0]
        if skill in known_skills:
            changed.add(skill)
    return sorted(changed)


def percent_delta(before: int, after: int) -> float:
    if before == 0:
        return 0.0 if after == 0 else 100.0
    return ((after - before) / before) * 100.0


def is_significant(
    before: int, after: int, min_abs_delta: int, min_percent_delta: float
) -> bool:
    delta = abs(after - before)
    pct = abs(percent_delta(before, after))
    return delta >= min_abs_delta or pct >= min_percent_delta


def fmt_delta(before: int, after: int) -> str:
    delta = after - before
    sign = "+" if delta > 0 else ""
    pct = percent_delta(before, after)
    if before == 0 and after > 0:
        pct_text = "new"
    elif before > 0 and after == 0:
        pct_text = "removed"
    else:
        pct_sign = "+" if pct > 0 else ""
        pct_text = f"{pct_sign}{pct:.1f}%"
    return f"{before} -> {after} ({sign}{delta}, {pct_text})"


def build_report(
    base_ref: str,
    head_ref: str,
    encoding_name: str,
    min_abs_delta: int,
    min_percent_delta: float,
) -> dict:
    encoding = tiktoken.get_encoding(encoding_name)
    report = {
        "base_ref": base_ref,
        "head_ref": head_ref,
        "encoding": encoding_name,
        "thresholds": {
            "min_abs_delta": min_abs_delta,
            "min_percent_delta": min_percent_delta,
        },
        "skills": [],
    }

    for skill in changed_skills(base_ref, head_ref):
        base_exists = skill in list_skills(base_ref)
        head_exists = skill in list_skills(head_ref)
        base_counts = (
            count_skill(base_ref, skill, encoding)
            if base_exists
            else SkillCounts(0, 0, 0, 0)
        )
        head_counts = (
            count_skill(head_ref, skill, encoding)
            if head_exists
            else SkillCounts(0, 0, 0, 0)
        )

        partial_significant = is_significant(
            base_counts.partial_tokens,
            head_counts.partial_tokens,
            min_abs_delta,
            min_percent_delta,
        )
        full_significant = is_significant(
            base_counts.full_tokens,
            head_counts.full_tokens,
            min_abs_delta,
            min_percent_delta,
        )

        report["skills"].append(
            {
                "skill": skill,
                "partial": {
                    "base_tokens": base_counts.partial_tokens,
                    "head_tokens": head_counts.partial_tokens,
                    "base_bytes": base_counts.partial_bytes,
                    "head_bytes": head_counts.partial_bytes,
                    "significant": partial_significant,
                },
                "full": {
                    "base_tokens": base_counts.full_tokens,
                    "head_tokens": head_counts.full_tokens,
                    "base_bytes": base_counts.full_bytes,
                    "head_bytes": head_counts.full_bytes,
                    "significant": full_significant,
                },
            }
        )

    return report


def render_markdown(report: dict) -> str:
    header = [
        COMMENT_MARKER,
        "## Skill Context Report",
        "",
        (
            "`Partial` counts the skill's `SKILL.md` only. "
            "`Full` counts `SKILL.md` plus any files under `references/`."
        ),
        (
            "Each cell is `base -> head (delta, percent change)` for the pull request."
        ),
        "Only skills changed in the pull request are included.",
        "",
    ]

    lines = header + [
        "| Skill | Partial | Full |",
        "| --- | --- | --- |",
    ]
    for skill in report["skills"]:
        lines.append(
            "| "
            f"`{skill['skill']}` | "
            f"{fmt_delta(skill['partial']['base_tokens'], skill['partial']['head_tokens'])} | "
            f"{fmt_delta(skill['full']['base_tokens'], skill['full']['head_tokens'])} |"
        )

    return "\n".join(lines)


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-ref", required=True)
    parser.add_argument("--head-ref", required=True)
    parser.add_argument("--encoding", default="cl100k_base")
    parser.add_argument("--min-abs-delta", type=int, default=20)
    parser.add_argument("--min-percent-delta", type=float, default=5.0)
    parser.add_argument("--json-out")
    parser.add_argument("--markdown-out")
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    report = build_report(
        base_ref=args.base_ref,
        head_ref=args.head_ref,
        encoding_name=args.encoding,
        min_abs_delta=args.min_abs_delta,
        min_percent_delta=args.min_percent_delta,
    )

    markdown = render_markdown(report)
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2, sort_keys=True)
            handle.write("\n")
    if args.markdown_out:
        with open(args.markdown_out, "w", encoding="utf-8") as handle:
            handle.write(markdown)
            handle.write("\n")

    if not args.json_out and not args.markdown_out:
        sys.stdout.write(markdown)
        sys.stdout.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
