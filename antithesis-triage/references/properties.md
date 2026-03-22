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
  "(async () => window.__antithesisTriage.report.waitForReady())()"
```

On a single `agent-browser` session, run property queries one at a time. The
property methods switch tabs and expand groups, so concurrent `eval` calls can
race and return incomplete results.

All properties:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.getAllProperties())()"
```

Failed properties:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.getFailedProperties())()"
```

Passed properties:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.getPassedProperties())()"
```

Unfound properties:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.getUnfoundProperties())()"
```

To expand visible failed leaf properties until their example tables are
available for log extraction, use:

```bash
agent-browser --session "$SESSION" eval \
  "(async () => window.__antithesisTriage.report.expandFailedExamples())()"
```
