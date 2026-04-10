# Logs

## JSON Log format

This document focuses on understanding the JSON log format from Antithesis. You may use this to interpret other formats, but the result will be much more lossy.

The JSON log format is an array of event objects. Every event has `source` and
`moment` fields. The remaining fields vary by event type.

### Event schema

```
{
  "source": {
    "name": string, // e.g. "fault_injector", "container-name", "setup"
    "stream"?: "info"|"error",
    "container"?: string // Docker container name, present on app events
  },
  "moment": {
    "_vtime_ticks": number, // virtual time as integer ticks (see below)
    "input_hash": string,
    "session_id": string
  },
  "output_text"?: string,           // application stdout/stderr line
  "fault"?: { ... },                // fault injection event
  "info"?: { ... },                 // fault_injector status
  "event"?: string,                 // container lifecycle (create/init/start)
  "antithesis_setup"?: { ... },     // SDK setup-complete signal
  "command"?: string,               // test composer task lifecycle
  ...                               // other fields may be included
}
```

### Virtual time

Events are globally ordered by `moment._vtime_ticks`, an integer representing
deterministic virtual time. The `process-logs.py` script adds a `vtime_seconds`
field to every event automatically, so manual conversion is usually unnecessary.

For reference, the formula to convert ticks to seconds is:

```
vtime_seconds = _vtime_ticks / 4294967296
```

### Event types at a glance

| Identifying field(s)             | Source name                | What it is                                  |
| -------------------------------- | -------------------------- | ------------------------------------------- |
| `output_text`                    | container name             | Application log line (stdout/stderr)        |
| `fault`                          | `fault_injector`           | Fault injection event                       |
| `info`                           | `fault_injector`           | Fault injector status message               |
| `event`, `image`                 | `containers_meta`          | Container lifecycle (create/init/start/die) |
| `antithesis_setup`               | `*/sdk.jsonl`              | SDK setup-complete signal                   |
| `command`, `started_task`        | `antithesis_test_composer` | Test command started                        |
| `command`, `command_return_code` | `antithesis_test_composer` | Test command finished                       |

### Fault events

Events from `fault_injector` with a `fault` field describe injected faults.

Key fields in `fault`:

- `name`: `partition`, `clog`, `restore`, `kill`, `stop`, `pause`, `throttle`,
  `skip`
- `type`: `network`, `node`, `clock`
- `affected_nodes`: array of container names, or `["ALL"]`
- `max_duration`: seconds (number) — how long the fault lasts
- `details`: optional object with fault-specific data (`disruption_type`,
  `partitions`, `offset`, etc.)

### Application log events (`output_text`)

The `output_text` field contains stdout/stderr lines from SUT containers.

Some applications serialize configuration objects, debug structs, or JSON
payloads directly into their log messages. These lines can be very long
(1-4 KB). When presenting logs to the user, consider truncating long
`output_text` values. When searching, be aware that keyword matches may hit
these serialized dumps rather than meaningful log messages.

## Analyzing logs with jq

All examples below assume the log path is in `$LOG`:

```bash
LOG="/path/to/clean.json"
```

**Null-safe string matching:** Many event fields are optional and may be `null`,
including `source.name`. Use jq's `//` (coalesce) operator before string
functions like `test()` or `startswith()` to avoid errors:
`.output_text // "" | test("pattern")`, `(.source.name // "") | startswith("node")`.

### Suggested first-look workflow

These three queries orient you quickly when opening a new log.

**1. List unique sources** — show unique `source.name` / `source.container`
combinations to see what is in the log:

```bash
jq '[.[] | {name: .source.name, container: .source.container}] | unique' "$LOG"
```

**2. Find failed commands** — find test commands that finished with non-zero
exit:

```bash
jq '[.[] | select(.command_return_code != null and .command_return_code != "0") | {vtime_seconds, command, command_return_code}]' "$LOG"
```

**3. Search for errors in application logs**:

```bash
jq '[.[] | select(.output_text // "" | test("error|panic|fatal|crash"; "i")) | {vtime_seconds, source: .source.name, text: .output_text[:200]}]' "$LOG"
```

### Filtering events

Filter by source name:

```bash
jq '[.[] | select(.source.name == "fault_injector")]' "$LOG"
```

Filter by stream (application stderr only):

```bash
jq '[.[] | select(.source.stream == "error")]' "$LOG"
```

Filter fault events by fault name:

```bash
jq '[.[] | select(.fault.name == "partition")]' "$LOG"
```

Filter by fault type:

```bash
jq '[.[] | select(.fault.type == "network")]' "$LOG"
```

Search output_text for a keyword (case-insensitive):

```bash
jq '[.[] | select(.output_text // "" | test("error"; "i"))]' "$LOG"
```

Container lifecycle events:

```bash
jq '[.[] | select(.event == "die")]' "$LOG"
```

Find failed test-template commands (non-zero exit code):

```bash
jq '[.[] | select(.command_return_code != null and .command_return_code != "0")]' "$LOG"
```

Find all test command completions:

```bash
jq '[.[] | select(.command_return_code != null)]' "$LOG"
```

Find all SDK assertion events:

```bash
jq '[.[] | select(.antithesis_assert != null)]' "$LOG"
```

Find all assertion events for a specific property:

```bash
jq '[.[] | select(.antithesis_assert.id == "property name here")]' "$LOG"
```

Combine filters — fault partitions affecting a specific container:

```bash
jq '[.[] | select(.fault.name == "partition" and (.fault.affected_nodes | index("mycontainer") or index("ALL")))]' "$LOG"
```

### Filtering by virtual time

