---
name: "Antithesis Workload Design"
description: >
  Guides design of Antithesis workloads and improvement of existing ones.
  Triggers on: "design antithesis workload", "improve antithesis tests",
  "audit antithesis assertions", "antithesis coverage gaps", "fault injection testing"
---

# Antithesis Workload Design

Reference files (read as needed):
- `references/assertion-types.md` — semantics of all 5 assertion types with
  truth tables, numeric/compound variants, lifecycle functions
- `references/patterns.md` — 6 assertion patterns and 6 anti-patterns with
  code examples

## How Assertions Work in Antithesis

Antithesis explores a *tree* of execution histories — not a single run. It
snapshots interesting states and branches thousands of times. Assertions are
evaluated across all branches, and results are aggregated.

**One property per message string.** All evaluations sharing the same `message`
roll up into a single pass/fail property in the triage report. Different
logical assertions must have different messages. The same logical assertion
must always use the same message, even if moved to a different file.

**Assertions guide exploration.** They're not passive observers — `sometimes`
assertions make the explorer work harder to find states where the condition is
true. More assertions = better exploration.

## Assertion Design Checklist

Every workload's assertions should cover these four categories:

### 1. Correctness Invariants (`assert_always!`)

Properties that must hold every time they're checked, even under fault injection.

- What must always be true when we compare results? (e.g., "row count matches upstream")
- What performance SLOs apply? Use tiered thresholds (500ms, 1s, 3s, 5s, 7s) for fine-grained signal.
- What structural invariants hold? Use `assert_always_or_unreachable!` for conditions on optional code paths.

### 2. Coverage Markers (`assert_reachable!`, `assert_sometimes!`)

Confirm the workload actually exercises what it claims to test.

- Is each driver making progress? (`assert_sometimes!(iteration > 0, ...)`)
- Is each operation type exercised? (`assert_reachable!` per operation)
- Are both success and failure paths hit? (cache hit vs fallback, etc.)
- **Every `assert_always!` needs a companion coverage marker** confirming its precondition occurs. Without this, the invariant could be vacuously true.

### 3. Sentinel Properties (`assert_unreachable!`)

States that should never be reached in a correct system.

- What error conditions indicate bugs? (e.g., retry timeout exhausted)
- What HTTP/RPC errors indicate misconfiguration? (e.g., failpoint API unreachable)

### 4. Recovery Properties

Properties about behavior *after* disruption — the bugs Antithesis is best at finding.

- For each communication channel: what happens if it's interrupted?
- After a fault, does the system return to a correct state? How long does it take?
- Use `assert_always!` with timing bounds on recovery paths.

### Rules

- Include JSON detail payloads (`&json!({...})`) with diagnostic context (elapsed times, table names, error messages). These appear in Antithesis triage reports.
- Choose unique, descriptive message strings — they become property names in the report.
- Avoid `assert_always!(true, ...)` — use `assert_reachable!` instead.

## Discovering Existing Assertions

```bash
# Workload assertions
rg 'assert_(always|sometimes|unreachable|reachable)!' public/ddl-stress/ public/readyset-logictest/ query-pilot/

# Production-code reachability markers
rg 'assert_(always|sometimes|unreachable|reachable)!' public/ --glob '!public/ddl-stress/**' --glob '!public/readyset-logictest/**'
```

## Designing a New Workload

1. **Define the testing objective** — be specific about what system behavior you're testing and what recovery scenarios matter.
2. **Identify the architecture boundary** — which components participate? Read `aidoc/codebase/architecture/readyset-overview.md`.
3. **Design workload generators** — parallel drivers exercising different operation types. Use `public/ddl-stress/src/main.rs` as the template.
4. **Design assertions** — work through the checklist above.
5. **Add failpoint chaos** — read `public/readyset-util/src/failpoints/mod.rs` for available failpoints. Use `public/failpoint-client/` for the HTTP activation pattern. See the `chaos` subcommand in ddl-stress for the template.
6. **Build Docker infrastructure** — Dockerfile, compose, entrypoint, test driver scripts. Copy from `antithesis/ddl-stress/` and adapt.
7. **Register in pipeline** — update `antithesis/build-antithesis-image.sh`, `.buildkite/pipeline.readyset-antithesis.yml`, and `antithesis/start-antithesis-run.sh`.

## Auditing an Existing Workload

1. **Discover assertions** — run the grep commands above.
2. **Classify** each assertion into the four checklist categories.
3. **Find gaps** — which categories are missing or thin?
4. **Check companions** — does every `assert_always!` have a coverage marker confirming the scenario actually occurs?
5. **Check recovery** — for each inter-component communication channel, is there an assertion that checks recovery after disruption?
6. **Check for anti-patterns** — see `references/patterns.md`.

## Readyset Context

### Existing Workloads

| Workload | Tests | Key Source |
|----------|-------|-----------|
| DDL Stress | Schema catalog sync under DDL churn | `public/ddl-stress/src/main.rs` |
| SQL-Generator Fuzz | Query correctness via random SQL | `public/readyset-logictest/src/main.rs` |
| Query Pilot | Cache discovery + ProxySQL routing | `query-pilot/src/` |

### Known Failure Modes

- Schema generation mismatch (adapter catalog out of sync with controller)
- SSE stream disconnect (adapter stops receiving catalog updates)
- Replication lag/failure (dataflow falls behind upstream)
- Leader election disruption (controller failover)

### Known Gaps

- No replication failure/recovery workload
- No leader election disruption workload
- Network faults not yet enabled on Antithesis (failpoints are the primary disruption mechanism)
