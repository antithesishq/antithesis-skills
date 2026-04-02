# Properties

On some reports, a fresh page load only exposes top-level property groups. The
runtime methods activate the requested tab and expand visible groups before
collecting leaf properties.

Do not run property queries while the page is navigating or while another
command is changing the route. Open the report first, wait for
`window.__antithesisTriage.report.waitForReady()` to report `ok: true`, and
only then run a property query.

Example:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.waitForReady()"
```

On a single `agent-browser` session, run property queries one at a time. The
property methods switch tabs and expand groups, so concurrent `eval` calls can
race and return incomplete results.

All properties:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getAllProperties()"
```

Failed properties:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getFailedProperties()"
```

Passed properties:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getPassedProperties()"
```

Unfound properties:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getUnfoundProperties()"
```

To expand visible leaf properties that expose example tables until those rows
are available for log extraction, use:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.expandExamples()"
```

## Property summary text (pass/fail counts)

When a leaf property is expanded in the report, it shows summary text below the
property name with the total number of passing and failing examples across the
entire run. For example:

> On 2026-03-23, 19:59 ... with 3,529 passing examples and 10,409 failing examples

This is distinct from the example rows shown in the table (typically 3-4 rows).
The summary gives the true ratio across all execution histories in the run.

The runtime methods that return leaf properties (`getAllProperties`,
`getFailedProperties`, `getPassedProperties`, `getUnfoundProperties`) now
include `passingCount` and `failingCount` fields on each property object.
These are comma-formatted count strings (e.g. `"3,529"`) or `null` if the
property was not expanded or the summary text is absent.

Example:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.getAllProperties())()"
```

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

### Using pass/fail ratios for triage prioritization

The ratio of passing to failing examples is a strong signal for root cause:

- **All failing (0 passing)** — Likely a setup or workload bug, not a
  real SUT bug. The property is being violated in every execution history,
  which means something is systematically wrong with how it's checked.
- **Mostly failing with rare passes** — Could be a workload issue that only
  succeeds under specific conditions, or a real bug that's hard to avoid.
- **Mostly passing with rare failures** — Strong candidate for a real SUT bug.
  The system usually works but specific fault injection sequences trigger a
  violation. Investigate the failing examples' logs for fault events.
- **Roughly even split** — The property may be sensitive to configuration or
  timing. Check whether passing vs failing correlates with fault intensity.

## Assertion types and what they mean for triage

Each property is backed by an assertion of a specific type. The type determines
what a failure actually tells you:

- **`Always`**: Must be true every evaluation. Fails if the condition is false
  at least once.
- **`AlwaysOrUnreachable`**: Either never reached, or true every time reached.
  Fails if reached at least once AND false at least once. A rare or optional
  path was exercised and the invariant didn't hold. The path being reached is
  itself informative.
- **`Sometimes`**: Must be true at least once across the entire run. Fails if
  the condition is never true. Implies `Reachable`.
- **`Reachable`**: The assertion point must be reached at least once. Fails if
  never reached. Could be a test coverage gap, a workload that never triggers
  the state, or a SUT bug that prevents the path.
- **`Unreachable`**: The assertion point must never be reached. Fails if reached
  at least once. A forbidden or impossible path was entered.

Numeric/boolean variants (e.g., `AlwaysGreaterThan`, `SometimesAll`) follow
the same pass/fail semantics as their base type but attach the compared
operands to assertion details automatically.

To expand properties with example tables and collect their examples in one
structured call:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getPropertyExamples()"
```

This returns each matching property with its `group`, `name`, `status`, and
`examples` array containing `{ status, time, logsUrl }` entries.

If you specifically want failed properties only, use:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getFailedPropertyExamples()"
```

## Navigate to logs for a specific example

Use the exact `logsUrl` from the example associated with a property to open the log viewer. Do not rewrite query parameters.

```
agent-browser --session "$SESSION" open "<logsUrl>"
agent-browser --session "$SESSION" wait --fn \
  "window.location.pathname === '/search' && new URLSearchParams(window.location.search).has('get_logs')"
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.waitForReady()"
```

Before injecting, make sure the browser is still on `/search` with
`get_logs=true`. If it redirected to login or another page, reauthenticate
first.

To learn how to download and understand logs, refer to `references/logs.md`.
