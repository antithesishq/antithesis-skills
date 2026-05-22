# Query Builder

## Page Structure

The Logs Explorer is at `https://{tenant}.antithesis.com/search?search={encoded_query}`.
It is NOT the same as the per-example log viewer (which has `get_logs=true` in the URL).

## What You Can Search For

The Logs Explorer searches across all timelines in a run. There are three
broad categories of searchable events:

### 1. Property failures (assertion events)

Search for Antithesis SDK assertion events by property name and status. Use
this when investigating a specific property from a triage report.

- **Field**: `assertion.message` — the property name passed to the SDK
  assertion call (e.g., `always`, `sometimes`, `reachable`)
- **Field**: `assertion.status` — `passing` or `failing`
- **When to use**: Following up on a failing property from triage, counting
  independent failures, cascade elimination via temporal queries

### 2. Plain-text log output

Search for strings in stdout/stderr output from any container. Use this when
looking for error messages, warnings, or specific log lines that aren't
structured assertions.

- **Field**: `general.output_text` — matches against the raw text output
  from processes
- **When to use**: Searching for error messages (e.g., "connection refused",
  "segmentation fault"), correlating failures with specific log output,
  building temporal queries where the cascade source is a log message rather
  than a property failure

### 3. Structured event fields

Search within structured metadata attached to events — the source process,
container name, virtual time, or custom fields.

- **Field**: `general.source` — the process that emitted the event (e.g.,
  `python3.11`, `fault_injector`)
- **Field**: `general.custom` — custom structured fields on events
- **When to use**: Filtering by container or process, correlating with fault
  injection events, narrowing results to a specific part of the system

These categories can be combined in a single query using AND/OR connectors.
For example, you can search for property failures that occur on a specific
container, or plain-text error messages that are preceded by a fault injection
event.

## Field Names (Important)

Field names are **singular**, not plural:

| Field                 | Description                    | Operator   |
| --------------------- | ------------------------------ | ---------- |
| `assertion.message`   | Property/assertion name        | `contains` |
| `assertion.status`    | `passing` or `failing`         | `matches`  |
| `assertion.type`      | Assertion type                 | `contains` |
| `assertion.function`  | Function name                  | `contains` |
| `assertion.file`      | Source file                    | `contains` |
| `general.output_text` | Log output text                | `contains` |
| `general.source`      | Process that emitted the event | `contains` |
| `general.vtime`       | Virtual time                   | varies     |
| `general.moment`      | Moment                         | varies     |
| `general.custom`      | Custom field                   | varies     |

**Critical**: `assertion.status` requires the `matches` operator, NOT
`contains`. Using `contains` for status will return no results.

## Two Approaches: URL Construction vs UI Interaction

### URL Construction (Preferred): build-url.py

Prefer constructing the search URL with `assets/build-url.py` and handing
it to `agent-browser open`. URLs are deterministic and never depend on the
DOM, so this avoids the fragility of clicking dropdowns and targeting rows
in the dynamic query builder.

```bash
# Simple failure query
python3 assets/build-url.py failure \
  --session-id "$SESSION_ID" \
  --property "my-property-name" \
  --tenant "{tenant}.antithesis.com"

# Cascade-elimination (X failures NOT preceded by Y)
python3 assets/build-url.py not-preceded-by \
  --session-id "$SESSION_ID" \
  --property "downstream-check" \
  --pre-field assertion.message \
  --pre-value "upstream-fault" \
  --tenant "{tenant}.antithesis.com"

# Independence check (X failures NOT followed by Y) — same shape
python3 assets/build-url.py not-followed-by \
  --session-id "$SESSION_ID" \
  --property "X" \
  --post-field assertion.message --post-value "Y" \
  --tenant "{tenant}.antithesis.com"

# Arbitrary query — see `custom --help` for the JSON spec
echo '{"sessionId":"...","conditions":[{"field":"general.output_text","op":"contains","value":"oops"}]}' \
  | python3 assets/build-url.py custom --tenant "{tenant}.antithesis.com"

# Decode an existing URL (e.g. extract the sessionId from a report's
# "Explore logs" link)
python3 assets/build-url.py decode --url 'https://.../search?search=v5v...'
python3 assets/build-url.py decode --url "$EXPLORE_LOGS_URL" | jq -r '.s'
```

`build-url.py --help` lists every subcommand and flag. The CLI exits
non-zero with a clear message on missing fields, unknown temporal types,
or malformed input.

> **Format stability note**: The encoded URL format (`?search=v5v<base64>`)
> was reverse-engineered from the Antithesis platform by inspecting live
> URLs. It is not documented by Antithesis and may change. If URLs built
> by `build-url.py` stop working after a platform update, fall back to
> the UI interaction method below and update `build-url.py` to match.

### UI Interaction (Fallback)

If URL construction stops working — or you genuinely need to drive the
page (e.g. to capture exactly what the platform produces for a given UI
sequence) — interact with the DOM via the injected runtime
(`assets/antithesis-query-logs.js`, methods on
`window.__antithesisQueryLogs`).

#### Query Builder Elements

The query builder has rows of conditions connected by operators.

##### Run Selector

```
div.select_container.event_search_run_selector
```

Shows the current run. Pre-filled when navigating from a triage report.

##### Query Row

Each row has three parts:

1. **Field selector**: `div.select_container.query_select` (first one)
   - Categories: `general`, `assertions`, `test templates`, `fault injector`
     (the UI category label is plural "assertions", but field names are singular — `assertion.message`)
   - Assertion fields: `message`, `type`, `status`, `function`, `file`
   - General fields: `output_text`, `source`, `vtime`, `moment`, `custom`
   - The `message` field under assertions maps to `assertion.message`
   - The `status` field under assertions maps to `assertion.status`

2. **Operator selector**: `div.select_container.query_select` (second one)
   - `contains` — substring match
   - `excludes` — negative substring match
   - `regex` — regular expression match
   - `matches` — exact match (required for `assertion.status`)

3. **Value input**: `textarea.textarea_component`
   - Enter the search text here

##### Row Connectors

Rows are connected by selectable options:

- `AND` — both conditions must match on the same event
- `OR` — either condition matches
- `+ AND` — add another AND condition row (the button text is `+ AND`)

These appear as labels/radio buttons between query rows.

##### Adding Rows

Click `+ AND` to add another condition row to the current query block.

## Building a Query (UI Method)

### Simple assertion search

1. Click the field selector → choose `assertions` section → `message`
2. Operator: `contains`
3. Value: the property name (e.g., `data-integrity-after-restart`)
4. Click `+ AND`
5. Field: `assertions` → `status`
6. Operator: `matches` (NOT `contains`)
7. Value: `failing`
8. Click the `Search` label/button

### Search Button

The Search button is a `label` element with text "Search". Click it to execute.

```bash
agent-browser --session "$SESSION" eval \
  "Array.from(document.querySelectorAll('label')).find(l => l.textContent.trim() === 'Search').click()"
```

## Results

After searching, result rows render inside `.event_search_results`. The
match count is shown in a separate `<span class="event_heading_count">`
above the rows (e.g. "54,924 matching events"); when there are zero
matches, "No matching events" appears inside `.event_search_results`
instead. `window.__antithesisQueryLogs.getResultCount()` and `.search()`
read both locations.

Results can be viewed as `List` or `Map` (tabs near the results header).
