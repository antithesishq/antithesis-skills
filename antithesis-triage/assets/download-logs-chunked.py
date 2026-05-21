#!/usr/bin/env python3
"""
download-logs-chunked.py — Chunked fallback for `snouty runs logs`.

Called by download-logs.sh when the one-shot `snouty runs --json logs`
fetch times out on long histories. Walks backward from the requested
(INPUT_HASH, VTIME) in adaptive vtime windows, fetching one chunk at a
time, stitching the chunks (with boundary dedup) into a single NDJSON
file at -o PATH.

Adaptive rules
--------------
- Initial lookback window: 60 seconds of virtual time.
- Each chunk fetched by: snouty runs --json logs --begin-vtime <BV>
  RUN_ID INPUT_HASH VTIME, where INPUT_HASH/VTIME is the *current anchor*
  (originally the user's target; thereafter the earliest event of the
  previously-fetched chunk).
- Timeout (stderr matches "operation timed out" / "timed out"): halve the
  current lookback and retry the same anchor. If lookback would drop
  below 1.0s, abort with a hard error.
- Empty read — the chunk contains only the anchor moment echoed back, or
  zero events: keep the same anchor and DOUBLE the lookback for THIS
  attempt only. On a subsequent non-empty read, the next iteration uses
  the *current* (possibly-halved-by-timeout) lookback, not the inflated
  value.
- Walking past the floor (default 0, or --begin-vtime if user supplied):
  drop the --begin-vtime flag and try one final unbounded fetch. If that
  too times out, fall back to chunking with a smaller lookback against
  the floor.
- Reaching the floor with no further events is not a failure — we return
  what we have.

Boundary dedup
--------------
Each chunk's last event is, by construction, the anchor we passed in.
That anchor is the *first* event of the previously-fetched chunk. So
adjacent chunks (in chronological order) share exactly one event at the
boundary. When stitching, drop the first event of every chunk except the
oldest.

CLI
---
download-logs-chunked.py -o PATH [--begin-vtime FLOOR] RUN_ID INPUT_HASH VTIME

Exit codes:
  0  success (possibly partial coverage)
  1  hard failure (lookback exhausted, snouty error other than timeout,
     or unparseable event)
  2  usage error
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from typing import Any


INITIAL_LOOKBACK = 60.0
MIN_LOOKBACK = 1.0
EMPTY_EXTEND_FACTOR = 2.0
TIMEOUT_SHRINK_FACTOR = 2.0
TIMEOUT_PATTERNS = ("operation timed out", "timed out")


def is_timeout(stderr: str) -> bool:
    s = stderr.lower()
    return any(p in s for p in TIMEOUT_PATTERNS)


def fetch_chunk(
    run_id: str,
    input_hash: str,
    vtime: str,
    begin_vtime: float | None,
) -> tuple[bool, list[dict[str, Any]], bool]:
    """
    Fetch one chunk. Returns (ok, events, timed_out).
      ok=True, timed_out=False  -> success; events is the parsed list
      ok=False, timed_out=True  -> snouty timed out; caller retries
      ok=False, timed_out=False -> snouty failed for some other reason;
                                   stderr already printed to our stderr
    """
    cmd = ["snouty", "runs", "--json", "logs", run_id, input_hash, vtime]
    if begin_vtime is not None:
        cmd += ["--begin-vtime", f"{begin_vtime:.6f}"]
    print("chunked: " + " ".join(cmd), file=sys.stderr)

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        if is_timeout(res.stderr):
            return False, [], True
        sys.stderr.write(res.stderr)
        return False, [], False

    events: list[dict[str, Any]] = []
    for line in res.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError as e:
            print(f"chunked: warn: failed to parse NDJSON line: {e}", file=sys.stderr)
    return True, events, False


def is_only_anchor(
    events: list[dict[str, Any]], anchor_hash: str, anchor_vtime: str
) -> bool:
    """True if the chunk is empty or contains only the anchor moment."""
    if not events:
        return True
    if len(events) == 1:
        m = events[0].get("moment") or {}
        return (
            m.get("input_hash") == anchor_hash
            and m.get("vtime") == anchor_vtime
        )
    return False


def chunked_download(
    run_id: str,
    target_hash: str,
    target_vtime: str,
    floor_vtime: float,
) -> list[dict[str, Any]] | None:
    """
    Walk backward from (target_hash, target_vtime) toward floor_vtime.
    Returns events in chronological order, or None on hard failure.
    """
    fetched: list[list[dict[str, Any]]] = []  # newest-fetched first
    cur_hash = target_hash
    cur_vtime_s = target_vtime  # keep the original string for snouty
    cur_vtime_f = float(target_vtime)
    lookback = INITIAL_LOOKBACK

    while cur_vtime_f > floor_vtime:
        # Per-iteration extension state, reset each outer iteration.
        empty_extension = lookback
        chunk_data: list[dict[str, Any]] | None = None
        was_unbounded = False

        # Inner loop handles timeouts and empty-extension retries for the
        # current anchor.
        while True:
            tentative_begin = cur_vtime_f - empty_extension
            use_begin = tentative_begin > floor_vtime
            begin_vtime = tentative_begin if use_begin else None

            ok, events, timed_out = fetch_chunk(
                run_id, cur_hash, cur_vtime_s, begin_vtime
            )

            if not ok and timed_out:
                lookback = lookback / TIMEOUT_SHRINK_FACTOR
                if lookback < MIN_LOOKBACK:
                    print(
                        f"chunked: lookback would drop below {MIN_LOOKBACK}s; aborting",
                        file=sys.stderr,
                    )
                    return None
                empty_extension = lookback
                print(
                    f"chunked: timeout — shrinking lookback to {lookback}s",
                    file=sys.stderr,
                )
                continue

            if not ok:
                # non-timeout snouty failure — stderr already printed
                return None

            if is_only_anchor(events, cur_hash, cur_vtime_s):
                if not use_begin:
                    # We just tried the unbounded fetch and got only the
                    # anchor (or nothing). No more data exists; stop.
                    chunk_data = None
                    break
                empty_extension *= EMPTY_EXTEND_FACTOR
                print(
                    f"chunked: empty window — extending lookback to {empty_extension}s",
                    file=sys.stderr,
                )
                continue

            chunk_data = events
            was_unbounded = not use_begin
            break

        if chunk_data is None:
            # No more data backward from the current anchor; done.
            break

        fetched.append(chunk_data)

        if was_unbounded:
            # An unbounded fetch (no --begin-vtime) returns everything from
            # start-of-run up to the anchor. We have everything backward;
            # no further iterations needed.
            break

        # Next anchor: earliest event in this chunk.
        first = chunk_data[0]
        m = first.get("moment") or {}
        next_hash = m.get("input_hash")
        next_vtime_s = m.get("vtime")
        if next_hash is None or next_vtime_s is None:
            print(
                "chunked: first event has no moment.input_hash/vtime; aborting",
                file=sys.stderr,
            )
            return None

        try:
            next_vtime_f = float(next_vtime_s)
        except (TypeError, ValueError):
            print(
                f"chunked: first event has non-numeric vtime {next_vtime_s!r}; aborting",
                file=sys.stderr,
            )
            return None

        # Safety: if we somehow didn't advance backward, stop to avoid
        # an infinite loop.
        if next_vtime_f >= cur_vtime_f:
            print(
                f"chunked: anchor did not advance backward ({next_vtime_f} >= {cur_vtime_f}); stopping",
                file=sys.stderr,
            )
            break

        cur_hash = next_hash
        cur_vtime_s = next_vtime_s
        cur_vtime_f = next_vtime_f

    if not fetched:
        return []

    # Stitch: fetched is in fetch order (newest first). Reverse for
    # chronological. Drop the first event of every chunk except the
    # oldest — it is the duplicate boundary with the previous chunk.
    fetched.reverse()
    result = list(fetched[0])
    for chunk in fetched[1:]:
        result.extend(chunk[1:])
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Chunked fallback for snouty runs logs",
    )
    parser.add_argument("-o", "--output", required=True, help="Output NDJSON path")
    parser.add_argument(
        "--begin-vtime",
        type=float,
        default=0.0,
        help="Floor vtime (do not walk past this point). Default 0.",
    )
    parser.add_argument("run_id")
    parser.add_argument("input_hash")
    parser.add_argument("vtime")
    args = parser.parse_args()

    if args.begin_vtime < 0:
        print("chunked: --begin-vtime must be >= 0", file=sys.stderr)
        return 2

    result = chunked_download(
        args.run_id, args.input_hash, args.vtime, args.begin_vtime
    )
    if result is None:
        return 1

    with open(args.output, "w") as f:
        for ev in result:
            f.write(json.dumps(ev) + "\n")

    print(
        f"chunked: wrote {len(result)} events to {args.output}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
