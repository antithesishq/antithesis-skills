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

| Field                  | Description                              | Operator    |
| ---------------------- | ---------------------------------------- | ----------- |
| `assertion.message`    | Property/assertion name                  | `contains`  |
| `assertion.status`     | `passing` or `failing`                   | `matches`   |
| `assertion.type`       | Assertion type                           | `contains`  |
| `assertion.function`   | Function name                            | `contains`  |
| `assertion.file`       | Source file                              | `contains`  |
| `general.output_text`  | Log output text                          | `contains`  |
| `general.source`       | Process that emitted the event           | `contains`  |
| `general.vtime`        | Virtual time                             | varies      |
| `general.moment`       | Moment                                   | varies      |
| `general.custom`       | Custom field                             | varies      |

**Critical**: `assertion.status` requires the `matches` operator, NOT
`contains`. Using `contains` for status will return no results.

## Two Approaches: URL Construction vs UI Interaction

### URL Construction (Preferred)

The most reliable way to execute queries programmatically is to construct
the search URL directly. This avoids the fragility of targeting dropdowns
and textarea rows in the dynamic query builder DOM.

> **Warning**: The query JSON format below was reverse-engineered from
> Antithesis platform version 50-6 by inspecting live URLs. It is not
> documented by Antithesis and may change in future platform updates. If
> URL construction stops working (queries return no results or the page
> fails to parse the URL), fall back to the UI interaction method below.

#### Query JSON Format

```json
{
  "q": {
    "n": {
      "r": {
        "h": [
          {
            "h": [
              {
                "c": false,
                "f": "assertion.message",
                "o": "contains",
                "v": "data-integrity-after-restart"
              }
            ],
            "o": "or"
          },
          {
            "h": [
              {
                "c": false,
                "f": "assertion.status",
                "o": "matches",
                "v": "failing"
              }
            ],
            "o": "or"
          }
        ],
        "o": "and"
      },
      "t": {
        "g": false,
        "m": ""
      },
      "y": "none"
    }
  },
  "s": "{session_id}"
}
```

#### Field Reference

| JSON key | Meaning                                    |
| -------- | ------------------------------------------ |
| `q`      | Top-level query object                     |
| `q.n`    | Main (WHERE) query block                   |
| `q.n.r`  | Row group container                        |
| `q.n.r.h`| Array of condition groups                  |
| `q.n.r.o`| How groups are joined: `"and"` or `"or"`  |
| `h[].h`  | Array of conditions within a group         |
| `h[].o`  | How conditions within a group are joined   |
| `f`      | Field name (e.g., `assertion.message`)     |
| `o`      | Operator (`contains`, `matches`, `excludes`, `regex`) |
| `v`      | Value string                               |
| `c`      | Case-sensitive boolean (`false` = insensitive) |
| `t`      | Temporal window config (`g`: false, `m`: "") |
| `y`      | Temporal type (`"none"` for simple queries) |
| `s`      | Session ID (scopes query to a specific run) |

#### URL Encoding

1. Serialize the query JSON with compact separators (no spaces)
2. Base64-encode the JSON string
3. Strip trailing `=` padding characters
4. Prepend the `v5v` version prefix
5. Set as the `search` query parameter

Example (Python):
```python
import json, base64

encoded = base64.b64encode(
    json.dumps(query, separators=(',', ':')).encode()
).decode().rstrip('=')
url = f'https://{tenant}.antithesis.com/search?search=v5v{encoded}'
```

Example (JavaScript, in browser):
```javascript
var encoded = btoa(JSON.stringify(query))
  .replace(/=+$/, '');
var url = 'https://' + tenant + '.antithesis.com/search?search=v5v' + encoded;
```

#### Extracting the Session ID

The session ID is required for all queries. Extract it from an existing
Logs Explorer URL (e.g., the "Explore logs" link on a triage report):

```javascript
// Given a search URL from the triage report
var searchParam = new URL(url).searchParams.get('search');
var b64 = searchParam.slice(3); // strip 'v5v' prefix
// Pad to valid base64
while (b64.length % 4) b64 += '=';
var decoded = JSON.parse(atob(b64));
var sessionId = decoded.s;
```

Or use the runtime helper after injection:
```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisQueryLogs.extractSessionId()"
```

### Runtime URL Builder Methods

After injecting `assets/antithesis-query-logs.js`, URL builder methods are
available on two objects:

- **`window.__antithesisQueryBuilder`** — standalone builder, available on
  any page after injection. Use this when constructing a URL before
  navigating to the Logs Explorer (e.g., from a triage report page).
- **`window.__antithesisQueryLogs`** — full runtime, also has the same
  builder methods plus UI interaction and result-reading methods.

If you get `TypeError: Cannot read properties of undefined`, the runtime
has not been injected. Inject it first:

```bash
cat assets/antithesis-query-logs.js \
  | agent-browser --session "$SESSION" eval --stdin
```

#### buildFailureQueryUrl(sessionId, assertionMessage [, tenant])

Build a URL for a simple assertion failure query.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisQueryBuilder.buildFailureQueryUrl('SESSION_ID', 'my-property-name')"
```

#### buildNotPrecededByUrl(sessionId, assertionMessage, precededByField, precededByValue [, tenant])

Build a temporal query URL filtering for failures NOT preceded by a condition.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisQueryBuilder.buildNotPrecededByUrl('SESSION_ID', 'my-property', 'assertion.message', 'upstream-failure')"
```

#### buildNotFollowedByUrl(sessionId, assertionMessage, followedByField, followedByValue [, tenant])

Build a temporal query URL filtering for failures NOT followed by a condition.

#### buildSearchUrl(options [, tenant])

Build a URL from a full options object. Accepts either a raw query JSON
(from `buildQuery`) or an options object with `sessionId`, `conditions`,
and optional `temporalType`/`temporalConditions`.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisQueryBuilder.buildSearchUrl({ \
    sessionId: 'SESSION_ID', \
    conditions: [ \
      { field: 'assertion.message', op: 'contains', value: 'my-property' }, \
      { field: 'assertion.status', op: 'matches', value: 'failing' } \
    ] \
  })"
```

All builder methods accept an optional `tenant` parameter (the hostname,
e.g. `"my-tenant.antithesis.com"`) as the last argument. If omitted, the
current page hostname is used. Pass `tenant` explicitly when building URLs
from a page that is not on the Antithesis domain.

### UI Interaction (Fallback)

Use UI interaction only when URL construction is not possible (e.g.,
exploring the query builder interactively or when the query JSON format
changes).

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
   - Categories: `general`, `assertions`, `test composer`, `fault injector`
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

After searching, results appear in the `.event_search_results` area.
The count is shown as "Search results: N matching events".
Results can be viewed as `List` or `Map` (tabs near the results header).
