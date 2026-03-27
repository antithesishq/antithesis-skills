# Logs

Logs are accessed per-example from the triage report. Each example row in an expanded property has a "get logs" link that opens a timeline-specific log viewer on the search page.

**Important:** If a `logsUrl` redirects away from the search page or fails to
load, do a full interactive login first.
**Important:** Report-side queries in this skill only apply on the main report
view. If you navigate to a hash route such as `#/run/.../finding/...`, reopen
the original report URL and rerun `window.__antithesisTriage.report.waitForReady()`
before using any report method again.

If `window.__antithesisTriage` is missing, inject again and retry. After every
`open` call or any navigation, use `agent-browser wait --fn` to confirm that
the browser is on the expected page, inject again, then call the
matching `*.waitForReady()` method before the next page-specific method call.

## Getting log URLs from triage report examples

Use `getFailedPropertyExamples()` to expand failed properties and collect
examples grouped by property in one call:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getFailedPropertyExamples()"
```

Each property in the result includes its `group`, `name`, `status`, and an
`examples` array with `{ status, time, logsUrl }` entries. Use the `logsUrl`
from a specific example to navigate to its log viewer.

The older two-step flow (`expandFailedExamples()` then `getExampleUrls()`) still
works but returns a flat list without property context.

## Navigate to logs for a specific example

Use the `logsUrl` from the example row to open the log viewer:

```
agent-browser --session "$SESSION" open "<logsUrl>"
agent-browser --session "$SESSION" wait --fn \
  "window.location.pathname === '/search' && new URLSearchParams(window.location.search).has('get_logs')"
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.waitForReady()"
```

Before injecting, make sure the browser is still on `/search` with
`get_logs=true`. If it redirected to login or another page, reauthenticate
first.

## Log viewer page structure

The log viewer is at `$TENANT.antithesis.com/search?search=...&get_logs=true&...`. It shows a timeline-specific event log centered on the assertion moment.

Log viewers are `div.sequence_printer_wrapper` elements, each with a virtual scroll.

## Get log item count

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.getItemCount()"
```

## Filter logs by text

Edit the query text directly in the snippet:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.filter('my search query')"
```

Clear the filter:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.clearFilter()"
```

## Read visible log entries

Each log event has four columns: virtual time, source (command name), container,
and message text. The runtime methods extract these into objects with fields
`vtime`, `container`, `source`, `text`, and `highlighted`. The `container` field
identifies which Docker container produced the event (e.g., `nsq-workload-2`),
which is important for correlating faults with errors in multi-container setups.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.readVisibleEvents()"
```

Note: logs use virtual scrolling — only ~50-70 rows render at a time. Scroll within `div.vscroll` to load more.

## Find the highlighted assertion event

The event that triggered the "get logs" link is highlighted with `._emphasized_blue`:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.findHighlightedEvent()"
```

## Search within logs

Use the search input to find and navigate between matches:

Edit the query text directly in the snippet:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.search('my search query')"
```

The search count is displayed next to the search input (e.g., "1 / 30").

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

### Key timestamps

Antithesis log timestamps reflect true execution order on the
host system that runs the containers. When
correlating Antithesis events with customer container logs, use
Antithesis timestamps as the source of truth for ordering.
