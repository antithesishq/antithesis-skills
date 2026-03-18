# Python Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Python instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/python/`

Current Python support is cataloging-only.

- Add the Antithesis Python package to the environment where the SUT code runs.
- Place the relevant `.py` files or directories in `/opt/antithesis/catalog/`.
- Expect assertion cataloging, but not coverage instrumentation.
- Antithesis gathers symbol information automatically for this flow, so there is no separate `/symbols` requirement in the current docs.
- If the user expects coverage-guided Python instrumentation, call out that the docs describe it as a future release rather than a generally available tool.
