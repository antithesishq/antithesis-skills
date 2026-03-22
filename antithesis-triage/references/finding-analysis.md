# Finding Analysis & Root Cause Analysis

Analyze a specific finding by comparing logs across its failing and passing examples to identify what fault injection events or conditions triggered the bug.

## When to use

Use this workflow when the user wants to investigate a specific failing assertion or finding — either from the main report page (by clicking a finding) or by opening a finding URL directly (including public report URLs like `public.antithesis.com/report/...`).

## Finding page structure

When you navigate to a finding (either via hash route `#/run/.../finding/...` or a direct public URL), the page shows:

1. **Finding heading** — "Explore finding: [Group] → [Property Name]"
2. **Assertion description** — explains the assertion type (Always, Sometimes, etc.)
3. **Timeline chart** — bar chart showing Passed/Failed history across dates
4. **Occurrence list** — entries like "ONGOING Feb 22 Sun 20:35" and "NEW Feb 19 Thu 10:18"
5. **Examples table** — `table.examples_table` with rows for Failing and Passing examples
6. **Inline viewer** — below the table, shows Logs/Artifacts/Details tabs for the selected row

### Examples table

Each row (`tr.examples_table__row`) has columns: Example status (Failing/Passing), Time, Logs icon, Artifacts count, Details (`{...}`), and action buttons (moment, get logs). The selected row has class `_selected`.

Click a row to load its logs into the inline viewer below. Only one row is selected at a time.

### Inline log viewer

The log viewer below the examples table shows events for the currently selected example. It supports:
- **Tabs**: `a-tab.example__tab` elements for Logs, Artifacts, Details
- **Virtual scrolling**: Only ~50-70 rows render at a time
- **Item count**: Shown in `.sequence_toolbar__items-counter` (e.g., "912 items")
- **Filter**: `.sequence_filter__input` — filters log entries by text
- **Search**: `.sequence_search__input` — searches within logs

### Details panel

The inline viewer's content area (`.example__content`) has three children:
- `[0]` = Details panel — contains the assertion data in Antithesis unquoted-key JSON format
- `[1]` = Logs panel — the log viewer with virtual scrolling
- `[2]` = Artifacts panel

The active panel is controlled by the `_viewing_logs`, `_viewing_details`, or `_viewing_artifacts` class on `.example__content`.

## Query files

Use these query files from the skill assets directory:

| Query file                                  | Purpose                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `assets/finding/loading-finished.js`        | Check if finding page has finished loading                                 |
| `assets/finding/examples-table.js`          | Get all example rows with status, time, logs URL, moment, and decoded assertion details |
| `assets/finding/select-example-row.js`      | Select an example row by index (prepend `var ROW_INDEX = N;`)              |
| `assets/finding/get-inline-item-count.js`   | Get total item count from the inline log viewer                            |
| `assets/finding/read-filtered-events.js`    | Read all visible events with optional structured fault parsing (prepend `var PARSE_FAULTS = true;`) |
| `assets/finding/extract-fault-events.js`    | Extract fault injection and validation events from visible logs            |

### Selecting an example row

To select a specific row, prepend the index variable before evaluating:

```
echo "var ROW_INDEX = 2;" | cat - assets/finding/select-example-row.js \
  | agent-browser eval --session-name "$SESSION" --stdin
```

Or when using `--cdp`:

```
agent-browser --cdp $CDP_PORT eval "var ROW_INDEX = 2; $(cat assets/finding/select-example-row.js)"
```

After selecting a row, wait briefly (~500ms) for the inline log viewer to update before reading logs.

### Filtering the inline log viewer

The inline log viewer's filter input does not respond to JavaScript value changes — the framework ignores `.value` assignment and dispatched events. Use `agent-browser fill` instead:

```
agent-browser --cdp $CDP_PORT fill ".sequence_filter__input:visible" "fault:{"
```

The `:visible` pseudo-selector is required because the page renders multiple filter inputs (one per tab panel) but only one is visible.

Clear the filter:

```
agent-browser --cdp $CDP_PORT fill ".sequence_filter__input:visible" ""
```

