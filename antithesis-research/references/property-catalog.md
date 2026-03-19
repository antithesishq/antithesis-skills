# Property Catalog

## Property Types

- **Safety (correctness):** A bad thing never happens.
- **Liveness (progress):** A good thing eventually happens.
- **Reachability:** A code path is (or isn't) reached.

## Core Methodology

Establish an invariant. Run a workload. Let Antithesis inject faults and explore code paths. Assert the invariant still holds.

This cycle applies to every property: define what should be true, exercise the system, and check that it remains true under adversarial conditions.

## Every Property Must Be Specific and Checkable

Not "test failover" but "acknowledged writes survive leader failover" with a concrete assertion. Vague properties can't be implemented and can't fail — which means they can't find bugs.

Ask: "What exact condition would I check in code to verify this?" If you can't answer that, the property isn't specific enough.

## Cross-Reference Closed Issues as Regression Targets

A recently-fixed bug is a great Antithesis test because the fix may not cover all edge cases. For each closed bug in the target area:

- What was the root cause?
- What timing or fault condition triggered it?
- Could a similar but slightly different condition bypass the fix?
- Turn these into explicit properties in the catalog.

## Property Catalog Format

For each property, document:

```
### [ID]. [Property Name]

| | |
|---|---|
| **Type** | Safety / Liveness / Reachability |
| **Property** | One sentence: what guarantee are we testing? |
| **Invariant** | What Antithesis SDK assertion(s)? Be specific about what is checked and how. Include why that assertion type matches the property semantics. |
| **Antithesis Angle** | How does fault injection interact with this? What timing/interleaving does it explore? |
| **Why It Matters** | Real-world impact. Link to issues if applicable. |
```

## Choosing the Right Antithesis Assertion

Antithesis assertions are not traditional crash-on-failure assertions. Failed Antithesis assertions do not terminate the program; they report property outcomes and guide exploration. That makes them safe to place in workload code and, when useful, production code paths. Outside Antithesis, SDKs are designed for minimal overhead and many languages support build-time or runtime disable modes.

For every property, explicitly note which assertion type should implement it and why:

- **`Always`**: Use for safety and correctness invariants that must hold every time the check runs. Example: "an acknowledged write is never lost once committed."
- **`AlwaysOrUnreachable`**: Use for invariants on optional, rare, or workload-dependent paths where "never executed" is acceptable but any execution must satisfy the invariant. Example: "if a follower serves a stale-read fast path, its read timestamp is still safe."
- **`Sometimes`**: Use for liveness/progress properties and for meaningful-state reachability. Choose it when the condition should become true at least once during a run, or when hitting that situation proves the workload is exercising an important scenario. Example: "leader election completes," "a rollback path is exercised," or "the workload reaches a degraded-but-recoverable mode." Do not use `Sometimes` for invariants that must hold on every evaluation.
- **`Reachable`**: Use for pure reachability goals where the fact of hitting a code path or behavior matters more than checking a rich predicate. Example: "the compaction path is exercised at least once."
- **`Unreachable`**: Use for impossible states and critical failure paths that must never be observed. Example: "the data-corruption guardrail trips" or "an internal panic recovery path is entered."

`Sometimes` assertions deserve extra attention in the catalog. They are more informative than generic line coverage because they can describe interesting situations, not just locations, and Antithesis uses them as exploration hints and replay checkpoints. Add them when you want to confirm the workload reaches rare, tricky, or high-value scenarios.

If a property seems to fit multiple assertion types, prefer the one that matches the real guarantee:

- "Must never happen" -> `Always` or `Unreachable`
- "Must eventually happen at least once" -> `Sometimes` or `Reachable`
- "Must hold whenever this optional path runs" -> `AlwaysOrUnreachable`

## How Many Properties

Aim for at least 15 properties. Enough to be comprehensive, not so many that the catalog is overwhelming. Group related properties together. Start with high impact properties.

## Organizing the Catalog

Organize properties into categories based on system architecture. Common categories:

- Data integrity under faults
- Read correctness
- Control plane behavior
- Configuration changes under load
- Edge cases and boundary conditions

Each category should have a brief description explaining what area of the system it covers and why it matters.

## Output

Write the catalog to `antithesis/scratchbook/property-catalog.md`.
