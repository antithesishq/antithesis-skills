# Properties

Properties have finished loading when `assets/report/properties-all.js` stops
returning "loading data" and starts returning an array.

Do not run other property queries until properties have finished loading.


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
