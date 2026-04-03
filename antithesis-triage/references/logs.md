# Logs

Antithesis renders logs in the web UI using a `div.sequence_printer_wrapper` component.

Logs can appear in a few places:

1. **Per-example logs** from property examples. Passing and failing property
   example rows can both expose a "get logs" link that opens a
   timeline-specific log viewer on the search page.
2. **Inline error-report logs** embedded directly in setup-failure reports.
   These stay on the main report page under the `Error` section.
3. **The general search logs page** When searching logs at `/search`, the log
   viewer appears on the right side after selecting a candidate moment in the
   search results.

## Downloading logs from a log viewer

### Check agent-browser version

Downloading logs to a file requires `agent-browser` v0.23.4 or above. Check before attempting a download:

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
- `label`: text from the preceding element (e.g., `"Filtered logs:"`) or `null`
- `itemCount`: number of items in the viewer
- `visible`: whether the viewer is currently rendered

If a desired log viewer is not visible, you may need to expand it's containing section to view it. Look for elements containing `Expand for full, unfiltered logs` or other section headers.

### Download logs from a log viewer

To download logs from a log viewer you need to run two agent-browser commands sequentially. These commands MUST NOT run in parallel as the second depends on the first.

First, you need to execute `prepareDownload` specifying which format you want as well as the log viewer index. The first viewer index is 0.

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisTriage.logs.prepareDownload("txt", 0)'
```

Then, once that command completes, you need to run download. Download takes two arguments. The first is the selector returned by the previous command, and the second is the output file path on your local filesystem.

```bash
agent-browser --session "$SESSION" download \
  'a.sequence_printer_menu_button[data-triage-dl]' "$OUTPUT_PATH"
