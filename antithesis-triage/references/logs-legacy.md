# Logs (Legacy — agent-browser < 0.23.4)

This file contains the scroll-based log reading methods. Use these only when
`agent-browser` is older than v0.23.4 and the download workflow in
`references/logs.md` is not available.

All navigation, injection, and `waitForReady()` steps are the same as in
`references/logs.md`. Only the log _reading_ methods differ.

## Log viewer page structure

The log viewer is at `$TENANT.antithesis.com/search?search=...&get_logs=true&...`. It shows a timeline-specific event log centered on the assertion moment.

Log viewers are `div.sequence_printer_wrapper` elements, each with a virtual scroll.

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

## Get log item count

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.getItemCount()"
```

## Filter logs by text

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.filter('my search query')"
```

Clear the filter:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.clearFilter()"
```

## Find the highlighted assertion event

The event that triggered the "get logs" link is highlighted with `._emphasized_blue`:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.findHighlightedEvent()"
```

## Search within logs

Use the search input to find and navigate between matches:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.search('my search query')"
```

If you need to read beyond the currently rendered rows after filtering or
searching, run `collectEvents()` again on the updated view.

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
on the main report page. Use the download workflow below only when you need
logs for a specific property example.

If an inline pane only exposes a preview, use the report UI's `Maximize` or
`Expand for full, unfiltered logs` controls before trying to read more rows.
