# antithesis-triage-test

Live integration test for the `antithesis-triage` skill runtime. It opens a
real tenant, exercises every runtime method across three page types (runs,
report, logs), and optionally tests error-report detection on incomplete runs.

## Prerequisites

- `agent-browser` (installed and `agent-browser install` run)
- `jq`
- An active authenticated Antithesis session using `--session-name antithesis`

## Usage

```bash
antithesis-triage-test/run.sh <tenant-id>
```

For example:

```bash
antithesis-triage-test/run.sh orbitinghail
```

## What it does

1. **Runs page** — opens `https://<tenant>.antithesis.com/runs`, injects
   the triage runtime, and calls `getRecentRuns()`. Discovers the latest
   completed report URL and the latest incomplete report URL (if any).
2. **Completed-report prepass** — probes recent completed reports with the
   `report-examples` audit until it finds one that actually exposes an example
   `logsUrl`. This avoids fully auditing many completed reports just to find a
   viable logs candidate.
3. **Report page** — navigates to the selected completed report candidate and
   runs three audit phases:
   - `report-core` — metadata, environment images, findings, utilization
   - `report-properties` — all / failed / passed / unfound property queries
   - `report-examples` — example expansion and logs-URL discovery across
     passing and failing property examples
4. **Logs page** — navigates to the first example logs URL and tests event
   reading, collection, filtering, search, and highlighted-event lookup.
5. **Error report** _(optional)_ — if an incomplete run was found on the runs
   page, navigates to its report and runs the `report-error` audit phase.
   Verifies that `waitForReady()` short-circuits, `getError()` returns the
   right type (`setup_error` or `runtime_error`), that metadata /
   environment methods still work, and that inline error-log panes can be
   discovered and read when the report exposes them.

## Output

Results are written to `antithesis-triage-test/out/<tenant>-<timestamp>.json`.
The script also prints a human-readable test summary to the terminal with:

- every executed test
- which tests failed or were skipped
- an overall pass/fail metric

The top-level `ok` field is `true` only when every required phase passes.

Temporary intermediate files go to `antithesis-triage-test/tmp/` and are
cleaned up automatically.

```bash
# Inspect the compact summary object
jq '.summary | {overallStatus, executed, passed, failed, skipped}' \
  antithesis-triage-test/out/*.json

# Check just the error-report audit
jq '.errorReportAudit | {ok, discovered, warnings, errors}' antithesis-triage-test/out/*.json
```