Filter events within a time range (in seconds):

```bash
jq '[.[] | select(.vtime_seconds >= 100 and .vtime_seconds <= 110)]' "$LOG"
```

Events after a specific time:

```bash
jq '[.[] | select(.vtime_seconds >= 85.5)]' "$LOG"
```

## Interpreting logs

### Two sources of log lines

Antithesis logs interleave two sources:

1. **Antithesis system events** — fault injection, container lifecycle,
   network changes, compose orchestration. Identified by source names like
   `fault_injector`, `containers_meta`, `setup`, `antithesis_test_composer`.
2. **Application logs** — from the SUT containers. Identified by having
   `output_text` and a `source.container` field matching a Docker container
   name.

### Fault types and what they mean

- **Network Partition** (`partition`/`network`): Containers are split into
  partition groups. Links between different groups experience the
  `disruption_type`. Links within the same group are unaffected by this event
  but may be faulted by an overlapping one.
- **Network Clog** (`clog`/`network`): Links of containers in `affected_nodes`
  experience the `disruption_type` at random times for random durations.
- **Network Restore** (`restore`/`network`): Restores all faulted network
  links.
- `disruption_type` values: `Stopped` (packets dropped), `Slowed` (packets
  delayed), `Jammed` (packets queued until a future delivery time).
- **Container Kill / Stop** (`kill`|`stop`/`node`): The named container is
  killed or stopped for `max_duration` seconds, then restarted by Antithesis.
  `max_duration` may be `"0"` (string) meaning the restart has no controlled
  end. A restart policy may restart the container sooner.
- **Container Pause** (`pause`/`node`): The named container is frozen in place
  for `max_duration` seconds. The container remains on the network but cannot
  process anything — other containers will see timeouts when trying to
  communicate with it.
- **CPU Throttle** (`throttle`/`node`): CPU on the target container is slowed
  for `max_duration` seconds.
- **Clock Skew** (`skip`/`clock`): System clock is jumped forward or backward
  by `details.offset` seconds. If `max_duration` is present, the offset is
  temporary (jitter) and reversed after the duration. If absent, the offset is
  permanent. Clock offsets are cumulative — each new skip shifts from wherever
  the clock already is.
- Only one node fault can be active on a given container at a time. A second
  node fault targeting a container with an active fault is silently dropped.

### Active (ongoing) faults

The `process-logs.py` script adds an `active_faults` field to every event. This
field is a dictionary tracking currently active fault windows. The schema:

```json
{
  "active_faults": {
    "network_partition": {"vtime": 5.0},
    "network_clog": {"vtime": 10.0},
    "node_pause": {"container_a": 12.0, "container_b": 13.0},
    "node_throttle": {"container_c": 14.0},
    "clock_skip": {"cumulative_offset": 30.0, "vtime": 12.0}
  }
}
```

**Keys and values:**

- **`network_partition`** / **`network_clog`** — `{"vtime": <float>}` pointing
  to the start of the outer fault window. Overlapping faults of the same type
  are merged: the window tracks the earliest start and latest end. Events with
  empty or missing `affected_nodes` are ignored.
- **`node_pause`** / **`node_throttle`** — map from container name to the vtime
  when the fault started. One entry per affected container.
- **`clock_skip`** — `{"cumulative_offset": <float>, "vtime": <float>}`.
  `cumulative_offset` is the sum of all active clock offsets (permanent +
  jitter). `vtime` is the most recent clock fault event. Removed when the net
  offset reaches zero.

**What is tracked:**

- Network faults (`partition`, `clog`) with non-empty `affected_nodes` and
  `max_duration` create timed windows. Without `max_duration`, the window stays
  open until a `restore` or `pause` event.
- `restore` closes all network fault windows.
- `pause` and `throttle` node faults create windows that expire after
  `max_duration`.
- Clock faults (`skip`) with `details.offset != 0` are tracked. Permanent
  offsets (no `max_duration`) never expire. Jitter (with `max_duration`) expires
  and its offset drops from the cumulative total.

**What is NOT tracked:**

- `node/kill` and `node/stop` — may have no controlled end; their semantics are
  obvious (container goes down and comes back).
- Thread pausing — does not produce fault injector log events, so it cannot be
  tracked.

**Clearing behavior:**

- A `restore` event clears all network windows. Node and clock windows are
  unaffected.
- A fault injector `paused: true` status event clears all network and node
  windows. Clock windows survive pause (clock offsets are real state changes
  that persist).
- Fault windows with `max_duration` expire automatically when `vtime` passes
  `start + max_duration`.

To find events that occurred during a network partition:

```bash
jq '[.[] | select(.active_faults.network_partition != null)]' "$LOG"
```

To find events during any node fault:

```bash
jq '[.[] | select(.active_faults | keys[] | startswith("node_"))]' "$LOG"
```

To find events that happened during any ongoing fault:

```bash
jq '[.[] | select(.active_faults != {})]' "$LOG"
```

To find faults within a region of vtime:

```bash
jq '[.[] | select(.fault != null and .vtime_seconds >= 85.0 and .vtime_seconds <= 86.0)]' "$LOG"
```

### Virtual time vs application timestamps

Antithesis tags each event with its virtual time, which represents an unambiguous global order of events in the simulation. Antithesis can do this since it runs the system deterministically.

Use virtual time as the source of truth for ordering logs rather than timestamps embedded in application logs. Timestamps printed by the application can be out of order due to faults like clock skew and thread pausing.

Use `vtime_seconds` for all time-based analysis. The raw `_vtime_ticks` value is
only needed when tiebreaking events that fall within the same second.
