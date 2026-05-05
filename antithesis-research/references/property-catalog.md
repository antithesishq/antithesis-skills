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

**Open Questions:**

- Bullet list of unresolved questions about this property, or "None" if no questions remain. See "Open Questions Conventions" below for state tags and rules.
```

For every property in the catalog, write a corresponding evidence file at `properties/{slug}.md`. See the "Evidence Files" section below.

## Honest Summaries

A property's catalog entry — its prose fields *and* its Open Questions list together — is the honest summary of what the analysis knows. The fields describe what the property is and why; the Open Questions list describes what's uncertain about it. Both parts do work. Don't overload one to compensate for the other.

In particular, don't write a firm claim in **Property**, **Invariant**, **Antithesis Angle**, or **Why It Matters** that the Open Questions list contradicts. That's internally inconsistent, and a reviewer who notices will distrust the rest of the catalog. The fix is to write the prose at the level of generality the analysis actually supports — not to stuff parenthetical hedges into the field. If a key term in the property's prose has an unresolved meaning, the term can stay; the question goes in the Open Questions list and the reader knows to treat the term parametrically.

The assertion type in **Invariant** (`Always`, `Sometimes(cond)`, etc.) is the one place where there's no parametric option: it's a discrete commitment. If you can't decide between two assertion types, the property isn't ready for the catalog — pick one (using "Choosing the Right Antithesis Assertion" below) or split into two properties.

**Example.** The analysis identified an open question about what "acknowledged" means in this codebase but pinned down everything else about the property.

Bad — the catalog entry hides the uncertainty. The reviewer sees a firm claim and assumes a specific definition of "acknowledged" that the analysis didn't actually verify:

```
| **Property** | Acknowledged writes survive leader failover. |

**Open Questions:**

- None
```

Good — same prose, but the Open Questions list does the honest work. The reader sees that "acknowledged" is contested and treats the property's claim parametrically:

```
| **Property** | Acknowledged writes survive leader failover. |

**Open Questions:**

- What does "acknowledged" mean in this codebase — fsync'd to leader, or replicated to quorum? `(needs human input)`
```

The Property prose is identical in both. The honest summary is the entry as a whole, including the list.

## Open Questions Conventions

The Open Questions list under each property gives a reviewer scanning the catalog at-a-glance signal for which properties have unresolved uncertainty. It complements the evidence file; it does not replace it.

- **Summary, not verbatim:** each bullet is a short summary of one unresolved question. The full "why it matters / what changes depending on the answer" context lives in the evidence file (see "Evidence Files" below). The list points at the evidence file; it doesn't duplicate it.
- **State tags:** tags describe how much investigation has happened — not what kind of question it is. Different kinds of questions deserve different follow-up (some need code reading, some need a stakeholder), but the list tracks status only.
  - No tag — not yet investigated. This is the default at discovery output time.
  - `(partial: <one-line summary>)` — investigation produced some findings but the core question remains open. Example: `(partial: confirmed write path uses fsync, replication path still unclear)`.
  - `(needs human input)` — investigation completed and the question can't be resolved without information from a human (project owner, domain expert, etc.). The evidence file's investigation log records what was examined and what's missing.
- **Exhaust investigation before tagging `(needs human input)`:** the tag means "I tried, the code/docs don't have the answer." The self-review criterion in `SKILL.md` requires the evidence file's investigation log to back this up. Skipping investigation and immediately tagging gets caught at review.
- **Resolved questions drop out:** once a question is answered, remove it from the list. If the answer changes the property — different invariant, different assertion type, different scope — update the affected catalog fields accordingly. Even if the prose was already written parametrically (per "Honest Summaries"), the resolution often makes specific terms more precise; revise the prose if the new precision changes what the field claims.
- **Priority is independent of open questions:** a high-priority property may have many open questions; a low-priority property may have none. Open Questions surface uncertainty about a property's claims; they don't lower its value. Don't deprioritize a property because its Open Questions list is busy.
- **Per-property vs. catalog-wide:** this list is per-property — it holds questions about a specific property's claims. Catalog-wide questions (about the analysis itself, the deployment topology, the scope of testing) belong under the file-level `Open Questions` heading per `references/scratchbook-setup.md`.

Example of a populated list (one bullet per state — untagged, partial, needs-human-input):

```
**Open Questions:**

- Does the snapshot path retry on a partial write, or surface the error?
- Is the post-restart index always monotonic? `(partial: confirmed for clean shutdown, crash path unclear)`
- What does "acknowledged" mean in this codebase — fsync'd to leader, or replicated to quorum? `(needs human input)`
```

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

## Evidence Files

Every property in the catalog must have a corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md`. These files capture the context and reasoning behind each property — information that would otherwise be lost when findings are compressed into catalog entries.

Evidence files are freeform markdown. Write whatever context would help a future reader understand why this property was identified and what code is involved. Typical content includes:

- What led to identifying this property (code patterns, bug history, claimed guarantees, documentation)
- Specific files and functions involved in the property
- What goes wrong if the property is violated
- Anything that would be expensive to rediscover (timing windows, configuration dependencies, subtle interactions)

When you encounter questions you can't answer within the scope of discovery, include them in the evidence file — but don't just state the question. Capture why the question matters and what changes depending on the answer. For example, don't write "Does `fsmRestore()` enforce monotonicity?" Write "Does `fsmRestore()` enforce monotonicity? If not, a crash between `db.Swap()` and `fsmIdx.Store()` could cause index regression, which means the invariant statement needs to account for the restore path. If yes, the property is stronger than stated and the instrumentation can be simpler." A downstream investigator who reads this knows what to look for and how to update the property based on what they find.

The goal is to preserve what you already know from your analysis. Don't do additional deep research for the evidence file — capture what you learned during discovery.

### Investigation Log

When an open question is investigated (per "Investigate Open Questions" in `references/property-discovery.md`), record what was examined under an `### Investigation Log` heading at the bottom of the evidence file. Use one `####` sub-heading per question (verbatim or close-paraphrase of the question text), with the body recording what was examined, found, and not found:

```
### Investigation Log

#### What does "acknowledged" mean — fsync'd to leader, or replicated to quorum?

- Examined: `internal/replication/leader.go`, `internal/wal/sync.go`, README "Durability" section, issue #482.
- Found: leader writes to local WAL with fsync before responding; replication is async by default.
- Not found: whether `--sync-replicate` flag changes the response point. The flag is referenced in tests but its semantics aren't documented.
- Conclusion: tagged `(needs human input)` — owner needs to confirm intended behavior under `--sync-replicate`.
```

A few rules for the log:

- **Persistence.** Log entries stay in the evidence file after the question resolves — they are audit trail, not working memory. They prove the criterion was met. A future reviewer or a re-investigation pass can read them.
- **Multi-pass investigation.** If a question is re-investigated (e.g., during evaluation refinement or post-triage iteration), append a new section under the same `####` heading rather than rewriting. Date or context the new entry so the sequence is clear.
- **Required vs. illustrative fields.** The Examined / Found / Not found / Conclusion structure is the recommended template; deviate when the question doesn't fit. The reviewer's bar is "I can tell what was tried and what was missing," not "I can tick four labeled fields."

This makes the "attempted" check in `SKILL.md` self-review verifiable: a reviewer can confirm that each `(partial: ...)` or `(needs human input)` tag has a real investigation behind it.

## Output

Write the catalog to `antithesis/scratchbook/property-catalog.md`. Include the provenance frontmatter (see "Provenance" section above).
Write per-property evidence files to `antithesis/scratchbook/properties/{slug}.md`.
Write the property relationships to `antithesis/scratchbook/property-relationships.md`.