Wait ~300ms after applying or clearing a filter for the virtual scroll to re-render.

## RCA workflow: Compare failing vs passing examples

Follow these steps to root-cause a failing assertion:

### 1. Wait for the finding page to load

Use `assets/finding/loading-finished.js` in the standard polling loop:

```
for _ in $(seq 1 60); do
  if [[ "$(
    cat assets/finding/loading-finished.js \
      | agent-browser eval --session-name "$SESSION" --stdin
  )" == "true" ]]; then
    break
  fi
  sleep 1
done
```

### 2. Get all examples with assertion summaries

Run `assets/finding/examples-table.js` to get every example row with decoded assertion data and moment coordinates from the log URLs. This single call returns:
- Which examples have `condition: false` (failing) vs `condition: true` (passing)
- The error message/details for each failing example
- Whether all failing examples share the same error text
- `logsUrl` linking directly to the log viewer for each example

If the assertion details are sufficient to determine the root cause (e.g., a clear error message describing the violated guarantee), you may not need to inspect fault logs at all.

### 3. For each example requiring fault correlation

For each example you need to investigate:

1. **Select the row**: `var ROW_INDEX = N; <select-example-row.js>`
2. **Wait ~500ms** for the inline viewer to load
3. **Check item count**: `<get-inline-item-count.js>`
4. **Extract fault events** using the appropriate strategy:

**If item count is under 70** (all entries visible):
- Run `<extract-fault-events.js>` directly

**If item count is over 70** (virtual scrolling hides entries):
1. Apply fault filter: `agent-browser fill ".sequence_filter__input:visible" "fault:{"`
2. Wait ~300ms
3. Read fault events: `var PARSE_FAULTS = true; <read-filtered-events.js>`
4. Clear filter: `agent-browser fill ".sequence_filter__input:visible" ""`
5. Optionally apply validation filter: `agent-browser fill ".sequence_filter__input:visible" "validation"`
6. Read validation events: `<read-filtered-events.js>`
7. Clear filter: `agent-browser fill ".sequence_filter__input:visible" ""`

### 4. Correlate and summarize

For each example, include the moment reference and a link. Use the finding page URL for public reports (works without auth) or the `logsUrl` for authenticated sessions. Use the `moment` and `logsUrl` fields from `examples-table.js`, and the current finding page URL from the browser:

````
### Example N — Failing (Xs)

