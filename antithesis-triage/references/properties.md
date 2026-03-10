# Properties

On some reports, a fresh page load only exposes top-level property groups. The
dedicated property scripts activate the requested tab and expand visible groups
before collecting leaf properties.

Do not run property queries while the page is navigating or while another
command is changing the route. Open the report first, wait for
`assets/report/loading-finished.js` to return `true`, and only then run a
property query.

On a single `agent-browser` session, run property queries one at a time. The
property scripts switch tabs and expand groups, so concurrent `eval` calls can
race and return incomplete results.

All properties query file:

- `assets/report/properties-all.js`

Failed properties query file:

- `assets/report/properties-failed.js`

Passed properties query file:

- `assets/report/properties-passed.js`

Unfound properties query file:

- `assets/report/properties-unfound.js`

To expand visible failed leaf properties until their example tables are
available for log extraction, use:

- `assets/report/expand-failed-examples.js`
