# Live Runs

Follow an `in_progress` run's properties as they are decided with `snouty runs stream`. It needs snouty with `runs stream`, and the run must have been created on release 65.3 or later.

## How to use runs stream

```bash
snouty runs stream <run_id> [--property <PROPERTY_ID>]... [--json]
```

- `--property` streams only that property's events. Repeat it to follow several properties.
- `--json` prints one JSON object per line, each with an `event` key.
- Output lines:
  - `property <id> <name>`
  - `sample <id> example|counterexample <hash> <vtime>`
  - `verdict <id> passed|failed`
  - `completed <run_id>`: the run is final and the command exits 0.
- A sample's hash and vtime form a moment. Use it for logs (`references/logs.md`) or `antithesis-debug`.
- Look up a property by its id with `snouty runs property <run_id> <id>`.
- The stream shows only events after it opens. Once stderr prints `the stream of run <id> is open`, run `snouty runs properties <run_id>` and merge the two outputs.
- A new run's stream returns 404 for about 5 minutes. snouty waits through this on its own. After that, a 404 means the run doesn't exist, has finished, or has status `unknown`; a 409 means the run predates release 65.3.

## When each result is final

Each property gets one verdict that never changes.

| Final as soon as it is seen | Waits for `completed` |
| --- | --- |
| Always / AlwaysOrUnreachable fails (a counterexample) | Always / AlwaysOrUnreachable passes |
| Sometimes / Reachable passes (an example) | Sometimes / Reachable fails |
| Unreachable fails (it was reached) | Unreachable passes |

Numeric/boolean variants (e.g. `AlwaysGreaterThan`, `SometimesAll`) follow their base type.

Go by `verdict` lines, not `sample` lines. A non-event property can pass even when it has a counterexample.

## Example

```bash
RUN=$(snouty runs --json list -n 200 --status in_progress | jq -r '.run_id' | head -1)
snouty runs stream "$RUN"
```
