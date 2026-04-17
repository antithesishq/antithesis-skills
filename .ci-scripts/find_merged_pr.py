#!/usr/bin/env python3
"""Find the merged PR associated with a commit on main.

Stdlib-only; safe to invoke with the system python3 before an
`actions/setup-python` step has run.

Uses two strategies, in order:

  1. Fast path: parse the PR number from the squash-merge commit subject
     (which ends with "(#N)") and look up the PR directly. Avoids the
     commits/{sha}/pulls indexer, which lags behind the push event. The
     looked-up PR is only accepted if its merge_commit_sha matches the
     commit we were asked about — otherwise a commit whose subject
     happens to end with "(#N)" (a cherry-pick, a manually-edited
     subject) could be misattributed.

  2. Fallback: retry commits/{sha}/pulls to cover indexer lag for
     commits whose subject doesn't carry a PR ref (e.g. a direct push
     to main).

Exit code is 0 in all normal cases, including "no PR found" and any
unexpected error. Diagnostics are written to stderr.

Writes GitHub Actions step-output lines when a PR is found:

  number=<N>
  entry=<formatted changelog entry line>
  has_changelog=<"changelog - ..." label name, or empty>
  breaking=<"changelog - breaking", or empty>

When no PR is found, no output keys are emitted — downstream steps
should gate on `steps.<id>.outputs.has_changelog != ''`.

Output is written to `$GITHUB_OUTPUT` when that env var is set
(normal GitHub Actions behavior), otherwise to stdout.

Usage:

  python3 .ci-scripts/find_merged_pr.py lookup --sha "$COMMIT_SHA" --repo "$REPO"
"""

from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import subprocess
import sys
import time
import uuid

# Fallback retry budget: ~100s total. The motivating incident
# (workflow run 24579805689) had 3 x 10s = 30s, which wasn't enough.
FALLBACK_ATTEMPTS = 6
FALLBACK_DELAY_S = 20
GH_API_TIMEOUT_S = 30
PR_REF_RE = re.compile(r"\(#(\d+)\)$")
WHITESPACE_RE = re.compile(r"\s+")


def _gh_api(path: str):
    """Call `gh api <path>`; return parsed JSON or None on failure."""
    try:
        result = subprocess.run(
            ["gh", "api", path],
            capture_output=True,
            text=True,
            timeout=GH_API_TIMEOUT_S,
        )
    except FileNotFoundError:
        print("gh CLI not found on PATH", file=sys.stderr)
        return None
    except subprocess.TimeoutExpired:
        print(f"gh api {path} timed out after {GH_API_TIMEOUT_S}s", file=sys.stderr)
        return None
    if result.returncode != 0:
        if result.stderr:
            print(result.stderr.rstrip(), file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def _pr_number_from_subject(repo: str, sha: str) -> int | None:
    """Parse the squash-merge PR reference from the commit subject."""
    payload = _gh_api(f"repos/{repo}/commits/{sha}")
    if not isinstance(payload, dict):
        return None
    message = payload.get("commit", {}).get("message", "") or ""
    subject = message.splitlines()[0].rstrip() if message else ""
    match = PR_REF_RE.search(subject)
    if not match:
        return None
    return int(match.group(1))


def _fetch_pr(repo: str, number: int, sha: str) -> dict | None:
    """Fetch a PR, but only if it merged this specific commit."""
    payload = _gh_api(f"repos/{repo}/pulls/{number}")
    if not isinstance(payload, dict):
        return None
    if not payload.get("merged"):
        return None
    if payload.get("merge_commit_sha") != sha:
        return None
    return payload


def _fetch_pr_for_sha(repo: str, sha: str) -> dict | None:
    """Retry commits/{sha}/pulls to cover indexer lag."""
    for attempt in range(1, FALLBACK_ATTEMPTS + 1):
        payload = _gh_api(f"repos/{repo}/commits/{sha}/pulls")
        if isinstance(payload, list) and payload:
            return payload[0]
        if attempt < FALLBACK_ATTEMPTS:
            print(
                f"Attempt {attempt}/{FALLBACK_ATTEMPTS}: no PR found, "
                f"retrying in {FALLBACK_DELAY_S}s...",
                file=sys.stderr,
            )
            time.sleep(FALLBACK_DELAY_S)
    return None


def _changelog_label(pr: dict) -> str:
    for label in pr.get("labels") or []:
        name = label.get("name", "")
        if name.startswith("changelog - "):
            return name
    return ""


def _format_entry(pr: dict) -> str:
    # Collapse any internal whitespace (including stray newlines from an API
    # that allows them) to a single space so the entry stays on one line in
    # CHANGELOG.md and in GITHUB_OUTPUT.
    title = WHITESPACE_RE.sub(" ", pr["title"]).strip()
    return f"{title} ([PR #{pr['number']}]({pr['html_url']}))"


def _emit(key: str, value, *, stream) -> None:
    """Emit a step-output line; use a heredoc when value contains newlines."""
    text = str(value)
    if "\n" in text:
        delim = f"EOF_{uuid.uuid4().hex}"
        print(f"{key}<<{delim}", file=stream)
        print(text, file=stream)
        print(delim, file=stream)
    else:
        print(f"{key}={text}", file=stream)


@contextlib.contextmanager
def _output_stream():
    """Write to $GITHUB_OUTPUT when set, else stdout."""
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as stream:
            yield stream
    else:
        yield sys.stdout


def cmd_lookup(sha: str, repo: str) -> dict[str, str]:
    """Look up the merged PR for a commit and return the output keys."""
    pr: dict | None = None

    number = _pr_number_from_subject(repo, sha)
    if number is not None:
        print(f"Parsed PR #{number} from commit subject", file=sys.stderr)
        pr = _fetch_pr(repo, number, sha)
        if pr is None:
            print(
                f"PR #{number} did not merge {sha[:7]} — falling back",
                file=sys.stderr,
            )

    if pr is None:
        print("Falling back to commit-to-PR lookup", file=sys.stderr)
        pr = _fetch_pr_for_sha(repo, sha)

    if pr is None:
        print("No PR found for commit — skipping", file=sys.stderr)
        return {}

    has_changelog = _changelog_label(pr)
    breaking = has_changelog if has_changelog == "changelog - breaking" else ""

    return {
        "number": str(pr["number"]),
        "entry": _format_entry(pr),
        "has_changelog": has_changelog,
        "breaking": breaking,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Find the merged PR for a commit on main"
    )
    sub = parser.add_subparsers(dest="command")

    lookup = sub.add_parser("lookup", help="Look up the merged PR for a commit")
    lookup.add_argument("--sha", required=True, help="Commit SHA on main")
    lookup.add_argument("--repo", required=True, help="owner/name")

    args = parser.parse_args()
    if args.command is None:
        parser.print_help()
        return 1

    try:
        outputs = cmd_lookup(args.sha, args.repo)
    except Exception as exc:
        print(f"Unexpected error: {exc}", file=sys.stderr)
        outputs = {}

    with _output_stream() as stream:
        for key, value in outputs.items():
            _emit(key, value, stream=stream)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
