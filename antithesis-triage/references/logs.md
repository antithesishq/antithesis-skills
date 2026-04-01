# Logs

Antithesis renders logs in the web UI using a `div.sequence_printer_wrapper`
component.

Logs can appear in a few places:

1. **Per-example logs** from property examples. Passing and failing property
   example rows can both expose a "get logs" link that opens a
   timeline-specific log viewer on the search page.
2. **Inline error-report logs** embedded directly in setup-failure reports.
   These stay on the main report page under the `Error` section.
3. **The general search logs page** When searching logs at `/search`, the log
   viewer appears on the right side after selecting a candidate moment in the
   search results.

## Downloading logs

### Check agent-browser version

Downloading logs to a file requires `agent-browser` v0.23.4 or above. Check
before attempting a download:

```bash
agent-browser --version
```

Compare the version against `0.23.4`. If the installed version is older,
read `references/logs-legacy.md` instead and use the scroll-based fallback
methods described there.

### Pages with multiple log viewers

Sometimes the Report page may contain more than one log viewer. Use
`getLogViewers()` to list them before downloading:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.getLogViewers()"
```

Returns an array with one entry per viewer:

- `index`: zero-based viewer index (pass to `prepareDownload`)
- `label`: text from the preceding element (e.g., `"Filtered logs:"`) or
  `null`
- `itemCount`: number of items in the viewer
- `visible`: whether the viewer is currently rendered

### Download the logs

**Default to JSON format.** JSON preserves full event structure — fault data,
source metadata, and timestamps are all properly typed fields. Use TXT or CSV
only when explicitely asked for it.

To download logs from a log viewer, run two `agent-browser` commands
sequentially. These commands MUST NOT run in parallel as the second depends
on the first.

Step 1 — prepare the download link:

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisTriage.logs.prepareDownload("json", 0)'
```

The first argument is the format (`json`, `txt`, or `csv`). The second is the
viewer index (0 for the first/only viewer).

Step 2 — download the file:

```bash
agent-browser --session "$SESSION" download \
  'a.sequence_printer_menu_button[data-triage-dl]' "$OUTPUT_PATH"
```

Step 3 (JSON only) — strip ANSI escape codes. Application `output_text`
fields contain terminal color codes that break text search and clutter output.
This rewrites only `output_text` fields, leaving all other event data intact:

```bash
python3 assets/strip-log-escapes.py "$OUTPUT_PATH" -o "$CLEAN_PATH"
```

Use unique filenames in a temporary directory unless the user specifies
otherwise.

The download is generated client-side from data already loaded in the page —
no additional network requests are made. Ensure the page is fully loaded
before downloading.

| Format | `prepareDownload` arg | Content                                 |
| ------ | --------------------- | --------------------------------------- |
| JSON   | `'json'`              | JSON array of structured event objects  |
| TXT    | `'txt'`               | One log line per event (human-readable) |
| CSV    | `'csv'`               | CSV table                               |

## JSON log format

The JSON download is an array of event objects. Every event has `source` and
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
deterministic virtual time. To convert to seconds divide by `2^32`:

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

All examples below assume:

- The JSON log has been stripped with `assets/strip-log-escapes.py`
- The log path is in `$LOG`:

```bash
LOG="/path/to/clean.json"
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
jq '[.[] | select(.output_text != null and (.output_text | test("error"; "i")))]' "$LOG"
```

Container lifecycle events:

```bash
jq '[.[] | select(.event == "die")]' "$LOG"
```

Combine filters — fault partitions affecting a specific container:

```bash
jq '[.[] | select(.fault.name == "partition" and (.fault.affected_nodes | index("mycontainer") or index("ALL")))]' "$LOG"
```

### Filtering by virtual time

Filter by tick range directly (most efficient):

```bash
jq '[.[] | select(.moment._vtime_ticks >= 400000000000 and .moment._vtime_ticks <= 500000000000)]' "$LOG"
```

To convert a vtime in seconds to ticks for use in filters, multiply by
`4294967296`. For example, to filter between 100s and 110s:

```bash
jq --argjson lo 429496729600 --argjson hi 472446402560 \
  '[.[] | select(.moment._vtime_ticks >= $lo and .moment._vtime_ticks <= $hi)]' "$LOG"
```

Compute the bounds with: `seconds * 4294967296`. For example:

- 100s → `100 * 4294967296 = 429496729600`
- 110s → `110 * 4294967296 = 472446402560`

Add a vtime_seconds field to output for readability:

```bash
jq '[.[] | . + {vtime_seconds: ((.moment._vtime_ticks | tonumber) / 4294967296 * 1000 | round / 1000)}]' "$LOG"
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

### Correlating faults with failures

To determine what faults were active when an assertion failed:

1. Find fault events near the failure timestamp (adjust tick bounds to
   a window around the failure):
   ```bash
   jq --argjson lo 2100000000000 --argjson hi 2200000000000 \
     '[.[] | select(.fault != null and .moment._vtime_ticks >= $lo and .moment._vtime_ticks <= $hi)]' "$LOG"
   ```
2. Check whether `fault.affected_nodes` includes the container involved in the
   failure (or `"ALL"`)
3. Compare `fault.max_duration` with the time gap between the fault and the
   assertion to determine if the fault was still active

### Thinking in fault windows

1. **Identify fault windows.** Each `partition` or `clog` event opens a window.
   The window closes at the next `restore` event. A subsequent fault of the
   same type replaces the network topology — treat it as a new window. If the
   log ends without a restore, the window extends to the end. Node faults
   (`kill`, `stop`, `pause`) and clock faults (`skip`) are point-in-time —
   their impact lingers until the container restarts or the clock corrects.

2. **Map affected containers.** Each fault window affects specific containers
   (listed in `affected_nodes`, or the groups in `details.partitions`).
   `["ALL"]` means every container.

3. **Classify errors relative to windows:**
   - **During fault window, on affected container** — the fault likely caused
     the error. Question: did the SUT handle it correctly?
   - **Shortly after window ends** — recovery-time failure. Did the SUT
     recover correctly?
   - **Outside any fault window, or on unaffected container** — fault is
     likely unrelated.
   - **Before a fault** — the fault did not cause the error.

4. **Watch for overlapping windows.** Antithesis can inject multiple faults
   concurrently (e.g., a partition overlapping with a node kill).

### Virtual time vs application timestamps

Antithesis tags each event with it's virtual time, which represents an unambiguous global order of events in the simulation. Antithesis can do this since it runs the system deterministically.

Use virtual time as the source of truth for ordering logs rather than timestamps embedded in application logs. Timestamps printed by the application can be out of order due to faults like clock skew and thread pausing.
