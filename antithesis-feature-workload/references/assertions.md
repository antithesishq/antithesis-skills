# Assertions

## Goal

Write Antithesis SDK assertions that check the feature's properties and
verify that the workload reaches the feature's important states.

A feature workload typically has three kinds of assertions:

1. **Feature invariants**: `Always` or `AlwaysOrUnreachable` assertions that
   check the feature's correctness properties. These detect real bugs — when
   an invariant fails, the feature is broken.
2. **Behavior reach claims**: `Sometimes` assertions that verify the workload
   exercises the feature's key behaviors — the states and transitions that
   matter for the feature under test.
3. **Operational reach claims**: `Sometimes` assertions that verify the
   workload is performing its intended operations at all.

## Match the Assertion to the Property Type

- **`Always`**: Use for feature invariants — conditions that must hold every
  time the check runs. When this assertion fails, the feature has a bug.
  Example: "acknowledged writes are never lost after failover."
- **`AlwaysOrUnreachable`**: Use for invariants on optional or rare paths
  where "never executed" is acceptable but any execution must satisfy the
  invariant. Example: "if the batch-flush fast path runs, it never drops
  committed entries."
- **`Reachable`**: Use when the fact that execution reached a specific outcome
  is the signal. Example: "concurrent update completed successfully,"
  "retry loop drained work."
- **`Unreachable`**: Use for forbidden paths. Example: "corruption recovery
  path entered," "double-spend accepted."
- **`Sometimes(cond)`**: Use for reach claims — liveness or semantic states
  that should become true at least once. The condition must itself be
  meaningful. Example: "leader election completes," "workload successfully
  processes a batch."

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
states it is designed to exercise. For feature testing, the most important
reach claims are for the feature's **key behaviors** — the states and
transitions the workload must drive the system through.

After each run (local or Antithesis), check which reach claims fired and which
did not. An unfired reach claim is concrete evidence that the workload is not
exercising what it needs to — and the set of unfired claims is the prioritized
list of what to fix. This is the primary iteration signal.

### Sometimes Assertions as Workload Reach Claims

Write `Sometimes` assertions for the behaviors the workload is designed to
drive. Assert the precondition — the state where the interesting behavior
*can* occur — not the violation itself. Use `antithesis-launch` to run a
test, then `antithesis-triage` to check which assertions fired. Unfired ones
are evidence the workload isn't reaching its targets and the starting point
for iteration.

### A Reach Claim Asserts the Precondition, Never the Violation

A reach claim says the workload reaches the state where interesting behavior
*can* occur. It does not say the bug occurs.

Do not write `Sometimes(X)` next to `Always(!X)`. The `Sometimes` fires only
when the `Always` fails. On a correct system, the `Sometimes` never fires,
and Antithesis reports it as a failure.

Test each reach claim: does it still fire when the system is correct? If not,
assert the precondition that makes the violation possible.

- Bad: `Always(!(stale_read && served_to_client))` with
  `Sometimes(stale_read && served_to_client)`
- Good: `Always(!(stale_read && served_to_client))` with
  `Sometimes(stale_read)` and `Sometimes(served_to_client)`

Assert each part of the precondition separately. Both good claims fire when
the system is correct. Together they show the workload reaches the window
where a stale read could be served.

## Assertion Placement

- **Workload-level assertions**: Request/response invariants and client-visible
  guarantees. This is where most feature workload assertions live — they
  check what the feature does from the outside.
- **SUT-side assertions**: Internal invariants, rare internal states, branch
  guidance, forbidden paths. Add these when the feature involves internal
  state the workload cannot observe directly.
- Keep SUT-side assertions surgical and minimize churn, but add them when they
  materially improve the ability to detect violations or guide the search
  toward the feature's interesting states.

## When to Instrument the SUT Directly

Add SUT-side assertions when a state relevant to the feature is dangerous,
timing-sensitive, hard to observe externally, or useful as a branch or replay
anchor.

Good candidates:

- Internal state transitions on the feature's critical paths
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
