#!/usr/bin/env python3
"""Strip ANSI escape codes from output_text fields in an Antithesis JSON log.

Usage: python3 strip-log-escapes.py < events.json > clean.json
       python3 strip-log-escapes.py events.json -o clean.json
       python3 strip-log-escapes.py events.json  # prints to stdout
       python3 strip-log-escapes.py --test       # run unit tests
"""

import argparse
import json
import re
import sys

ANSI_RE = re.compile(
    r"\x1b\[[\x20-\x3f]*[\x40-\x7e]"  # CSI: ESC [ ... final
    r"|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"  # OSC: ESC ] ... (BEL | ESC \)
    r"|\x1b[\x20-\x7e]"  # two-byte: ESC + single printable
)


def strip_ansi(text):
    return ANSI_RE.sub("", text)


def strip_event(event):
    if "output_text" in event and isinstance(event["output_text"], str):
        event = {**event, "output_text": strip_ansi(event["output_text"])}
    return event


def main():
    parser = argparse.ArgumentParser(
        description="Strip ANSI escape codes from output_text fields in an Antithesis JSON log.",
    )
    parser.add_argument("input", nargs="?", help="input JSON log (default: stdin)")
    parser.add_argument("-o", "--output", help="output file (default: stdout)")
    parser.add_argument("--test", action="store_true", help="run unit tests")
    args = parser.parse_args()

    if args.test:
        return run_tests()

    src = open(args.input) if args.input else sys.stdin
    try:
        events = json.load(src)
    finally:
        if src is not sys.stdin:
            src.close()

    events = [strip_event(e) for e in events]

    dst = open(args.output, "w") if args.output else sys.stdout
    try:
        json.dump(events, dst, ensure_ascii=False)
        dst.write("\n")
    finally:
        if dst is not sys.stdout:
            dst.close()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def run_tests():
    failures = 0

    def check(name, input_text, expected=None):
        nonlocal failures
        if expected is None:
            expected = input_text
        result = strip_ansi(input_text)
        if result != expected:
            print(f"FAIL: {name}")
            print(f"  input:    {input_text!r}")
            print(f"  expected: {expected!r}")
            print(f"  got:      {result!r}")
            failures += 1
        else:
            print(f"  ok: {name}")

    # -- SGR (colors, bold, etc) --
    check("bold + reset", "\x1b[1mbold\x1b[0m", "bold")
    check("256 color", "\x1b[38;5;196mred\x1b[0m", "red")
    check("RGB color", "\x1b[38;2;255;0;0mred\x1b[0m", "red")
    check("multiple SGR params", "\x1b[1;31;42mtext\x1b[0m", "text")
    check(
        "typical tracing-subscriber line",
        "\x1b[2m2026-04-03T08:19:54Z\x1b[0m \x1b[32m INFO\x1b[0m"
        " \x1b[2mfoobar\x1b[0m\x1b[2m:\x1b[0m ready",
        "2026-04-03T08:19:54Z  INFO foobar: ready",
    )

    # -- CSI non-SGR (cursor, erase, DEC private) --
    check("cursor up", "before\x1b[2Aafter", "beforeafter")
    check("erase line", "text\x1b[2K", "text")
    check("DEC show cursor", "\x1b[?25hvisible", "visible")
    check("DEC hide cursor", "\x1b[?25l hidden", " hidden")

    # -- OSC sequences --
    check("OSC window title (BEL terminated)", "\x1b]0;my window title\x07text after", "text after")
    check("OSC window title (ST terminated)", "\x1b]0;my title\x1b\\text after", "text after")

    # -- Two-byte escapes --
    check("ESC c (reset)", "\x1bcafter reset", "after reset")
    check("ESC 7 (save cursor)", "before\x1b7after", "beforeafter")

    # -- Must NOT damage these --
    check("plain text passthrough", "no escapes here")
    check("inline JSON preserved", '{"key": "value", "nested": {"a": [1,2,3]}}')
    check("JSON with special chars", '{"url": "http://example.com/path?q=1&r=2", "count": 42}')
    check(
        "Rust Debug struct preserved",
        'Options { address: Some(0.0.0.0:3307), deployment: "mydb", mode: Standalone }',
    )
    check(
        "Rust Debug with nested braces",
        'Config { inner: Inner { values: [1, 2, 3] }, name: "test" }',
    )
    check("square brackets in text", "[2026-04-03] [INFO] [main] started")
    check("backslash in paths", 'path: "/nix/store/abc-pkg/bin/cmd"')
    check("escaped quotes in JSON", '{"msg": "he said \\"hello\\""}')

    # -- Mixed: escapes around JSON/structs --
    check("escape codes wrapping JSON", '\x1b[2m{"key": "value"}\x1b[0m', '{"key": "value"}')
    check(
        "escape codes wrapping Rust Debug",
        "\x1b[3mOptions { mode: Standalone }\x1b[0m",
        "Options { mode: Standalone }",
    )
    check(
        "tracing line with JSON payload",
        "\x1b[2m2026-04-03T00:00:00Z\x1b[0m \x1b[32m INFO\x1b[0m"
        ' request completed {"status": 200, "latency_ms": 42}',
        '2026-04-03T00:00:00Z  INFO request completed {"status": 200, "latency_ms": 42}',
    )

    # -- Event-level tests --
    def assert_eq(name, got, expected):
        nonlocal failures
        if got != expected:
            print(f"FAIL: {name}")
            print(f"  expected: {expected!r}")
            print(f"  got:      {got!r}")
            failures += 1
        else:
            print(f"  ok: {name}")

    evt = {"output_text": "\x1b[1mhi\x1b[0m", "fault": {"name": "kill"}, "other": "\x1b[1mkeep\x1b[0m"}
    result = strip_event(evt)
    assert_eq("strip_event strips output_text", result["output_text"], "hi")
    assert_eq("strip_event does not mutate input", evt["output_text"], "\x1b[1mhi\x1b[0m")
    assert_eq("strip_event preserves other fields", result["other"], "\x1b[1mkeep\x1b[0m")

    print()
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    else:
        print("all tests passed")


if __name__ == "__main__":
    main()
