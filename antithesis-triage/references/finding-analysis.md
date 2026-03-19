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
- **Tabs**: Logs, Artifacts, Details
- **Virtual scrolling**: Only ~50-70 rows render at a time
- **Item count**: Shown above the log list (e.g., "912 items")
- **Filter**: Text input to filter log entries
- **Search**: Text input to search within logs

## Query files

Use these query files from the skill assets directory:

| Query file                                | Purpose                                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| `assets/finding/examples-table.js`        | Get all example rows with status, time, artifacts, and URLs   |
| `assets/finding/select-example-row.js`    | Select an example row by index (prepend `var ROW_INDEX = N;`) |
| `assets/finding/extract-fault-events.js`  | Extract fault injection and validation events from visible logs |

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

## RCA workflow: Compare failing vs passing examples

Follow these steps to root-cause a failing assertion:

### 1. List all examples

Use `assets/finding/examples-table.js` to get the full examples table. Note which examples are Failing vs Passing and their timestamps.

### 2. Analyze each failing example

For each Failing example:

1. Select the row using `assets/finding/select-example-row.js` with the row index
2. Wait ~500ms for logs to load
3. Use `assets/finding/extract-fault-events.js` to get fault injection and validation events
4. Record: what faults occurred, what validation errors appeared, and the assertion details

**Key things to look for in failing examples:**
- `fault_injector` events immediately before the assertion — what fault was active?
- Network faults: `name:partition`, `name:clog`, `name:restore` with `type:network`
- Node faults: `name:kill`, `name:stop`, `name:pause` with `type:node`
- Clock faults: `name:skip` with `type:clock`
- Container exits or restarts (`container_exit_code`)
- Error messages or stack traces in the validation output
- Application-specific error patterns (e.g., consensus elections, connection failures, timeout errors)

### 3. Analyze the passing example

Select the Passing example and extract its fault/validation events. Compare:

- Were there fewer or different fault injection events before validation?
- Did the same assertion fire with `"condition": true` and empty error details?
- Was the system in a more stable state (no active faults, no container restarts)?

### 4. Correlate and summarize

Build a comparison table:

| Factor               | Failing Examples              | Passing Example     |
| -------------------- | ----------------------------- | ------------------- |
| Fault type           | e.g., network partition       | None / different    |
| Fault target         | e.g., ALL nodes, specific node| N/A                 |
| Container state      | e.g., exits, restarts         | Stable              |
| Error details        | e.g., specific error message  | No errors           |

### 5. Check related findings

Return to the main report and check if other findings correlate:
- Other "Never:" properties with the same root cause
- "No unexpected container exits" findings from the same containers
- Properties that were passing previously but now fail

## Public report pages

Public reports at `public.antithesis.com/report/...` use the same finding page components but do not require authentication. The same query files work on public pages.

To navigate back to the full report from a finding page, click the "View full report" button at the top. This uses `agent-browser snapshot` or `click` on the button element.

## Tips

- **Virtual scrolling limits visibility.** The inline log viewer only renders ~50-70 rows. If the logs have hundreds of items, the beginning or end may not be visible. Fault injection events often appear near the start of the visible window, while validation results appear near the end.
- **Compare assertion details from URLs.** The `get_logs_event_desc` parameter in each example's log URL contains a base64-encoded JSON with the full assertion details, including `"condition": true/false` and `"details"`. Decoding this can be faster than reading logs.
- **Multiple findings often share a root cause.** If several findings appear in the same run and involve the same containers or fault types, they are likely symptoms of the same underlying bug.
