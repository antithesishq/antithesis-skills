# Property queries

`report` refers to `window.__antithesisTriage.report` in this file.

## Primary property queries:

- `report.getAllProperties()` — all properties
- `report.getFailedProperties()` — failed properties only
- `report.getPassedProperties()` — passed properties only
- `report.getUnfoundProperties()` — unfound properties only

Each property in the returned `properties` array includes:

```json
{
  "group": ["SDK: Go"],
  "name": "example property",
  "status": "failed",
  "passingCount": "3,529",
  "failingCount": "10,409"
}
```

`passingCount` and `failingCount` are comma-formatted count strings representing the total across all execution histories in the run (not just the 3-4 example rows shown in the UI).

### Using pass/fail ratios for triage prioritization

- **All failing (0 passing)** — Likely a setup or workload bug. The property is being violated in every execution history.
- **Mostly failing with rare passes** — Could be a workload issue that only succeeds under specific conditions, or a real bug that's hard to avoid.
- **Mostly passing with rare failures** — Strong candidate for a real SUT bug. Pay attention to rare event orderings or fault patterns in the logs.
- **Roughly even split** — The property may be sensitive to configuration or timing. Check whether passing vs failing correlates with fault intensity.

## Assertion types and what they mean for triage

Each property is backed by an assertion of a specific type. The type determines what a failure actually tells you:

- **`Always`**: Must be true every evaluation. Fails if the condition is false at least once.
- **`AlwaysOrUnreachable`**: Either never reached, or true every time reached. Fails if reached at least once AND false at least once. A rare or optional path was exercised and the invariant didn't hold. The path being reached is itself informative.
- **`Sometimes`**: Must be true at least once across the entire run. Fails if the condition is never true.
- **`Reachable`**: The assertion point must be reached at least once. Fails if never reached. Could be a test coverage gap, a workload that never triggers the state, or a SUT bug that prevents the path.
- **`Unreachable`**: The assertion point must never be reached. Fails if reached at least once. A forbidden or impossible path was entered.

`Always` and `Sometimes` assertions imply `Reachable`. If any `Reachable` assertion fails but has no examples, this means that it was never reached. This might simply be due to the test not running long enough, or it may be that the workload is not triggering the state. It may also mean that a SUT bug is preventing the assertion from being reached, although ideally you can discern that via another property that catches the bug.

Numeric/boolean variants (e.g., `AlwaysGreaterThan`, `SometimesAll`) follow the same pass/fail semantics as their base type but attach the compared operands to assertion details automatically.

## Property examples

- `report.getPropertyExamples()` - all properties with example tables
- `report.getFailedPropertyExamples()` - failed properties with example tables

Returns each property with `group`, `name`, `status`, and `examples` array
containing `{ index: 0, status: "failing", time: "85.75s" }` entries.

Each property may expose multiple example rows (typically 3-4), mixing failing
and passing examples. When triaging, start with the **first failing example**
(usually index 0) by default. Cross-referencing a passing example can help
narrow down root cause by showing what's different in a healthy execution.

## Example log URLs

Eval `report.getExampleLogsUrl(propertyName, exampleIndex)` to retrieve the log URL for a specific example. Returns `{ propertyName, exampleIndex, logsUrl }`. Throws if the property is not found or the example index is out of range.

> **Treat log URLs as opaque.** Never attempt to decode, parse, or extract data
> from URL query parameters.

## Download logs from a log URL

Use `download-logs.sh` to fetch the log URL for a given example. The script
handles navigation, waiting, download, and post-processing automatically:

```bash
bash assets/download-logs.sh \
  --url "$LOGS_URL" \
  --output /tmp/triage/property-name.json
```

Always download logs to a unique path unless you have explicit instructions otherwise. Other agents may be concurrently downloading logs.

If you do not have access to `bash` on this machine, read the download-logs script and perform the steps manually.

The script creates its own browser session using shared `antithesis` auth,
navigates to the URL, waits for the page to load, downloads the file, and
post-processes the JSON automatically. The default format is JSON. Use
`--format txt` or `--format csv` when asked, but prefer JSON whenever possible.

To learn how to understand logs, refer to `references/logs.md`.