[View finding](https://public.antithesis.com/report/.../finding/...)

| vtime | source | event |
|-------|--------|-------|
| ...   | ...    | ...   |
````

Then build a comparison table with structured fault data. **Link each example column header** to the finding page URL so readers can click through:

| Factor            | [Failing Example 0 (Xs)](FINDING_URL) | [Failing Example 1 (Xs)](FINDING_URL) | [Passing Example (Xs)](FINDING_URL) |
| ----------------- | ---------------------- | -------------------- | --------------- |
| Fault names       | partition, clog        | kill                 | throttle        |
| Fault type        | network                | node                 | node            |
| Affected nodes    | [ALL]                  | [server-3]           | [server-2]      |
| Disruption type   | Jammed                 | -                    | -               |
| Max duration      | 2.35s                  | 1.77s                | 4.36s           |
| Error details     | "broke Reliable - ..." | "broke Reliable - ..." | condition: true |
| Container state   | leader election        | exit code 1          | stable          |

**Key things to look for in failing examples:**
- `fault_injector` events immediately before the assertion — what fault was active?
- Network faults: `name:partition`, `name:clog`, `name:restore` with `type:network`
- Node faults: `name:kill`, `name:stop`, `name:pause` with `type:node`
- Clock faults: `name:skip` with `type:clock`
- Container exits or restarts (`container_exit_code`)
- Error messages or stack traces in the validation output
- Application-specific error patterns (e.g., consensus elections, connection failures, timeout errors)

### 6. Check related findings

Return to the main report and check if other findings correlate:
- Other "Never:" properties with the same root cause
- "No unexpected container exits" findings from the same containers
- Properties that were passing previously but now fail

## Full RCA report format

When reporting on multiple failed properties (e.g. "RCA all failures"), produce a
single cohesive report using this structure. Only perform RCA on **new** findings
— skip ongoing and resolved findings. Collect finding URLs from
`findings-grouped.js` (which returns `url` and `status` per finding) or from the
browser's current URL when on a finding page.

### Report header

````
## Triage Report: {Run Title}

**Run date:** {date} | **Source:** {source} | [View full report]({REPORT_URL})
**Properties:** {total} total — {passed} passed, **{failed} failed**, {unfound} unfound
````

Omit the `Source:` segment if the source field is empty.

### Failure group sections

Group related failures by shared root cause. Each group gets its own section:

````
### Failed Property Group N: {Group Name} ({count} properties — shared root cause)

| Property | Type | Failing / Passing Examples | Finding |
|----------|------|--------------------------|---------|
| {name}   | Always | 3 failing, 1 passing   | [View]({FINDING_URL}) |
| {name}   | Never  | 3 failing, 0 passing   | [View]({FINDING_URL}) |

#### Root Cause: {one-line summary}

{Narrative analysis}

**Fault correlation across examples:**

| Factor | [Failing Ex 0 (Xs)]({FINDING_URL}) | [Failing Ex 1 (Xs)]({FINDING_URL}) | [Passing Ex (Xs)]({FINDING_URL}) |
|--------|-----|-----|-----|
| Fault type | ... | ... | ... |
| Disruption | ... | ... | ... |
| ...    | ... | ... | ... |

**Mechanism:** {explanation of how faults trigger the failure}
````

### Summary table

At the end, include a summary linking each failure group back to the finding and
a specific example as evidence:

````
### Summary

| Finding | Severity | Link | Evidence |
|---------|----------|------|----------|
| {description} | **High** — real bug | [View]({FINDING_URL}) | [Failing example (Xs)]({FINDING_URL}) vs [Passing example (Xs)]({FINDING_URL}) |
| {description} | **Informational** — expected | [View]({FINDING_URL}) | [{specific event description}]({FINDING_URL}) |
````

### Choosing link targets

- **Finding URLs** (hash routes like `#/run/.../finding/...`) — preferred for
  public reports; work without auth and show the full finding context
- **Log URLs** (`logsUrl` from `examples-table.js`) — useful for authenticated
  sessions; link directly to the moment-specific log viewer
- When the report is public (`public.antithesis.com`), always use finding URLs
- When the report requires auth, prefer finding URLs in tables and use log URLs
  in per-example detail sections
- If a finding URL is `null` (rare), fall back to referencing the finding by
  name without a link

## Public report pages

Public reports at `public.antithesis.com/report/...` use the same finding page components but do not require authentication. The same query files work on public pages.

To navigate back to the full report from a finding page, click the "View full report" button at the top. This uses `agent-browser snapshot` or `click` on the button element.

## Tips

- **Prefer structured data over log scraping.** Assertion details decoded from URLs (via `examples-table.js`) provide authoritative, structured data. Use log scraping only when you need fault injection timeline context.
- **Use filters for large log sets.** When the inline log viewer shows more than ~70 items, apply a filter (e.g., `fault:{`) before reading events. This makes virtual scrolling irrelevant because the filtered set fits in the viewport.
- **Useful filter strings**: `fault:{` for fault injection events, `validation` for validation results, `container_exit_code` for container deaths, `error` for error-level logs.
- **Compare assertion details from URLs.** The `get_logs_event_desc` parameter in each example's log URL contains a base64-encoded string with the full assertion details, including `condition` and `details`. The enhanced `examples-table.js` decodes this automatically.
- **Multiple findings often share a root cause.** If several findings appear in the same run and involve the same containers or fault types, they are likely symptoms of the same underlying bug.
- **Check `totalItems` vs `visibleCount`.** Scripts like `extract-fault-events.js` and `read-filtered-events.js` report both values. If `totalItems` is much larger than `visibleCount`, you are missing data and should use the filter approach.
