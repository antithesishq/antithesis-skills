# Logs

Logs are accessed per-example from the triage report. Each example row in an expanded property has a "get logs" link that opens a timeline-specific log viewer on the search page.

**Important:** The search/logs page requires full authentication (the report's `auth` token is not sufficient). Ensure the user is authenticated before navigating to log URLs.
**Important:** Report-side queries in this skill only apply on the main report
view. If you navigate to a hash route such as `#/run/.../finding/...`, reopen
the original report URL and rerun the report loading check before using any
report query again.

## Getting log URLs from triage report examples

First, expand visible failed properties until their examples tables are present:

Use this query file:

- `assets/report/expand-failed-examples.js`

Then extract the example rows and log URLs:

Use this query file:

- `assets/logs/get-example-urls.js`

## Navigate to logs for a specific example

Use the `logsUrl` from the example row to open the log viewer:

```
agent-browser open --session-name $SESSION "<logsUrl>"
agent-browser wait --session-name $SESSION --load networkidle
```

## Log viewer page structure

The log viewer is at `$TENANT.antithesis.com/search?search=...&get_logs=true&...`. It shows a timeline-specific event log centered on the assertion moment.

Log viewers are `div.sequence_printer_wrapper` elements, each with a virtual scroll.

## Get log item count

Use this query file:

- `assets/logs/get-item-count.js`

## Filter logs by text

Use this query file:

- `assets/logs/filter-error.js`

Clear the filter:

Use this query file:

- `assets/logs/clear-filter.js`

## Read visible log entries

Each `.event` element contains tooltip children (`<a-tooltip>`) followed by a
text node with the actual value. Use `lastText()` to extract the visible text,
skipping tooltip prefixes.

Use this query file:

- `assets/logs/read-visible-events.js`

Note: logs use virtual scrolling — only ~50-70 rows render at a time. Scroll within `div.vscroll` to load more.

## Find the highlighted assertion event

The event that triggered the "get logs" link is highlighted with `._emphasized_blue`:

Use this query file:

- `assets/logs/find-highlighted-event.js`

## Search within logs

Use the search input to find and navigate between matches:

Use this query file:

- `assets/logs/search-error.js`

The search count is displayed next to the search input (e.g., "1 / 30").
