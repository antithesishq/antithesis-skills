# Assertions

## Goal

Write Antithesis SDK assertions that detect the specific bug you are hunting
and verify that the workload reaches the bug's preconditions.

A bug-hunt workload typically has three kinds of assertions:

1. **The bug condition**: An `Always` or `AlwaysOrUnreachable` assertion that
   fails when the bug triggers. This is the primary detection mechanism.
2. **Precondition reach claims**: `Sometimes` assertions that verify the
   workload exercises the bug's preconditions.
3. **Operational reach claims**: `Sometimes` assertions that verify the
   workload is performing its intended operations at all.

## Match the Assertion to the Property Type

- **`Always`**: Use for the bug condition — an invariant that must hold every
  time the check runs. When this assertion fails, the bug has been detected.
  Example: "acknowledged writes are never lost after failover."
- **`AlwaysOrUnreachable`**: Use for invariants on optional or rare paths
  where "never executed" is acceptable but any execution must satisfy the
  invariant. Example: "if the stale-read fast path runs, it never returns an
  unsafe timestamp."
- **`Reachable`**: Use when the fact that execution reached a specific outcome
  is the signal. Example: "snapshot completed successfully," "retry loop
  drained work."
- **`Unreachable`**: Use for forbidden paths. Example: "corruption recovery
  path entered."
- **`Sometimes(cond)`**: Use for reach claims — liveness or semantic states
  that should become true at least once. The condition must itself be
  meaningful. Example: "leader election completes," "workload successfully
  increments counter."

## Rich Assertions

Some SDKs expose richer assertion helpers. Check whether the SDK you are
using offers them. Use a rich form when it cleanly matches the property; use
plain assertions when they're clearer.

### Numeric Rich Assertions

Use when the property is a numeric comparison:

- `AlwaysGreaterThan(left, right)` / `AlwaysGreaterThanOrEqualTo(left, right)`
- `AlwaysLessThan(left, right)` / `AlwaysLessThanOrEqualTo(left, right)`
- `SometimesGreaterThan(left, right)` / `SometimesGreaterThanOrEqualTo(left, right)`
- `SometimesLessThan(left, right)` / `SometimesLessThanOrEqualTo(left, right)`

These fit thresholds, bounds, ordering, counts, sizes, queue depths, version
numbers, timestamps, latency, and duration checks. The SDK adds operands to
assertion details automatically.

### Boolean Rich Assertions

Use when the property is about a set of named booleans:

- `AlwaysSome(named_bools)`: every evaluation must have at least one true.
- `SometimesAll(named_bools)`: at least one evaluation must have all true.

These fit replication checks ("data in at least one replica"), quorum checks
("at least one backend healthy"), combined-state checks ("all replicas alive
simultaneously").

## Assert Bounds, Not Exact Values

Under fault injection, the workload can't observe everything that happened.
Construct bounds from attempted and acknowledged operations, and assert that
observed state falls within those bounds.

Use two assertions for a bound, not one, so triage shows which side failed:

- `AlwaysGreaterThanOrEqualTo(observed, acknowledged, "reflects all acked")`
- `AlwaysLessThanOrEqualTo(observed, attempted, "reflects no more than attempted")`

Don't write `Always(observed == attempted, ...)` — that fires legitimately
whenever the environment dropped requests, drowning real bugs in false
positives.

## Reach Claims

Reach claims are `Sometimes` assertions that prove the workload reaches the
states it is designed to exercise. For bug-hunting, the most important reach
claims are for the bug's **preconditions** — the conditions that must hold
for the bug to trigger.

After each run (local or Antithesis), check which reach claims fired and which
did not. An unfired reach claim is concrete evidence that the workload is not
reaching where it needs to — and the set of unfired claims is the prioritized
list of what to fix. This is the primary iteration signal.

### A Reach Claim Asserts the Precondition, Never the Violation

A reach claim says the workload reaches the state where the bug *can* occur.
It does not say the bug occurs.

Do not write `Sometimes(X)` next to `Always(!X)`. The `Sometimes` fires only
when the `Always` fails. On a build with no bug, the `Sometimes` never fires,
and Antithesis reports it as a failure.

Test each reach claim: does it still fire when the system is correct? If not,
assert the precondition that makes the violation possible.

- Bad: `Always(!(gate_flushed && !on_disk))` with
  `Sometimes(gate_flushed && !on_disk)`
- Good: `Always(!(gate_flushed && !on_disk))` with `Sometimes(!on_disk)` and
  `Sometimes(gate_flushed)`

Assert each part of the precondition separately. Both good claims fire when
the system is correct. Together they show the workload reaches the window
where the gate can lie.

This rule applies especially to a harness built to reproduce a known bug.

## Assertion Placement

- **Workload-level assertions**: Request/response invariants and client-visible
  guarantees. This is where most bug-hunt assertions live.
- **SUT-side assertions**: Internal invariants, rare internal states, branch
  guidance, forbidden paths. Add these when the bug involves internal state the
  workload cannot observe directly.
- Keep SUT-side assertions surgical and minimize churn, but add them when they
  materially improve the ability to detect or guide toward the bug.

## When to Instrument the SUT Directly

Add SUT-side assertions when a state relevant to the bug is dangerous,
timing-sensitive, hard to observe externally, or useful as a branch or replay
anchor.

Good candidates:

- Internal state transitions on the bug's code path
- Locking/unlocking or ownership changes
- Queue admission, wait, timeout, drain, retry outcomes
- Leader election, handoff, or leadership-loss internals
- Cache invalidation or replication lag events
- Recovery or rollback logic

Prefer outcome markers over path-entry markers. If a later marker tells you
the branch result, the earlier generic marker is usually noise.

## Use Deterministic Randomness

All randomness in the workload must go through the Antithesis SDK's random
module for deterministic replay. When running locally (no SDK), use the
standard library's random module instead.

## Anti-Rules

- Do not use `Sometimes(true, ...)`. Use `Reachable(...)` instead.
- Do not use `Sometimes(cond, ...)` when you only care about path reachability.
  Use `Reachable(...)`.
- Do not reuse one assertion message across multiple unrelated callsites.
- Do not construct assertion property names at runtime or pass them through
  variables.
- Do not stack broad early `Reachable(...)` markers on a straight-line flow
  when a later, more specific outcome marker already proves the path was
  exercised.
- Do not assert exact equality on values affected by transient errors. Use
  bounded assertions.
- Do not write `Sometimes(X, ...)` next to `Always(!X, ...)`.

## Naming

Give assertions clear, descriptive, unique names. These appear in triage
reports and must immediately identify one specific callsite or condition.

Every assertion property name must be:

- **Inline**: A string literal at the callsite, not a variable or function
  result.
- **Constant**: Never constructed at runtime. No concatenation, format strings,
  or interpolation.
- **Unique**: No two callsites anywhere in the project may share a name.

These are hard requirements. Antithesis statically analyzes all software during
instrumentation to pre-catalog every assertion. Pre-cataloging is what makes
reachability and unreachability meaningful: to report that a `Reachable` was
never hit, Antithesis must know it exists. A name built at runtime is invisible
to static analysis, a duplicated name collapses distinct callsites into one
catalog entry.
