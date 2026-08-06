# Instrumentation triage

Use this guide to verify that the system under test (SUT) and the workload are instrumented and that their symbols are registered. Without instrumentation and symbols, Antithesis cannot do coverage-guided fuzzing or thread pausing. This limits how much of the system Antithesis can test. Treat missing instrumentation as a setup problem.

## Step 1: check the setup properties

```bash
snouty runs --json properties --name "software was instrumented" "${RUN_ID}"
snouty runs --json properties --name "symbols were uploaded" "${RUN_ID}"
snouty runs --json properties --name "thread pausing was enabled" "${RUN_ID}"
```

All three are meta properties. Their examples carry values, not moments, so there is no log to download.

Each `Software was instrumented` example is one instrumented module that registered with Antithesis:

```json
{"module_desc": "/usr/local/bin/simulator", "total_locations": 18997, "module": "simulator"}
```

- `module_desc` — identifies the module, usually as an executable path.
- `total_locations` — the number of instrumentation points (basic blocks or control flow graph edges) in the module.

Each `Symbols were uploaded` example lists the uploaded symbol files, for example `["go-63b47d97195d.sym.tsv"]`.

**Deduplication caveat:** Antithesis deduplicates these two example lists by debug id. The same binary that starts in many containers appears once. Distinct binaries that share a debug id — for example several Go binaries built from one instrumented module — also collapse into one entry. An expected binary can be absent from the list even when it is instrumented.

Each `Thread pausing was enabled` example is a `"binary (container)"` string. This list is per container, and it is not deduplicated by debug id. A binary in this list is instrumented. A binary absent from this list can still be instrumented.

## Step 2: compare against the expected binaries

The setup normally instruments the SUT binaries and the workload binary. Build the expected list from the source code when you have access to it — the harness and build files show which binaries the setup instruments. Without source access, infer the list from the user's request, the run description, and the containers in the run.

- **Any of the three properties fails** — a significant finding: something is probably wrong with the instrumentation setup. Report a setup problem and link the [instrumentation documentation](https://antithesis.com/docs/instrumentation/).
- **Every expected binary appears in a property** — instrumentation works. Report the modules, their `total_locations`, and the symbol files.
- **Some expected binaries are missing** — do not conclude that they are uninstrumented; deduplication can hide them. Report which binaries the properties confirm, and state that the deduplicated lists cannot confirm the rest.

When you cannot build an expected list, report what the properties show and note the deduplication caveat.
