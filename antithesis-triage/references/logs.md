# Logs

Logs can come from two places:

1. **Per-example logs** from property examples. Passing and failing property
   example rows can both expose a "get logs" link that opens a
   timeline-specific log viewer on the search page.
2. **Inline error-report logs** embedded directly in setup-failure reports.
   These stay on the main report page under the `Error` section and use the
   same `sequence_printer` widget as the `/search?get_logs=true` page.

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

## Reading inline logs from an error report

When `window.__antithesisTriage.report.waitForReady()` returns an `error`,
check whether the report exposes inline log panes:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getInlineErrorLogViews()"
```

This returns one entry per visible log pane with:

- `index`: zero-based pane index
- `itemCount`: total rows reported by the widget
- `visibleEvents`: rows currently rendered in the DOM
- `firstEvent`: first visible `{ vtime, source, text, highlighted }` row

Read the currently visible rows from a pane:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.readInlineErrorLog(0, 20)"
```

Best-effort collection from a pane by scrolling its virtualized viewport:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.collectInlineErrorLog(0)"
```

Optional limits can be passed as an object:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.collectInlineErrorLog(1, { maxItems: 200 })"
```

Use the inline-pane workflow for setup/runtime error reports that surface logs
on the main report page. Use the `/search?get_logs=true` workflow only when you
need logs for a specific property example.

If an inline pane only exposes a preview, use the report UI's `Maximize` or
`Expand for full, unfiltered logs` controls before trying to read more rows.

## Getting log URLs from triage report examples

Use `getPropertyExamples()` to expand properties that expose example tables and
collect examples grouped by property in one call:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getPropertyExamples()"
```

Each property in the result includes its `group`, `name`, `status`, and an
`examples` array with `{ status, time, logsUrl }` entries. Use the `logsUrl`
from a specific example to navigate to its log viewer.

Use `getFailedPropertyExamples()` only when you specifically want to restrict
the results to failed properties.

The older two-step flow (`expandExamples()` then `getExampleUrls()`) still works
but returns a flat list without property context.

## Navigate to logs for a specific example

Use the exact `logsUrl` from the example row to open the log viewer. Do not
rewrite query parameters unless you have a specific reason:

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
`vtime`, `container`, `source`, `text`, `directText`, `outputText`, and
`highlighted`. The `container` field
identifies which Docker container produced the event (e.g., `nsq-workload-2`),
which is important for correlating faults with errors in multi-container setups.

`readVisibleEvents()` returns the rows that are currently rendered in the DOM.
`text` is the best-effort combined message text, while `directText` and
`outputText` preserve the two underlying extraction paths used for structured
rows.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.readVisibleEvents()"
```

This matters for fault injector and other structured events because some rows
store their useful content in direct text nodes rather than in
`.event__output_text`.

Logs use virtual scrolling, so only ~50-70 rows render at a time. If you need
more than the current viewport, use the collector instead of relying on manual
scrolling:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.collectEvents()"
```

Optional limits can be passed as an object:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.collectEvents({ maxItems: 200 })"
```

The collector walks the virtual scroller and returns:

- `itemCount`: rows reported by the viewer
- `collectedCount`: rows actually captured
- `truncated`: whether `maxItems` stopped collection early
- `events`: serialized rows with `vtime`, `container`, `source`, `text`, `directText`, `outputText`, and `highlighted`

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
If you need to read beyond the currently rendered rows after filtering or
searching, run `collectEvents()` again on the updated view.

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
