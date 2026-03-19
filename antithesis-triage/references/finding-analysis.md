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
| `assets/finding/examples-table.js`          | Get all example rows with status, time, URLs, and decoded assertion details |
| `assets/finding/select-example-row.js`      | Select an example row by index (prepend `var ROW_INDEX = N;`)              |
| `assets/finding/decode-assertion-from-url.js` | Decode assertion JSON from a log URL parameter                            |
| `assets/finding/extract-example-details.js` | Extract assertion data from the Details panel of the selected row          |
| `assets/finding/get-inline-item-count.js`   | Get total item count from the inline log viewer                            |
| `assets/finding/filter-inline-logs.js`      | Reference doc — filter must be applied via `agent-browser fill` (see below) |
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
- `moment` object with `session_id`, `input_hash`, and `vtime` for each example
- `logsUrl` linking directly to the log viewer for each example's moment

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

### 4. Get detailed assertion data (optional)

If the URL-decoded assertion from Step 2 was truncated or insufficient:
- Use `<extract-example-details.js>` to read the full Details panel content
- Or use `var LOG_URL = "..."; <decode-assertion-from-url.js>` for a specific URL

### 5. Correlate and summarize

For each example, include the moment reference and a link to the log viewer. Use the `moment` and `logsUrl` fields from `examples-table.js`:

````
### Example N — Failing (Xs)

```
Moment.from({ session_id: "...", input_hash: "...", vtime: ... })
```
[View logs](https://demo.antithesis.com/search?search=...)

| vtime | source | event |
|-------|--------|-------|
| ...   | ...    | ...   |
````

Then build a comparison table with structured fault data:

| Factor            | Failing Example 0      | Failing Example 1    | Passing Example |
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

## Public report pages

Public reports at `public.antithesis.com/report/...` use the same finding page components but do not require authentication. The same query files work on public pages.

To navigate back to the full report from a finding page, click the "View full report" button at the top. This uses `agent-browser snapshot` or `click` on the button element.

## Tips

- **Prefer structured data over log scraping.** Assertion details decoded from URLs (via `examples-table.js` or `decode-assertion-from-url.js`) and the Details panel (`extract-example-details.js`) provide authoritative, structured data. Use log scraping only when you need fault injection timeline context.
- **Use filters for large log sets.** When the inline log viewer shows more than ~70 items, apply a filter (e.g., `fault:{`) before reading events. This makes virtual scrolling irrelevant because the filtered set fits in the viewport.
- **Useful filter strings**: `fault:{` for fault injection events, `validation` for validation results, `container_exit_code` for container deaths, `error` for error-level logs.
- **Compare assertion details from URLs.** The `get_logs_event_desc` parameter in each example's log URL contains a base64-encoded string with the full assertion details, including `condition` and `details`. The enhanced `examples-table.js` decodes this automatically.
- **Multiple findings often share a root cause.** If several findings appear in the same run and involve the same containers or fault types, they are likely symptoms of the same underlying bug.
- **Check `totalItems` vs `visibleCount`.** Scripts like `extract-fault-events.js` and `read-filtered-events.js` report both values. If `totalItems` is much larger than `visibleCount`, you are missing data and should use the filter approach.
