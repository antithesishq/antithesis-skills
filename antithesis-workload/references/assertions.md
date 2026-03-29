# Assertions

## Goal

Map each property in the catalog to a concrete Antithesis SDK assertion. For each property, read the evidence file at `antithesis/scratchbook/properties/{slug}.md` alongside the catalog entry. The evidence file contains the specific code paths, failure scenarios, instrumentation points, and key observations that inform assertion design. Some assertions belong in workload code; others belong inside the SUT.

## Match the Assertion to the Property Type

- **`Always`**: Use for safety and correctness invariants that must hold every time the check runs. Example: a balance never goes negative.
- **`AlwaysOrUnreachable`**: Use for invariants on optional or rare paths where "never executed" is acceptable but any execution must satisfy the invariant. Example: a stale-read fast path never returns an unsafe timestamp.
- **`Reachable`**: Use for pure path or state reachability when the fact that execution reached a meaningful outcome is the signal. Example: snapshot success, redirect response emitted, queue retry due to leader loss.
- **`Unreachable`**: Use for forbidden paths and impossible states. Example: corruption recovery path entered.
- **`Sometimes(cond)`**: Use for liveness or for non-trivial semantic states that should become true at least once. The condition must itself be meaningful. Example: leader election completes, retry loop eventually drains work.

## Rich Assertions

Some Antithesis SDKs expose richer assertion helpers. Check whether the SDK you are using offers them.

Use a rich form when it cleanly matches the property. If a plain `Always(...)`, `Sometimes(...)`, `Reachable(...)`, or `Unreachable(...)` is clearer, use that instead. In the SDKs that expose rich forms today, numeric helpers automatically add the compared operands to assertion details, and boolean helpers automatically add the named boolean inputs.

### Numeric Rich Assertions

Use these when the property is fundamentally a numeric comparison:

- **`AlwaysGreaterThan(left, right)`**: every evaluation must satisfy `left > right`.
- **`AlwaysGreaterThanOrEqualTo(left, right)`**: every evaluation must satisfy `left >= right`.
- **`AlwaysLessThan(left, right)`**: every evaluation must satisfy `left < right`.
- **`AlwaysLessThanOrEqualTo(left, right)`**: every evaluation must satisfy `left <= right`.
- **`SometimesGreaterThan(left, right)`**: at least one evaluation must satisfy `left > right`.
- **`SometimesGreaterThanOrEqualTo(left, right)`**: at least one evaluation must satisfy `left >= right`.
- **`SometimesLessThan(left, right)`**: at least one evaluation must satisfy `left < right`.
- **`SometimesLessThanOrEqualTo(left, right)`**: at least one evaluation must satisfy `left <= right`.

These are the numeric forms of `Always(...)` and `Sometimes(...)`. They fit thresholds, bounds, ordering relationships, counts, sizes, queue depths, version numbers, timestamps, and latency or duration checks.

When available, the SDK typically adds the operands to assertion details as `left` and `right`, so do not duplicate those fields unless extra context is needed.

### Boolean Rich Assertions

Use these when the property is really about a set of named booleans rather than one opaque combined expression:

- **`AlwaysSome(named_bools)`**: every evaluation must have at least one named boolean true.
- **`SometimesAll(named_bools)`**: at least one evaluation must have all named booleans true together.

These fit properties where the individual boolean inputs matter on their own, for example:

- replication or redundancy checks such as "data is present in at least one replica"
- quorum or availability checks such as "at least one backend is healthy"
- combined-good-state checks such as "all replicas are alive at the same time"

When available, the SDK adds the named boolean inputs to assertion details under their names, which makes triage more informative than an anonymous combined expression.

## Anti-Rules

- Do not use `Sometimes(true, ...)` in normal workload or SUT code. If the condition is constant true, use `Reachable(...)` instead.
- Do not use `Sometimes(cond, ...)` when the only thing you care about is that execution hit a path. Use `Reachable(...)`.
- Do not reuse one assertion message across multiple unrelated callsites. Every assertion message should be unique in the codebase.
- Do not stack broad early `Reachable(...)` markers on a straight-line flow when a later, more specific outcome marker already proves the path was exercised.

## Good and Bad Uses

- Good: `Reachable("snapshot completed successfully")`
- Bad: `Sometimes(true, "snapshot path reached")`
- Good: `Sometimes(queue_drained, "queue drained after retry loop")`
- Bad: `Reachable("entered queue processing function")` when later success/failure markers already distinguish the useful outcomes
- Good: `Unreachable("redirect emitted with missing leader address")`
- Bad: reusing `"client eventually completed useful operation"` across several unrelated callsites

## Assertion Placement

- **Workload-level assertions:** Use for request/response invariants and client-visible guarantees.
- **SUT-side assertions:** Use for internal invariants, rare internal states, branch guidance, forbidden paths, and replay anchors the workload cannot observe directly.
- Keep SUT-side assertions surgical and minimize churn, but add them when they materially improve search guidance.
- When a workload or SUT property is naturally a numeric comparison or a named-boolean aggregate, check whether the SDK offers a matching rich assertion form and use it if it improves clarity without distorting the property.

## When To Instrument The SUT Directly

Add SUT-side assertions when a state is dangerous, timing-sensitive, hard to observe externally, or useful as a branch or replay anchor.

Good candidates include:

- redirect construction and redirect response emission
- queue admission, wait, timeout, drain, and retry outcomes
- leader stepdown, handoff, and leadership-loss retry internals
- SQL rewrite or random/time rewrite subpaths
- snapshot initiation, no-op, blocked, failure, and success outcomes

Prefer outcome markers over earlier path-entry markers. If a later marker already tells you the branch result, the earlier generic marker is usually noise.

## Use Deterministic Randomness

All randomness in test workloads must go through the Antithesis SDK's random module for deterministic replay. Whenever possible, the SUT should also leverage Antithesis randomness rather than using its own. If you are unable to use Antithesis provided randomness everywhere, the ability for Antithesis to quickly find bugs will be diminished.

## Naming

Give assertions clear, descriptive, unique names. These names appear in triage reports, so they should be immediately understandable and should localize one specific callsite or condition.
