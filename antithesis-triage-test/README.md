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
2. **Report page** — navigates to the completed report and runs three audit
   phases:
   - `report-core` — metadata, environment images, findings, utilization
   - `report-properties` — all / failed / passed / unfound property queries
   - `report-examples` — failed-example expansion and logs-URL discovery
3. **Logs page** — navigates to the first example logs URL and tests event
   reading, filtering, search, and highlighted-event lookup.
4. **Error report** _(optional)_ — if an incomplete run was found on the runs
   page, navigates to its report and runs the `report-error` audit phase.
   Verifies that `waitForReady()` short-circuits, `getError()` returns the
   right type (`setup_error` or `runtime_error`), and that metadata /
   environment methods still work.

## Output

Results are written to `antithesis-triage-test/out/<tenant>-<timestamp>.json`.
The top-level `ok` field is `true` only when every phase passes.

Temporary intermediate files go to `antithesis-triage-test/tmp/` and are
cleaned up automatically.

```bash
# Pretty-print the summary
jq '{ok, tenant, errors, warnings}' antithesis-triage-test/out/*.json

# Check just the error-report audit
jq '.errorReportAudit | {ok, discovered, warnings, errors}' antithesis-triage-test/out/*.json
```
