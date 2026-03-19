# Run Discovery

If the user did not provide an explicit triage report url, you can search for recent runs at `https://$TENANT.antithesis.com/runs`.

## Get recent runs as JSON

Use this query file:

- `assets/runs/get-recent-runs.js`

The page takes a second to load, so you might need to try the query file again if you have no results.

Notes:

- `report_url` is `null` for runs that are still in progress and do not yet have a report.
- `findings` is keyed by labels such as `new`, `ongoing`, `resolved`, and `rare`.
- `utilization` is keyed by labels such as `test_hours_value`, `setup_time`, and `explore_time`.
- 