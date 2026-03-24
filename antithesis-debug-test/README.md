# antithesis-debug-test

Live integration test for the `antithesis-debug` skill runtime. It opens an
Antithesis debugging session, verifies the notebook loads, tests editor
read/write, and runs a full action lifecycle (inject, authorize, read result).

## Prerequisites

- `agent-browser` (installed and `agent-browser install` run)
- `jq`
- An active authenticated Antithesis session using `--session-name antithesis`

## Usage

```bash
antithesis-debug-test/run.sh <debugger-url>
```

For example:

```bash
antithesis-debug-test/run.sh 'https://tenant.antithesis.com/debug/SESSION_ID?auth=v2.public...'
```

## What it does

The script runs eight sequential audit phases against the debugger notebook:

| Phase               | What it tests                                                          |
| ------------------- | ---------------------------------------------------------------------- |
| `notebook-load`     | Opens the URL, injects the runtime, waits for the notebook to be ready |
| `notebook-write`    | Round-trips a write to the editor and reads the value back             |
| `actions-list`      | Lists existing action cells in the notebook                            |
| `actions-inject`    | Injects a new debug cell with a unique audit tag                       |
| `actions-settle`    | Waits for the notebook to recalculate and render the new cell          |
| `actions-authorize` | Clicks the authorize button on the injected cell                       |
| `actions-result`    | Waits for the action to produce a result                               |
| `actions-getresult` | Reads back the result content from the cell                            |

Each phase reloads the debugger when it needs a clean state, so the test is
safe to run against a real session.

## Output

Results are written to `antithesis-debug-test/out/debug-<timestamp>.json`.
The top-level `ok` field is `true` only when every phase passes.

Temporary intermediate files go to `antithesis-debug-test/tmp/` and are
cleaned up automatically.

```bash
# Pretty-print the summary
jq '{ok, errors, warnings}' antithesis-debug-test/out/*.json

# See per-phase pass/fail
jq '.phases | to_entries[] | {phase: .key, ok: .value.ok}' antithesis-debug-test/out/*.json
```
