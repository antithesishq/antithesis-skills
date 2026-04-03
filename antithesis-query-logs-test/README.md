# antithesis-query-logs-test

Live integration test for the `antithesis-query-logs` skill. Tests URL
construction and UI interaction methods against a real tenant, and diagnoses
temporal query URL failures by comparing URL-constructed JSON against
platform-generated JSON from the UI.

## Prerequisites

- `agent-browser` (>= v0.23.4, installed and `agent-browser install` run)
- `jq`
- An active authenticated Antithesis session using `--session-name antithesis`
- A tenant with at least one completed run that has failing properties

## Usage

```bash
antithesis-query-logs-test/run.sh <tenant-id>
```

For example:

```bash
antithesis-query-logs-test/run.sh honey-whale
```

## What it does

1. **Setup** — opens the runs page, finds a completed report with failing
   properties, extracts the session ID and a failing property name to use
   as query targets.

2. **Simple URL** — builds a failure query URL using
   `buildFailureQueryUrl()`, navigates to it, and verifies the page parses
   the URL correctly (run selector populated, query fields filled, search
   returns results).

3. **Temporal URL** — builds a NOT PRECEDED BY query URL using
   `buildNotPrecededByUrl()`, navigates to it, and checks whether the page
   parses it correctly. Records the run selector state, field population,
   and decoded JSON. This is the phase most likely to fail.

4. **Temporal UI** — navigates to the Logs Explorer with the correct run
   pre-selected, builds the same temporal query via UI interaction (clicking
   "Preceded by", switching to "Not preceded by", filling fields), executes
   the search, and captures the platform-generated URL. This proves the
   query itself is valid.

5. **Diagnostic** — deep-diffs the URL-constructed JSON against the
   UI-captured JSON. Reports every structural difference (missing keys,
   extra keys, value mismatches) and generates hypotheses about what the
   URL builder needs to change.

6. **Temporal URL retry** _(optional)_ — if the diagnostic found
   differences, encodes the UI-captured JSON with the same v5v+base64
   method and navigates to it. If this works, it confirms the JSON format
   was the problem.

## Output

Results are written to `antithesis-query-logs-test/out/<tenant>-query-logs-<timestamp>.json`.

The script prints a human-readable summary including:
- Which query methods work (simple URL, temporal URL, temporal UI)
- JSON structural differences (if any)
- Hypotheses for fixing the URL builder
- Pass/fail status for every check

```bash
# Inspect the summary
jq '.summary | {overallStatus, simpleUrlWorks, temporalUrlWorks, temporalUiWorks, jsonStructuresMatch}' \
  antithesis-query-logs-test/out/*.json

# See the JSON differences
jq '.summary.differences' antithesis-query-logs-test/out/*.json

# See the hypotheses
jq '.summary.hypotheses' antithesis-query-logs-test/out/*.json

# Compare the two decoded JSONs side by side
jq '.diagnosticAudit.discovered | {urlJson, uiJson}' antithesis-query-logs-test/out/*.json
```
