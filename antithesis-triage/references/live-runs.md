# Live Runs

Follow an `in_progress` run's properties as they are decided with `snouty runs stream`.

## How to use runs stream

- Run `snouty runs stream --help`.
- A sample's hash and vtime are a moment you can debug with `antithesis-debug`.
- On a finished run, the stream prints `completed` and exits 0. A 409 means the run predates release 66.

## When each result is final

A `verdict` line is final: each property gets one, and it never changes. Only these can arrive before `completed`: an Always, AlwaysOrUnreachable, or Unreachable failing, and a Sometimes or Reachable passing. Their opposites depend on something never happening, so they arrive at `completed`. Numeric/boolean variants (e.g. `AlwaysGreaterThan`) follow their base type.

Go by `verdict` lines, not `sample` lines. A non-event property can pass even when it has a counterexample.
