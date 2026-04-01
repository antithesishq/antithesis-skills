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

**Null-safe string matching:** Many event fields are optional and may be `null`.
Use jq's `//` (coalesce) operator before string functions like `test()` or
`startswith()` to avoid errors: `.output_text // "" | test("pattern")`.

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
- **Container Kill / Stop / Pause** (`kill`|`stop`|`pause`/`node`): The named
  container is killed, stopped, or paused for `max_duration` seconds. Killed
  or stopped containers are restarted by Antithesis after the duration. A
  restart policy in docker-compose may restart it sooner.
- **CPU Throttle** (`throttle`/`node`): CPU on the target container is slowed
  for a duration.
- **Clock Skew** (`skip`/`clock`): System clock is jumped forward or backward
  by `details.offset` seconds, then reversed after `max_duration`.

### Active (ongoing) faults

The `process-logs.py` script adds an `active_faults` field to every event. This
field is a dictionary mapping fault names to the virtual time (in seconds) when
each fault window opened.

Only faults that create sustained windows are tracked:

- **`partition`** and **`clog`** with non-empty `affected_nodes` open a window.
  A new fault of the same type replaces the previous one. If `affected_nodes`
  is empty or missing, the fault is disabled and the window closes.
- **`restore`** closes all network fault windows.
- Node faults (`kill`, `stop`, `pause`, `throttle`) and clock faults (`skip`)
  are instantaneous — they are not tracked in `active_faults`.

To find events that occurred during a network partition:

```bash
jq '[.[] | select(.active_faults.partition != null)]' "$LOG"
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
