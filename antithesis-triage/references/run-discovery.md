# Run Discovery

If the user did not provide an explicit triage report url, you can search for recent runs at `https://$TENANT.antithesis.com/runs`.

The runs page is a virtualized grid rendered with `a-row` / `a-cell`, not a
plain HTML `<table>`. Rows are loaded in a `.vscroll` container, so a DOM query
only sees the currently rendered rows unless you scroll.

## Get recent runs as JSON

Use this query file:

- `assets/runs/get-recent-runs.js`

Notes:

- `triageUrl` is `null` for runs that are still in progress and do not yet have a report.
- `findings` is keyed by labels such as `new`, `ongoing`, `resolved`, and `rare`.
- `utilization` is keyed by labels such as `Test hours`, `Setup`, and `Explore`.
