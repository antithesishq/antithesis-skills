# Instrumentation triage

Use this guide to verify that the system under test (SUT) and the workload are instrumented and that their symbols are registered. Without instrumentation and symbols, Antithesis cannot do coverage-guided fuzzing or thread pausing. This limits how much of the system Antithesis can test. Treat missing instrumentation as a setup problem.

Three built-in properties carry the setup signals (step 1). Use the events query (step 3) only when the properties do not account for a binary you expect — the query is slow.

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

Each `Thread pausing was enabled` example is a `"binary (container)"` string, for example `"jetstream (jetstream-server)"`. This list is per container, and it is not deduplicated by debug id. A binary in this list is instrumented. A binary absent from this list can still be instrumented.

## Step 2: compare against the expected binaries

The setup normally instruments the SUT binaries and the workload binary. Build the expected list from the user's request, the run description, and the containers in the run. Compare the property signals against it:

- **All three properties fail or list nothing** — the run has no instrumentation. Report a setup problem and link the [instrumentation documentation](https://antithesis.com/docs/instrumentation/).
- **Every expected binary appears in a signal** — instrumentation works. Report the modules, their `total_locations`, and the symbol files.
- **Some expected binaries appear in no signal** — do not conclude that they are uninstrumented; deduplication can hide them. Go to step 3.

When you cannot build an expected list, report what the properties show, note the deduplication caveat, and skip step 3.

## Step 3: list registrations with the events query

```bash
snouty runs --json events "${RUN_ID}" "init_coverage_module() invoked" \
  | jq -r '[.source.container,
            .antithesis_assert.details.executable,
            .antithesis_assert.details.symbolTable,
            (.antithesis_assert.details.edgeCount|tostring)] | join(" | ")' \
  | sort | uniq -c | sort -rn
```

Each output row is one unique combination of container, executable, symbol file, and edge count. The count at the start of the row is the number of registrations. Example output:

```
     34 jetstream-workload | /opt/antithesis/test/v1/main/helper_workload | go-63b47d97195d.sym.tsv | 18996
     14 jetstream-server | /opt/antithesis/test/v1/main/helper_workload | go-63b47d97195d.sym.tsv | 18996
      1 jetstream-simulator | /usr/local/bin/simulator | go-63b47d97195d.sym.tsv | 18996
      1 jetstream-server | /usr/local/bin/jetstream | go-63b47d97195d.sym.tsv | 18996
```

In this run, `Software was instrumented` listed only `/usr/local/bin/simulator`, because all four rows share one debug id. The events query shows that the server binary and the workload helper are also instrumented.

A row is proof that the binary registered instrumentation. An absent row is weaker evidence: binaries with compiler-based instrumentation (for example sancov) do not emit `init_coverage_module()` events, so an instrumented run can return zero rows. Report a binary as uninstrumented only when no signal accounts for it — no property example, no thread-pausing entry, and no events row — and state that evidence.
