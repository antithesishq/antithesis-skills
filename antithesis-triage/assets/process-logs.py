#!/usr/bin/env python3
"""Process an Antithesis JSON log: strip ANSI escapes, add vtime_seconds, track active faults.

Transformations applied to each event:
  1. Strip ANSI escape codes from output_text fields.
  2. Add vtime_seconds (moment._vtime_ticks / 2^32, rounded to 5 decimal places).
  3. Add active_faults dict tracking currently open fault windows:
     - network_partition / network_clog: outer boundary of overlapping network faults
     - node_pause / node_throttle: per-container node fault windows
     - clock_skip: cumulative clock offset (permanent + active jitter)

Usage: python3 process-logs.py < events.json > processed.json
       python3 process-logs.py events.json -o processed.json
       python3 process-logs.py events.json  # prints to stdout
       python3 process-logs.py --test       # run unit tests
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass

ANSI_RE = re.compile(
    r"\x1b\[[\x20-\x3f]*[\x40-\x7e]"  # CSI: ESC [ ... final
    r"|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"  # OSC: ESC ] ... (BEL | ESC \)
    r"|\x1b[\x20-\x7e]"  # two-byte: ESC + single printable
)

VTIME_DIVISOR = 4294967296  # 2^32

NETWORK_FAULTS = {"partition", "clog"}
TRACKED_NODE_FAULTS = {"pause", "throttle"}


@dataclass
class FaultWindow:
    fault_type: str  # "network", "node", or "clock"
    fault_name: str  # "partition", "clog", "pause", "throttle", "skip"
    start_vtime: float
    end_vtime: float | None  # None = no natural end (permanent clock offsets)
    container: str | None  # for node faults only
    offset: float  # for clock/skip only (0.0 for non-clock)


def strip_ansi(text):
    return ANSI_RE.sub("", text)


def _valid_max_duration(max_dur):
    """Return max_dur as a positive float, or None if absent/zero/string."""
    if isinstance(max_dur, (int, float)) and max_dur > 0:
        return float(max_dur)
    return None


def _build_active_faults(windows):
    """Reduce internal fault windows into the active_faults snapshot."""
    result = {}
    for w in windows:
        if w.fault_type == "network":
            result[f"network_{w.fault_name}"] = {"vtime": w.start_vtime}
        elif w.fault_type == "node":
            key = f"node_{w.fault_name}"
            if key not in result:
                result[key] = {}
            result[key][w.container] = w.start_vtime
    # Clock: sum offsets of all active clock windows, use most recent vtime
    clock_windows = [w for w in windows if w.fault_type == "clock"]
    if clock_windows:
        cumulative = sum(w.offset for w in clock_windows)
        latest_vtime = max(w.start_vtime for w in clock_windows)
        if cumulative != 0.0:
            result["clock_skip"] = {"cumulative_offset": cumulative, "vtime": latest_vtime}
    return result


def process_events(events):
    """Process all events in a single pass: strip ANSI, add vtime_seconds, track active_faults."""
    fault_windows = []
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
        vtime = None
        if isinstance(moment, dict) and "_vtime_ticks" in moment:
            vtime = round(moment["_vtime_ticks"] / VTIME_DIVISOR, 5)
            processed["vtime_seconds"] = vtime

        ev_vtime = vtime if vtime is not None else 0.0

        # Only process fault/info events from the fault injector source.
        source = processed.get("source")
        is_fault_injector = isinstance(source, dict) and source.get("name") == "fault_injector"

        # --- Stage 1: Expire windows ---
        if vtime is not None and fault_windows:
            before = len(fault_windows)
            fault_windows[:] = [
                w for w in fault_windows if w.end_vtime is None or w.end_vtime > vtime
            ]
            if len(fault_windows) != before:
                faults_dirty = True

        # --- Stage 2: Info events ---
        info = processed.get("info")
        if is_fault_injector and isinstance(info, dict) and info.get("message") == "status":
            details = info.get("details", {})
            if details.get("paused") is True:
                # Clear network and node windows; clock windows survive pause
                before = len(fault_windows)
                fault_windows[:] = [w for w in fault_windows if w.fault_type == "clock"]
                if len(fault_windows) != before:
                    faults_dirty = True

        # --- Stage 3: Fault events ---
        fault = processed.get("fault")
        if is_fault_injector and isinstance(fault, dict):
            fault_name = fault.get("name")
            fault_type = fault.get("type")
            affected = fault.get("affected_nodes") or []
            max_dur = _valid_max_duration(fault.get("max_duration"))

            # Network faults: outer boundary tracking
            if fault_name in NETWORK_FAULTS and affected:
                new_end = (ev_vtime + max_dur) if max_dur else None
                # After expiration, any remaining window of same name is active
                existing = next(
                    (w for w in fault_windows
                     if w.fault_type == "network" and w.fault_name == fault_name),
                    None,
                )
                if existing is not None:
                    # Extend if new fault reaches beyond existing
                    if existing.end_vtime is not None and (
                        new_end is None or new_end > existing.end_vtime
                    ):
                        existing.end_vtime = new_end
                        faults_dirty = True
                    # else: completely covered, ignore
                else:
                    fault_windows.append(
                        FaultWindow(
                            fault_type="network",
                            fault_name=fault_name,
                            start_vtime=ev_vtime,
                            end_vtime=new_end,
                            container=None,
                            offset=0.0,
                        )
                    )
                    faults_dirty = True

            elif fault_name == "restore":
                before = len(fault_windows)
                fault_windows[:] = [w for w in fault_windows if w.fault_type != "network"]
                if len(fault_windows) != before:
                    faults_dirty = True

            elif fault_name in TRACKED_NODE_FAULTS and fault_type == "node":
                if affected:
                    container = affected[0]
                    end_vt = (ev_vtime + max_dur) if max_dur else None
                    fault_windows.append(
                        FaultWindow(
                            fault_type="node",
                            fault_name=fault_name,
                            start_vtime=ev_vtime,
                            end_vtime=end_vt,
                            container=container,
                            offset=0.0,
                        )
                    )
                    faults_dirty = True

            elif fault_name == "skip" and fault_type == "clock":
                det = fault.get("details")
                offset = det.get("offset", 0.0) if isinstance(det, dict) else 0.0
                if offset != 0.0:
                    end_vt = (ev_vtime + max_dur) if max_dur else None
                    fault_windows.append(
                        FaultWindow(
                            fault_type="clock",
                            fault_name="skip",
                            start_vtime=ev_vtime,
                            end_vtime=end_vt,
                            container=None,
                            offset=offset,
                        )
                    )
                    faults_dirty = True

        # --- Stage 4: Reduce to snapshot ---
        if faults_dirty:
            faults_snapshot = _build_active_faults(fault_windows)
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


def _evt(vtime_sec, **kwargs):
    """Helper to create a test event at a given virtual time in seconds.

    Automatically adds source.name = "fault_injector" when fault or info keys
    are present, since process_events only processes those from that source.
    """
    event = {"moment": {"_vtime_ticks": int(vtime_sec * VTIME_DIVISOR)}, **kwargs}
    if "fault" in event or "info" in event:
        event.setdefault("source", {"name": "fault_injector"})
    return event


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

    # =====================================================================
    # active_faults: network faults
    # =====================================================================
    print()
    print("active_faults: network faults")

    # Partition opens a fault window
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
    ])
    assert_eq("partition opens fault window", results[0]["active_faults"],
              {"network_partition": {"vtime": 1.0}})

    # Clog opens a fault window
    results = process_events([
        _evt(1.0, fault={"name": "clog", "type": "network", "affected_nodes": ["node-1"], "max_duration": 100}),
    ])
    assert_eq("clog opens fault window", results[0]["active_faults"],
              {"network_clog": {"vtime": 1.0}})

    # Restore closes network faults
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("partition visible before restore", results[0]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("restore clears network faults", results[1]["active_faults"], {})

    # Multiple concurrent network faults (partition + clog)
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "clog", "type": "network", "affected_nodes": ["node-1"], "max_duration": 100}),
        _evt(3.0, output_text="normal event"),
        _evt(4.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("partition only", results[0]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("partition + clog", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}, "network_clog": {"vtime": 2.0}})
    assert_eq("both still active on normal event", results[2]["active_faults"],
              {"network_partition": {"vtime": 1.0}, "network_clog": {"vtime": 2.0}})
    assert_eq("restore clears both", results[3]["active_faults"], {})

    # Empty affected_nodes is a no-op (doesn't close existing window)
    results = process_events([
        _evt(1.0, fault={"name": "clog", "type": "network", "affected_nodes": ["node-1"], "max_duration": 100}),
        _evt(2.0, fault={"name": "clog", "type": "network", "affected_nodes": []}),
    ])
    assert_eq("clog with nodes opens window", results[0]["active_faults"],
              {"network_clog": {"vtime": 1.0}})
    assert_eq("empty nodes is noop", results[1]["active_faults"],
              {"network_clog": {"vtime": 1.0}})

    # Missing affected_nodes is a no-op
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "partition", "type": "network"}),
    ])
    assert_eq("partition with nodes opens window", results[0]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("missing nodes is noop", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}})

    # Event without moment gets active_faults but no vtime_seconds
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        {"output_text": "no moment here"},
    ])
    assert_eq("event without moment still gets active_faults", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("event without moment has no vtime_seconds", "vtime_seconds" not in results[1], True)

    # Untracked faults (kill, stop without type/affected_nodes) produce empty active_faults
    results = process_events([
        _evt(1.0, fault={"name": "kill"}),
        _evt(1.0, fault={"name": "stop"}),
    ])
    assert_eq("kill not tracked", results[0]["active_faults"], {})
    assert_eq("stop not tracked", results[1]["active_faults"], {})

    # Restore after only untracked faults is no-op
    results = process_events([
        _evt(1.0, fault={"name": "kill"}),
        _evt(2.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("restore after kill is empty", results[1]["active_faults"], {})

    # =====================================================================
    # active_faults: natural expiration
    # =====================================================================
    print()
    print("active_faults: natural expiration")

    # Partition expires via max_duration
    results = process_events([
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 10}),
        _evt(10.0, output_text="mid-window"),
        _evt(16.0, output_text="after expiry"),
    ])
    assert_eq("partition active mid-window", results[1]["active_faults"],
              {"network_partition": {"vtime": 5.0}})
    assert_eq("partition expired after max_duration", results[2]["active_faults"], {})

    # Clog expires via max_duration
    results = process_events([
        _evt(1.0, fault={"name": "clog", "type": "network", "affected_nodes": ["A"], "max_duration": 3}),
        _evt(5.0, output_text="after"),
    ])
    assert_eq("clog expired", results[1]["active_faults"], {})

    # Partition without max_duration never expires
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"]}),
        _evt(1000.0, output_text="much later"),
    ])
    assert_eq("no max_duration never expires", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}})

    # Expiration at exact boundary (end is exclusive: end_vtime <= vtime expires)
    results = process_events([
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 5}),
        _evt(10.0, output_text="at exact end"),
    ])
    assert_eq("expired at exact boundary", results[1]["active_faults"], {})

    # Restore before natural expiration
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(5.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("restore before expiration clears", results[1]["active_faults"], {})

    # =====================================================================
    # active_faults: network fault overlap (outer boundary tracking)
    # =====================================================================
    print()
    print("active_faults: network fault overlap")

    # Inner fault completely covered by outer — ignored
    results = process_events([
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 20}),
        _evt(10.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 5}),
        _evt(16.0, output_text="after inner would expire"),
        _evt(26.0, output_text="after outer expires"),
    ])
    assert_eq("inner partition ignored, outer still active", results[2]["active_faults"],
              {"network_partition": {"vtime": 5.0}})
    assert_eq("outer partition expires at 25", results[3]["active_faults"], {})

    # Extending fault: A=[10,15], B=[14,19] → window=[10,19]
    results = process_events([
        _evt(10.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 5}),
        _evt(14.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 5}),
        _evt(16.0, output_text="after original end, before extended end"),
        _evt(20.0, output_text="after extended end"),
    ])
    assert_eq("extending fault keeps original vtime", results[1]["active_faults"],
              {"network_partition": {"vtime": 10.0}})
    assert_eq("still active after original end (extended)", results[2]["active_faults"],
              {"network_partition": {"vtime": 10.0}})
    assert_eq("expired after extended end", results[3]["active_faults"], {})

    # Non-overlapping: first expires, then new one starts
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 3}),
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 3}),
    ])
    assert_eq("first partition", results[0]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("new partition after first expired", results[1]["active_faults"],
              {"network_partition": {"vtime": 5.0}})

    # Partition and clog overlap independently
    results = process_events([
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 20}),
        _evt(10.0, fault={"name": "clog", "type": "network", "affected_nodes": ["A"], "max_duration": 3}),
        _evt(14.0, output_text="clog expired, partition still active"),
    ])
    assert_eq("clog expired but partition still active", results[2]["active_faults"],
              {"network_partition": {"vtime": 5.0}})

    # Extending with None (no max_duration) absorbs finite end
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 5}),
        _evt(3.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"]}),
        _evt(100.0, output_text="much later"),
    ])
    assert_eq("None extends finite, keeps original vtime", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}})
    assert_eq("never expires after None extension", results[2]["active_faults"],
              {"network_partition": {"vtime": 1.0}})

    # Existing None absorbs any new fault
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"]}),
        _evt(3.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(5.0, output_text="check"),
    ])
    assert_eq("None absorbs new finite fault", results[2]["active_faults"],
              {"network_partition": {"vtime": 1.0}})

    # =====================================================================
    # active_faults: pause clears non-clock faults
    # =====================================================================
    print()
    print("active_faults: pause behavior")

    # Pause clears network and node windows
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 100}),
        _evt(3.0, info={"message": "status", "details": {"paused": True}}),
    ])
    assert_eq("network + node active before pause", results[1]["active_faults"],
              {"network_partition": {"vtime": 1.0}, "node_pause": {"A": 2.0}})
    assert_eq("pause clears network + node", results[2]["active_faults"], {})

    # Pause preserves clock windows
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
        _evt(2.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(3.0, info={"message": "status", "details": {"paused": True}}),
    ])
    assert_eq("clock survives pause", results[2]["active_faults"],
              {"clock_skip": {"cumulative_offset": 10.0, "vtime": 1.0}})

    # =====================================================================
    # active_faults: node pause/throttle
    # =====================================================================
    print()
    print("active_faults: node pause/throttle")

    # Node pause opens a window
    results = process_events([
        _evt(1.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 10}),
    ])
    assert_eq("node pause opens window", results[0]["active_faults"],
              {"node_pause": {"A": 1.0}})

    # Node throttle opens a window
    results = process_events([
        _evt(1.0, fault={"name": "throttle", "type": "node", "affected_nodes": ["B"], "max_duration": 10}),
    ])
    assert_eq("node throttle opens window", results[0]["active_faults"],
              {"node_throttle": {"B": 1.0}})

    # Multiple containers paused simultaneously
    results = process_events([
        _evt(1.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 100}),
        _evt(2.0, fault={"name": "pause", "type": "node", "affected_nodes": ["B"], "max_duration": 100}),
    ])
    assert_eq("multiple containers paused", results[1]["active_faults"],
              {"node_pause": {"A": 1.0, "B": 2.0}})

    # Mixed pause and throttle on different containers
    results = process_events([
        _evt(1.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 100}),
        _evt(2.0, fault={"name": "throttle", "type": "node", "affected_nodes": ["B"], "max_duration": 100}),
    ])
    assert_eq("mixed pause and throttle", results[1]["active_faults"],
              {"node_pause": {"A": 1.0}, "node_throttle": {"B": 2.0}})

    # Node pause expires via max_duration
    results = process_events([
        _evt(1.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 5}),
        _evt(3.0, output_text="mid"),
        _evt(7.0, output_text="after"),
    ])
    assert_eq("node pause active mid-window", results[1]["active_faults"],
              {"node_pause": {"A": 1.0}})
    assert_eq("node pause expired", results[2]["active_faults"], {})

    # Restore does NOT affect node windows
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 100}),
        _evt(3.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("restore keeps node_pause", results[2]["active_faults"],
              {"node_pause": {"A": 2.0}})

    # Node pause with empty affected_nodes is ignored
    results = process_events([
        _evt(1.0, fault={"name": "pause", "type": "node", "affected_nodes": []}),
    ])
    assert_eq("node pause empty nodes ignored", results[0]["active_faults"], {})

    # Node pause without type is ignored
    results = process_events([
        _evt(1.0, fault={"name": "pause", "affected_nodes": ["A"], "max_duration": 10}),
    ])
    assert_eq("node pause without type ignored", results[0]["active_faults"], {})

    # Node kill/stop are not tracked
    results = process_events([
        _evt(1.0, fault={"name": "kill", "type": "node", "affected_nodes": ["A"], "max_duration": 10}),
        _evt(2.0, fault={"name": "stop", "type": "node", "affected_nodes": ["B"], "max_duration": 10}),
    ])
    assert_eq("kill not tracked", results[0]["active_faults"], {})
    assert_eq("stop not tracked", results[1]["active_faults"], {})

    # =====================================================================
    # active_faults: clock skip (permanent)
    # =====================================================================
    print()
    print("active_faults: clock skip (permanent)")

    # Permanent clock skip tracked
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
    ])
    assert_eq("permanent clock skip tracked", results[0]["active_faults"],
              {"clock_skip": {"cumulative_offset": 10.0, "vtime": 1.0}})

    # Cumulative offsets
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
        _evt(2.0, fault={"name": "skip", "type": "clock", "details": {"offset": 5.0}}),
    ])
    assert_eq("cumulative offsets", results[1]["active_faults"],
              {"clock_skip": {"cumulative_offset": 15.0, "vtime": 2.0}})

    # Negative offset reduces cumulative
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
        _evt(2.0, fault={"name": "skip", "type": "clock", "details": {"offset": -10.0}}),
    ])
    assert_eq("offsets cancel out, entry removed", results[1]["active_faults"], {})

    # Clock skip with zero offset is ignored
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 0.0}}),
    ])
    assert_eq("zero offset ignored", results[0]["active_faults"], {})

    # Clock skip without details is ignored
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock"}),
    ])
    assert_eq("skip without details ignored", results[0]["active_faults"], {})

    # Clock skip survives pause
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
        _evt(2.0, info={"message": "status", "details": {"paused": True}}),
        _evt(3.0, output_text="after pause"),
    ])
    assert_eq("clock skip survives pause", results[2]["active_faults"],
              {"clock_skip": {"cumulative_offset": 10.0, "vtime": 1.0}})

    # =====================================================================
    # active_faults: clock skip (jitter)
    # =====================================================================
    print()
    print("active_faults: clock skip (jitter)")

    # Jitter tracked with duration
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "max_duration": 10, "details": {"offset": 30.0}}),
    ])
    assert_eq("jitter tracked", results[0]["active_faults"],
              {"clock_skip": {"cumulative_offset": 30.0, "vtime": 1.0}})

    # Jitter expires and offset drops out
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "max_duration": 5, "details": {"offset": 30.0}}),
        _evt(3.0, output_text="mid"),
        _evt(7.0, output_text="after"),
    ])
    assert_eq("jitter active mid-window", results[1]["active_faults"],
              {"clock_skip": {"cumulative_offset": 30.0, "vtime": 1.0}})
    assert_eq("jitter expired", results[2]["active_faults"], {})

    # Jitter + permanent coexist
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "details": {"offset": 10.0}}),
        _evt(2.0, fault={"name": "skip", "type": "clock", "max_duration": 5, "details": {"offset": 30.0}}),
        _evt(4.0, output_text="both active"),
        _evt(8.0, output_text="jitter expired"),
    ])
    assert_eq("permanent + jitter cumulative", results[2]["active_faults"],
              {"clock_skip": {"cumulative_offset": 40.0, "vtime": 2.0}})
    assert_eq("after jitter expires, permanent remains", results[3]["active_faults"],
              {"clock_skip": {"cumulative_offset": 10.0, "vtime": 1.0}})

    # Jitter survives pause
    results = process_events([
        _evt(1.0, fault={"name": "skip", "type": "clock", "max_duration": 100, "details": {"offset": 20.0}}),
        _evt(2.0, info={"message": "status", "details": {"paused": True}}),
        _evt(3.0, output_text="after pause"),
    ])
    assert_eq("jitter survives pause", results[2]["active_faults"],
              {"clock_skip": {"cumulative_offset": 20.0, "vtime": 1.0}})

    # =====================================================================
    # active_faults: combined scenario (spec walkthrough)
    # =====================================================================
    print()
    print("active_faults: combined scenario")

    results = process_events([
        _evt(0.0, info={"message": "status", "details": {"started": True}}),
        _evt(5.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 10,
                         "details": {"disruption_type": "Stopped", "asymmetric": False, "partitions": [["A", "B"], ["C"]]}}),
        _evt(8.0, fault={"name": "clog", "type": "network", "affected_nodes": ["A"], "max_duration": 6,
                         "details": {"disruption_type": "Stopped"}}),
        _evt(10.0, output_text="check at t=10"),
        _evt(12.0, fault={"name": "pause", "type": "node", "affected_nodes": ["C"], "max_duration": 8}),
        _evt(16.0, output_text="check at t=16"),
        _evt(17.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
        _evt(17.0, info={"message": "status", "details": {"paused": True}}),
    ])
    assert_eq("t=10: partition + clog active", results[3]["active_faults"],
              {"network_partition": {"vtime": 5.0}, "network_clog": {"vtime": 8.0}})
    assert_eq("t=16: only node_pause (network expired)", results[5]["active_faults"],
              {"node_pause": {"C": 12.0}})
    assert_eq("t=17: pause clears everything", results[7]["active_faults"], {})

    # Mixed: network + node + clock
    results = process_events([
        _evt(1.0, fault={"name": "partition", "type": "network", "affected_nodes": ["ALL"], "max_duration": 100}),
        _evt(2.0, fault={"name": "pause", "type": "node", "affected_nodes": ["A"], "max_duration": 100}),
        _evt(3.0, fault={"name": "skip", "type": "clock", "details": {"offset": 5.0}}),
        _evt(4.0, fault={"name": "restore", "type": "network", "affected_nodes": ["ALL"]}),
    ])
    assert_eq("all three active at t=3", results[2]["active_faults"],
              {"network_partition": {"vtime": 1.0}, "node_pause": {"A": 2.0},
               "clock_skip": {"cumulative_offset": 5.0, "vtime": 3.0}})
    assert_eq("restore removes only network", results[3]["active_faults"],
              {"node_pause": {"A": 2.0}, "clock_skip": {"cumulative_offset": 5.0, "vtime": 3.0}})

    print()
    if failures:
        print(f"{failures} test(s) failed")
        sys.exit(1)
    else:
        print("all tests passed")


if __name__ == "__main__":
    main()
