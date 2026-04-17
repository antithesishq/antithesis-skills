---
name: antithesis-query-logs
description: >
  Search across all timelines in an Antithesis test run to find events,
  correlate property failures, and answer temporal questions about ordering
  and causation (e.g., did event A always precede failure B? do failures
  occur even without a preceding fault?).
metadata:
  version: "2026-04-17 94e2698"
---

# Antithesis Logs Explorer

## Purpose and Goal

Search across all timelines in an Antithesis test run to find events,
correlate property failures, and answer temporal questions about ordering
and causation — cascade elimination, fault correlation, root cause hypothesis
testing, and any "if X happened before Y" query.

The Logs Explorer is distinct from the per-example log viewer used in triage.
The triage log viewer shows one timeline centered on one event. The Logs
Explorer searches across ALL timelines in a run, supports temporal queries
(preceded by, not preceded by, followed by, not followed by), and visualizes
results on a multiverse map.

## When to Use

- Investigating whether a property failure is independent or a cascade from
  an earlier failure
- Counting how many independent occurrences of a failure exist across timelines
- Correlating failures with fault injection events
- Comparing failure patterns between backend configurations
- Identifying timeline clusters where failures co-occur

## Prerequisites

- A completed Antithesis run. If you don't have a specific run URL, use the
  `antithesis-triage` skill's run discovery workflow to find one first.
- `agent-browser` installed and authenticated to the Antithesis tenant

## Key Concepts

- **Temporal query**: Search for event X that is (or is not) preceded by or
  followed by event Y. Used to filter out cascade failures.
- **Multiverse map**: Visualization of the timeline tree. Failures appear as
  dots. Clusters of dots on related timelines suggest a shared root cause.
- **Independent cluster count**: The number of distinct timeline branches
  where a failure appears. "8 failures in 2 clusters" is much more informative
  than just "8 failures" — it tells you how many independent reproductions exist.
- **Session ID**: Each run has a unique session ID that scopes all queries.
  Queries against the wrong session return no results. The session ID is
  embedded in the encoded search URL parameter.

## Important: Field Names

The Logs Explorer uses **singular** field names, not plural:

- `assertion.message` — the property/assertion name (NOT `assertions.message`)
- `assertion.status` — `passing` or `failing` (NOT `assertions.status`)
- `general.output_text` — log output text

The `assertion.status` field requires the **`matches`** operator, not
`contains`. Other text fields use `contains`.

## Session Setup

Use `agent-browser` with the shared Antithesis authentication:

```
SESSION="logs-explorer-$(date +%s)-$$"
agent-browser --session "$SESSION" --session-name antithesis --profile antithesis --args "--no-sandbox"
```

## Launching the Logs Explorer

There are three ways to reach the Logs Explorer with the correct run selected:

### Method 1: From a triage report (preferred)

Navigate to the triage report first, then extract the "Explore logs" link.
This is the most reliable method because the link contains the correct session
ID already encoded in the URL.

```bash
agent-browser --session "$SESSION" eval \
  "document.querySelector('a.an-button[href*=\"/search\"]').href"
```

Navigate to the returned URL. This automatically sets the correct session/run.

The URL will have the form:

```
https://{tenant}.antithesis.com/search?search=v5v{base64_encoded_query}
```

The `v5v` prefix is a version marker. The base64 payload contains the query
JSON including the session ID (`s` field). See `references/query-builder.md`
for the full query JSON format.

### Method 2: From the Logs Explorer directly

The Logs Explorer page has a "Show me logs from" dropdown at the top
(`div.select_container.event_search_run_selector`). Click it to see a list
of recent runs with their name, status (In progress / Completed / Incomplete),
and timestamp. Select the run you want.

If a run you expect to see is missing, refresh the page.

### Method 3: From the sidebar

Click "Logs explorer" in the left sidebar navigation. This goes directly to
`https://{tenant}.antithesis.com/search` with no run pre-selected. Then use
the "Show me logs from" dropdown to choose a run.

```bash
agent-browser --session "$SESSION" open "https://{tenant}.antithesis.com/search"
```

**Important**: Always ensure the correct run is selected before searching.
Each run has its own session ID — queries against the wrong session return
no results. The selected run is shown in the dropdown at the top of the page.

## Reference Files

| Reference                        | When to read                                     |
| -------------------------------- | ------------------------------------------------ |
| `references/query-builder.md`    | Building and executing search queries            |
| `references/temporal-queries.md` | Using preceded-by / not-preceded-by filters      |
| `references/results.md`          | Reading search results and clicking into details |
| `references/map.md`              | Using the multiverse map for cluster analysis    |

## Runtime Injection

Inject `assets/antithesis-query-logs.js` into the Logs Explorer page:

```bash
cat assets/antithesis-query-logs.js \
  | agent-browser --session "$SESSION" eval --stdin
```

The runtime registers two objects:

- **`window.__antithesisQueryBuilder`** — standalone URL construction helpers.
  Available on any page after injection. Use this when building a search URL
  before navigating to the Logs Explorer.
- **`window.__antithesisQueryLogs`** — full runtime with URL builders, UI
  interaction methods, and result-reading methods.

**URL construction is the preferred approach** for executing queries
programmatically, because UI interaction (clicking dropdowns, targeting rows)
is fragile with the query builder's dynamic DOM.

**Important**: You must inject the runtime before calling any
`window.__antithesisQueryBuilder` or `window.__antithesisQueryLogs` method.
If you get `TypeError: Cannot read properties of undefined`, inject first.

## Recommended Workflows

### Cascade elimination

1. Navigate to the triage report for the run
2. Inject `assets/antithesis-query-logs.js` (required before using any builder methods)
3. Extract the session ID from the "Explore logs" link (see query-builder.md)
4. Build a simple query URL using `window.__antithesisQueryBuilder.buildFailureQueryUrl(sessionId, "my-failing-property")`
5. Navigate to the URL and note the result count
6. Build a temporal query URL using `window.__antithesisQueryBuilder.buildNotPrecededByUrl(sessionId, "my-failing-property", "assertion.message", "suspected-upstream-failure")`
7. Navigate to the temporal URL and note the new count
8. If the count drops, the difference is cascade failures
9. If the count stays the same, the failures are independent

### Failure correlation with event details

1. Search for a property failure
2. Expand the `{}` details on several results
3. Identify detail fields that vary across results (e.g., configuration
   modes, feature flags, container names, protocol versions)
4. Note whether failures cluster on a specific detail value — if all
   failures share a common detail that other passing events do not, that
   detail is likely part of the root cause

### Independent cluster analysis

1. Search for a property failure
2. Switch to the Map tab
3. Count the number of distinct timeline branches with failure dots
4. Failures on the same branch are likely the same root cause
5. Pick one representative from each cluster for investigation

## Output

- Event counts (total matches, matches after temporal filtering)
- Event details (timestamp, timeline, assertion details and custom key-value pairs)
- Cluster count from the multiverse map
- Log context around each failure (fault events, preceding operations)
