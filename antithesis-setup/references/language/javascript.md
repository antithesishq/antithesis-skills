# JavaScript Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for JavaScript instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/javascript_sdk/`

JavaScript instrumentation is an Antithesis-side source transformation for NodeJS code.

- Add the Antithesis JavaScript SDK to the runtime dependency graph of the NodeJS service or helper that will emit assertions.
- Place the relevant built JavaScript tree in `/opt/antithesis/catalog/`.
- Ensure the runtime artifact includes `node_modules` in the expected layout; the instrumentor searches for directories containing `node_modules`.
- Do not expect browser JavaScript to be instrumented.
- For TypeScript or other JS-target languages, transpile to JavaScript before packaging the image.
- Antithesis gathers symbol information automatically, so no separate `/symbols` step is usually needed.
- If the app depends on ECMAScript `import` support rather than default `require` behavior, note that the docs say Antithesis must enable that account setting.
