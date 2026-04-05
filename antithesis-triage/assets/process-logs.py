#!/usr/bin/env python3
"""Process an Antithesis JSON log: strip ANSI escapes, add vtime_seconds, track active faults.

Transformations applied to each event:
  1. Strip ANSI escape codes from output_text fields.
  2. Add vtime_seconds (moment._vtime_ticks / 2^32, rounded to 5 decimal places).
  3. Add active_faults dict tracking currently open fault windows.

Usage: python3 process-logs.py < events.json > processed.json
       python3 process-logs.py events.json -o processed.json
       python3 process-logs.py events.json  # prints to stdout
       python3 process-logs.py --test       # run unit tests
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

VTIME_DIVISOR = 4294967296  # 2^32

# Fault names that represent network fault windows (not instantaneous).
NETWORK_FAULTS = {"partition", "clog"}


def strip_ansi(text):
    return ANSI_RE.sub("", text)


def process_events(events):
    """Process all events in a single pass: strip ANSI, add vtime_seconds, track active_faults."""
    active_faults = {}
    faults_snapshot = {}
    faults_dirty = True
    result = []

    for event in events:
        processed = dict(event)

        # Strip ANSI from output_text
        output_text = processed.get("output_text")
        if isinstance(output_text, str) and "\x1b" in output_text:
            processed["output_text"] = strip_ansi(output_text)

        # Compute vtime_seconds
        moment = processed.get("moment")
        if isinstance(moment, dict) and "_vtime_ticks" in moment:
            vtime_seconds = round(moment["_vtime_ticks"] / VTIME_DIVISOR, 5)
            processed["vtime_seconds"] = vtime_seconds

        # Track active fault windows
        fault = processed.get("fault")
        if isinstance(fault, dict):
            fault_name = fault.get("name")
            if fault_name in NETWORK_FAULTS:
                affected = fault.get("affected_nodes")
                if affected:
                    active_faults[fault_name] = processed.get("vtime_seconds", 0.0)
                else:
                    active_faults.pop(fault_name, None)
                faults_dirty = True
            elif fault_name == "restore":
                if active_faults:
                    active_faults.clear()
                    faults_dirty = True

        if faults_dirty:
            faults_snapshot = active_faults.copy()
            faults_dirty = False
        processed["active_faults"] = faults_snapshot

        result.append(processed)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Process an Antithesis JSON log: strip ANSI escapes, add vtime_seconds, track active faults.",
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

    events = process_events(events)

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

    def assert_eq(name, got, expected):
        nonlocal failures
        if got != expected:
            print(f"FAIL: {name}")
            print(f"  expected: {expected!r}")
            print(f"  got:      {got!r}")
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
    check("cursor up", "left\x1b[2Aright", "leftright")
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

    # -- Event-level: ANSI stripping via process_events --
    evt = {
        "output_text": "\x1b[1mhi\x1b[0m",
        "fault": {"name": "kill"},
        "other": "\x1b[1mkeep\x1b[0m",
    }
    results = process_events([evt])
    assert_eq("process_events strips output_text", results[0]["output_text"], "hi")
    assert_eq("process_events does not mutate input", evt["output_text"], "\x1b[1mhi\x1b[0m")
    assert_eq("process_events preserves other fields", results[0]["other"], "\x1b[1mkeep\x1b[0m")

    # -- vtime_seconds computation --
    print()
    print("vtime_seconds tests:")
    evt_with_moment = {"moment": {"_vtime_ticks": 4294967296}}  # exactly 2^32 => 1.0
    results = process_events([evt_with_moment])
    assert_eq("vtime_seconds = 1.0 for 2^32 ticks", results[0]["vtime_seconds"], 1.0)

    evt_half = {"moment": {"_vtime_ticks": 2147483648}}  # 2^31 => 0.5
    results = process_events([evt_half])
    assert_eq("vtime_seconds = 0.5 for 2^31 ticks", results[0]["vtime_seconds"], 0.5)

    evt_precise = {"moment": {"_vtime_ticks": 12345678901}}
    results = process_events([evt_precise])
    expected_vtime = round(12345678901 / 4294967296, 5)
    assert_eq("vtime_seconds 5 decimal places", results[0]["vtime_seconds"], expected_vtime)
    # Verify it's actually rounded to 5 places
    vtime_str = str(results[0]["vtime_seconds"])
    parts = vtime_str.split(".")
    assert_eq("vtime_seconds decimal precision <= 5", len(parts[1]) <= 5, True)

    evt_zero = {"moment": {"_vtime_ticks": 0}}
    results = process_events([evt_zero])
    assert_eq("vtime_seconds = 0.0 for 0 ticks", results[0]["vtime_seconds"], 0.0)

    # Event without moment field should not get vtime_seconds
    evt_no_moment = {"output_text": "hello"}
    results = process_events([evt_no_moment])
    assert_eq("no vtime_seconds when no moment", "vtime_seconds" not in results[0], True)
    assert_eq("active_faults present even without moment", "active_faults" in results[0], True)

    # -- active_faults tracking --
    print()
    print("active_faults tests:")

    # Partition opens a fault window
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
    ]
    results = process_events(events)
    assert_eq("partition opens fault window", results[0]["active_faults"], {"partition": 1.0})

    # Restore closes network faults
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {"fault": {"name": "restore"}, "moment": {"_vtime_ticks": 8589934592}},  # vtime=2.0
    ]
    results = process_events(events)
    assert_eq("partition visible on first event", results[0]["active_faults"], {"partition": 1.0})
    assert_eq("restore clears network faults", results[1]["active_faults"], {})

    # Clog opens a fault window
    events = [
        {
            "fault": {"name": "clog", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
    ]
    results = process_events(events)
    assert_eq("clog opens fault window", results[0]["active_faults"], {"clog": 1.0})

    # Clog replaces previous clog
    events = [
        {
            "fault": {"name": "clog", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {
            "fault": {"name": "clog", "affected_nodes": ["node-2"]},
            "moment": {"_vtime_ticks": 8589934592},
        },  # vtime=2.0
    ]
    results = process_events(events)
    assert_eq("first clog", results[0]["active_faults"], {"clog": 1.0})
    assert_eq("second clog replaces first", results[1]["active_faults"], {"clog": 2.0})

    # Multiple concurrent faults
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["ALL"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {
            "fault": {"name": "clog", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 8589934592},
        },  # vtime=2.0
        {"output_text": "normal event", "moment": {"_vtime_ticks": 12884901888}},  # vtime=3.0
        {"fault": {"name": "restore"}, "moment": {"_vtime_ticks": 17179869184}},  # vtime=4.0
    ]
    results = process_events(events)
    assert_eq("partition only", results[0]["active_faults"], {"partition": 1.0})
    assert_eq("partition + clog", results[1]["active_faults"], {"partition": 1.0, "clog": 2.0})
    assert_eq(
        "both still active on normal event",
        results[2]["active_faults"],
        {"partition": 1.0, "clog": 2.0},
    )
    assert_eq("restore clears both", results[3]["active_faults"], {})

    # Instantaneous faults (kill, stop, pause, throttle, skip) do NOT track
    events = [
        {"fault": {"name": "kill"}, "moment": {"_vtime_ticks": 4294967296}},
        {"fault": {"name": "stop"}, "moment": {"_vtime_ticks": 4294967296}},
        {"fault": {"name": "pause"}, "moment": {"_vtime_ticks": 4294967296}},
        {"fault": {"name": "throttle"}, "moment": {"_vtime_ticks": 4294967296}},
        {"fault": {"name": "skip"}, "moment": {"_vtime_ticks": 4294967296}},
    ]
    results = process_events(events)
    for i, r in enumerate(results):
        assert_eq(
            f"instantaneous fault {events[i]['fault']['name']} not tracked", r["active_faults"], {}
        )

    # Restore after only instantaneous faults - no-op
    events = [
        {"fault": {"name": "kill"}, "moment": {"_vtime_ticks": 4294967296}},
        {"fault": {"name": "restore"}, "moment": {"_vtime_ticks": 8589934592}},
    ]
    results = process_events(events)
    assert_eq("restore after kill is empty", results[1]["active_faults"], {})

    # Partition then new partition replaces
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {
            "fault": {"name": "partition", "affected_nodes": ["node-2"]},
            "moment": {"_vtime_ticks": 8589934592},
        },  # vtime=2.0
    ]
    results = process_events(events)
    assert_eq("first partition", results[0]["active_faults"], {"partition": 1.0})
    assert_eq("second partition replaces", results[1]["active_faults"], {"partition": 2.0})

    # Empty affected_nodes closes the fault window
    events = [
        {
            "fault": {"name": "clog", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {
            "fault": {"name": "clog", "affected_nodes": []},
            "moment": {"_vtime_ticks": 8589934592},
        },  # vtime=2.0
    ]
    results = process_events(events)
    assert_eq("clog with nodes opens window", results[0]["active_faults"], {"clog": 1.0})
    assert_eq("clog with empty nodes closes window", results[1]["active_faults"], {})

    # Missing affected_nodes closes the fault window
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["ALL"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {"fault": {"name": "partition"}, "moment": {"_vtime_ticks": 8589934592}},  # vtime=2.0
    ]
    results = process_events(events)
    assert_eq("partition with nodes opens window", results[0]["active_faults"], {"partition": 1.0})
    assert_eq("partition without affected_nodes closes window", results[1]["active_faults"], {})

    # Empty affected_nodes only closes its own fault type
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["ALL"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {
            "fault": {"name": "clog", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 8589934592},
        },  # vtime=2.0
        {
            "fault": {"name": "clog", "affected_nodes": []},
            "moment": {"_vtime_ticks": 12884901888},
        },  # vtime=3.0
    ]
    results = process_events(events)
    assert_eq("both active", results[1]["active_faults"], {"partition": 1.0, "clog": 2.0})
    assert_eq("empty clog closes only clog", results[2]["active_faults"], {"partition": 1.0})

    # Event without moment gets active_faults but no vtime_seconds
    events = [
        {
            "fault": {"name": "partition", "affected_nodes": ["node-1"]},
            "moment": {"_vtime_ticks": 4294967296},
        },  # vtime=1.0
        {"output_text": "no moment here"},
    ]
    results = process_events(events)
    assert_eq(
        "event without moment still gets active_faults",
        results[1]["active_faults"],
        {"partition": 1.0},
    )
    assert_eq("event without moment has no vtime_seconds", "vtime_seconds" not in results[1], True)

    print()
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    else:
        print("all tests passed")


if __name__ == "__main__":
    main()