```

You should download log files using unique names to a temporary directory unless
a specific directory has been specified by the user. Make sure to generate
unique names for log files so as to not collide with other processes running on
the same machine or older log files.

The file is written directly to the specified path. For TXT format, each line
is a log event in the format:

```
[<vtime>] [<source>] [<stream>] <message>
```

`[<vtime>]` is the virtual time of the message. Messages from all containers are interleaved into a single global order by their deterministic vtime.
`[<source>]` represents the source of the log, usually a docker container name for SUT messages.
`[<stream>]` can be `[err]` which means that this log message is from stderr.
`<message>` the raw log message, sometimes structured as JSON.

### Supported formats

| Format | `prepareDownload` arg | Download selector filename | Content                                |
| ------ | --------------------- | -------------------------- | -------------------------------------- |
| TXT    | `'txt'`               | `events.log`               | One log line per event                 |
| JSON   | `'json'`              | `events.json`              | JSON array of structured event objects |
| CSV    | `'csv'`               | `events.csv`               | CSV table                              |

The download is generated client-side from data already loaded in the page —
no additional network requests are made. Thus you need to ensure that the page is fully loaded before downloading.

## Parsing Logs

When reading logs from an Antithesis run, there are TWO sources of log lines interleaved together:

1. **Antithesis system events** — fault injection, container
   lifecycle, network changes, compose, etc. Example: "fault_injector [host]"
   where [host] indicates that this is coming from an Antithesis service.
2. **Customer Application logs** — if it doesn't have [host] it's probably from
   the customer's applications.

### Antithesis Fault Log Format

Antithesis system-level events appear as structured JSON on stdout. The fault injector logs look like:

Network partition between client and server, so only the connections between those partition groups are faulted. Connections between containers in the same group are not faulted.

```json
{
    fault:{
        affected_nodes:[ALL],
        details:{
            asymmetric:true,
            disruption_type:Slowed,
            drop_rate:0,
            latency:{
                deviation:1597.9999999999998,
                mean:1492.601977
            },
            partitions:[[client],[server]]
        },
        max_duration:0.183884736,
        name:partition,
        type:network
    }
}
```

Network clog event where any connection to a container listed in `affected_nodes` can experience the `disruption_type` at random times for random durations. If the `affected_nodes` array were empty the fault doesn't actually do anything.

```json
{
    fault:{
        affected_nodes:[server, client],
        details:{
            disruption_type:Stopped
        },
        max_duration:4.515860336,
        name:clog,
        type:network
    }
}
```

Network restore event which will restore all faulted network links:

```json
{
    fault:{
        affected_nodes:[ALL],
        name:restore,
        type:network
    }
}
```

Node kills, stops, pauses, and throttle all look like this:

```json
{
    fault:{
        affected_nodes:[server-3],
        max_duration:1.7741677258234223,
        name:kill,
        type:node
    }
}
```

System level clock skew moves the time forward/backward by the `offset` and then applies the offset in the other direction to return the time to normal.

```json
{
    fault:{
        affected_nodes:[ALL],
        details:{
            offset:-0.11456344671067203
        },
        max_duration:0.15177661326674713,
        name:skip,
        type:clock
    }
}
```

#### Fault types and what they mean

- **Network Partition**: Containers are placed in partition groups; if there is a link between containers in different groups that link will experience the `disruption_type`. Links between containers in the same group are not faulted by this event, but can be faulted by an overlapping event.
- **Network Clog**: The links of containers listed in `affected_nodes` will be subject to the `disruption_type` at random times for random durations.

- Explanation of `disruption_type`'s:
  - Stopped - packets are dropped entirely
  - Slowed - packets are delayed with latency
  - Jammed - packets are "piled up" until a future deliver time

- **Container Kill / Stop / Pause**: The named container is killed, stopped, or paused for some duration. If it is killed or stopped Antithesis will restart the container after the duration. If a restart policy is defined the container may be restarted immediately by docker-compose.
- **CPU Throttle**: The cpu on the target container is slowed for a duration.
- **Clock Skew**: System clock on the host system which runs the containers is jumped forward or backward.

### How to interpret causality

When prompted to determine the cause of an error (e.g., container exit, assertion failure, error log message)
which appears AFTER an Antithesis fault event:

1. Check if the fault targeted the container involved in the error
2. If yes, some errors are expected — the real question
   is whether the test code or customer code correctly handled the error
3. If no fault preceded the error, the failure may not have been caused by the fault event

For a more structured approach, use the fault windows methodology below.

#### Thinking in fault windows

1. **Identify fault windows.** Each `partition` or `clog` event opens a window.
   The window closes at the next `restore` event. A subsequent fault of the same
   type replaces the network topology rather than restoring it — treat it as
   opening a new window with a potentially different set of affected containers.
   If the log ends without a restore, the window extends to the end of the
   visible timeline. Node faults (`kill`, `stop`, `pause`) and clock faults
   (`skip`) are point-in-time — their impact lingers until the affected
   container restarts or the clock corrects.

2. **Map affected containers.** Each fault window affects specific containers
   (listed in `affected_nodes`, or the groups listed in `partitions`).
   `affected_nodes: [ALL]` means every container is affected.

3. **Classify errors relative to windows:**
   - **Error during fault window, on an affected container** — the fault may
     have caused the error. The triage question is whether the SUT handled it
     correctly (e.g., a connection timeout during a partition is expected; data
     corruption after the partition lifts is a real bug).
   - **Error shortly after a fault window ends** — recovery-time failures.
     Check whether the SUT recovered correctly once the fault was lifted.
   - **Error outside any fault window, or on an unaffected container** — the
     fault may be unrelated to the error.
   - **Error before a fault** — the fault did not cause the error.

4. **Watch for overlapping windows.** Antithesis can inject multiple faults
   concurrently (e.g., a network partition overlapping with a node kill). When
   windows overlap, consider whether either fault alone would explain the
   failure.

### Key timestamps

Antithesis log timestamps reflect true execution order on the
host system that runs the containers. When
correlating Antithesis events with customer container logs, use
Antithesis timestamps as the source of truth for ordering.
