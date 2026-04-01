# Property Catalog

## Provenance

The property catalog is a snapshot — it reflects the codebase at the time of analysis. Record this provenance as YAML frontmatter at the very beginning of the output file, before any heading. This lets downstream consumers know what state the catalog reflects.

```yaml
---
commit: <full git SHA of the codebase at time of analysis>
updated: <ISO 8601 date of the analysis>
---
```

- **`commit`**: The HEAD commit of the target repository when the catalog was generated or last updated. Use the full 40-character SHA.
- **`updated`**: The date the catalog was written or last updated. ISO 8601 format (`YYYY-MM-DD`).

When updating an existing catalog (adding properties, revising after triage), update both fields to reflect the current codebase state.

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

Each property has a unique **slug** — a descriptive, kebab-case identifier (e.g., `acked-writes-survive`, `no-split-brain`). The slug is the canonical ID for the property, used as the catalog heading, the evidence filename (`properties/{slug}.md`), and the identifier in the property relationships file.

For each property, document:

```
### [slug] — [Property Name]

| | |
|---|---|
| **Type** | Safety / Liveness / Reachability |
| **Property** | One sentence: what guarantee are we testing? |
| **Invariant** | What Antithesis SDK assertion(s)? Be specific about what is checked and how. Include why that assertion type matches the property semantics. |
| **Antithesis Angle** | How does fault injection interact with this? What timing/interleaving does it explore? |
| **Why It Matters** | Real-world impact. Link to issues if applicable. |
```

For every property in the catalog, write a corresponding evidence file at `properties/{slug}.md`. See the "Evidence Files" section below.

## Choosing the Right Antithesis Assertion

Antithesis assertions are not traditional crash-on-failure assertions. Failed Antithesis assertions do not terminate the program; they report property outcomes and guide exploration. That makes them safe to place in workload code and, when useful, production code paths. Outside Antithesis, SDKs are designed for minimal overhead and many languages support build-time or runtime disable modes.

For every property, explicitly note which assertion type should implement it and why:

- **`Always`**: Use for safety and correctness invariants that must hold every time the check runs. Example: "an acknowledged write is never lost once committed."
- **`AlwaysOrUnreachable`**: Use for invariants on optional, rare, or workload-dependent paths where "never executed" is acceptable but any execution must satisfy the invariant. Example: "if a follower serves a stale-read fast path, its read timestamp is still safe."
- **`Sometimes(cond)`**: Use for liveness/progress properties and for non-trivial semantic states that should become true at least once during a run. The condition must itself be meaningful. Example: "leader election completes" or "a degraded-but-recoverable mode is observed." Do not use `Sometimes` for invariants that must hold on every evaluation, and treat `Sometimes(true, ...)` as a smell that should instead be `Reachable(...)`.
- **`Reachable`**: Use for pure reachability goals where the fact of hitting a code path, branch result, or outcome helps Antithesis focus on interesting areas of the code to search. Prefer meaningful outcomes over broad path-entry markers. Example: "snapshot completed successfully" or "the compaction path emitted its no-op result."
- **`Unreachable`**: Use for impossible states and critical failure paths that must never be observed. Example: "the data-corruption guardrail trips" or "an internal panic recovery path is entered."

`Sometimes(cond)` assertions deserve extra attention in the catalog. They are more informative than generic line coverage because they can describe interesting situations, not just locations, and Antithesis uses them as exploration hints and replay checkpoints. Add them when you want to confirm the system reaches rare, tricky, or high-value semantic states.

When a state is dangerous, timing-sensitive, hard to observe externally, or useful as a branch or replay anchor, record that the property likely needs SUT-side instrumentation rather than workload-only checks.

Every planned assertion message must be unique and specific. Do not model a broad property by reusing one assertion message at multiple unrelated callsites; split it into distinct properties or explicit sub-properties instead.

If a property seems to fit multiple assertion types, prefer the one that matches the real guarantee:

- "Must always or never happen" -> `Always` or `Unreachable`
- "Must eventually happen at least once because a meaningful condition becomes true" -> `Sometimes(cond)`
- "Must eventually hit this line" -> `Reachable`
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

## Coverage Verification

After the catalog is complete, cross-reference it against the SUT analysis.
The property discovery process uses attention focuses that may not cover
every area identified during SUT discovery. Common gaps include:

- Features that interact with multiple subsystems (e.g., caching + replication,
  authentication + session management, storage + garbage collection)
- Areas identified in bug history that didn't map cleanly to a single
  property discovery focus
- Operational scenarios (migration, upgrade, format conversion, failover)
  that span lifecycle transitions
- Optional or configurable features that change system behavior in ways
  the default-path analysis didn't explore

A quick pass comparing SUT analysis sections against catalog categories
catches these gaps before they become blind spots in testing.

## Evidence Files

Every property in the catalog must have a corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md`. These files capture the context and reasoning behind each property — information that would otherwise be lost when findings are compressed into catalog entries.

Evidence files are freeform markdown. Write whatever context would help a future reader understand why this property was identified and what code is involved. Typical content includes:

- What led to identifying this property (code patterns, bug history, claimed guarantees, documentation)
- Specific files and functions involved in the property
- What goes wrong if the property is violated
- Anything that would be expensive to rediscover (timing windows, configuration dependencies, subtle interactions)

When you encounter questions you can't answer within the scope of discovery, include them in the evidence file — but don't just state the question. Capture why the question matters and what changes depending on the answer. For example, don't write "Does `fsmRestore()` enforce monotonicity?" Write "Does `fsmRestore()` enforce monotonicity? If not, a crash between `db.Swap()` and `fsmIdx.Store()` could cause index regression, which means the invariant statement needs to account for the restore path. If yes, the property is stronger than stated and the instrumentation can be simpler." A downstream investigator who reads this knows what to look for and how to update the property based on what they find.

The goal is to preserve what you already know from your analysis. Don't do additional deep research for the evidence file — capture what you learned during discovery.

## Output

Write the catalog to `antithesis/scratchbook/property-catalog.md`. Include the provenance frontmatter (see "Provenance" section above).
Write per-property evidence files to `antithesis/scratchbook/properties/{slug}.md`.
Write the property relationships to `antithesis/scratchbook/property-relationships.md`.
