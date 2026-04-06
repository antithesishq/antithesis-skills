# Run Discovery

If the user did not provide an explicit triage report url, you can search for recent runs at `https://$TENANT.antithesis.com/runs`.

To filter runs by text, append the `primary-filter` query parameter when navigating to the runs page. Make sure to URL escape the filter value.

```
https://$TENANT.antithesis.com/runs?primary-filter=FILTER_TEXT
```

This pre-fills the "Filter by text" input and restricts the visible runs to those matching the filter. Use this when looking for runs by name, repository, or other text. You can also modify the `Filter by text` input to change the filter while on the runs page. The input selector is:

```
input.input_input[placeholder="Filter by text"]
```

The runs page is a virtualized grid rendered with `a-row` / `a-cell`, not a
plain HTML `<table>`. Rows are loaded in a `.vscroll` container, so a DOM query only sees the currently rendered rows unless you scroll.

You can load the entire runs table using `getRecentRuns`:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.runs.getRecentRuns()"
```

To filter by status, pass a `status` option. Valid values: `Starting`,
`In progress`, `Completed`, `Cancelled`, `Incomplete`.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.runs.getRecentRuns({status: 'Incomplete'})"
```

The filter is applied before scrolling and automatically cleared afterward,
so the page is left in a clean state.

Notes:

- `triageUrl` is `null` for runs that are still in progress and do not yet have a report.
- `findings` is keyed by labels such as `new`, `ongoing`, `resolved`, and `rare`.
- `utilization` is keyed by labels such as `Test hours`, `Setup`, and `Explore`.
