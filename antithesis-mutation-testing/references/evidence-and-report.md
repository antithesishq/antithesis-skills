# Evidence and Report

## Goal

Leave behind a record that lets someone else confirm each property is
falsifiable without re-running anything — and that lets the next sweep pick up
where this one stopped.

Five artifacts, each with a different reader: `interview.md` and `status.md`
for a later session, `mutants/{id}.md` for whoever revisits a mutant, the
property's evidence file for whoever reads the catalog, and `report.md` for the
user. The first three are working state for this sweep; the `## Falsification`
section in the property's evidence file is what a later reader finds, so
anything that should outlive the sweep goes there.

## `interview.md`

What the user agreed to. Written once at the end of the opening interview,
before any run is spent, and updated whenever an answer changes. This is what a
later session reads to resume without re-asking — and the only record of what
the user authorized.

```markdown
# Mutation testing session

recorded: 2026-08-19 · updated: 2026-08-20

## Paths

| flag | value |
| --- | --- |
| `--source` | `/home/dev/myapp` |
| `--patches` | `/home/dev/myapp/antithesis/scratchbook/mutation-testing/patches` |
| `--images` | `/home/dev/myapp/antithesis/scratchbook/mutation-testing/images.txt` |
| `--fork` | `/home/dev/scratch/myapp-mutation-fork` |
| `--config` | `antithesis/config` (default; relative to the fork, not absolute) |
| `--exclude` | `target/`, `node_modules/` |

## Answers

| # | Question | Answer |
| --- | --- | --- |
| 1 | Fork location | `/home/dev/scratch/myapp-mutation-fork`; exclude `target/`, `node_modules/` |
| 2 | Budget and concurrency | ceiling **70 runs**; max **4** in flight |
| 3 | Rounds | autonomous |
| 4 | Changes to source | apply directly |
| 5 | On a bad property | refine in place, keep going |

## Scope

Agreed with the user before the baseline. 9 safety-class properties in scope.

| Property | Class | In scope | Why not |
| --- | --- | --- | --- |
| acked-writes-survive | Always | yes | — |
| wal-fsync-before-ack | Always | no | Postgres is not built from source here |
```

The run ceiling is here; runs **spent** against it are in `status.md`. Keeping
the agreement and the tally apart is what lets a resumed session say "9 of 70
spent" without reconciling two copies of either number.

## `status.md`

Sweep state. Written continuously, not at the end — a session that dies must be
resumable by polling recorded run ids rather than by relaunching.

**One writer only.** Every write is a read-modify-write of the whole file, and
the sweep polls runs in the background. A sub-agent or poller returns its result
to the orchestrator, which writes; it never edits this file itself. A lost write
drops a run id, an attempt count, or part of the budget tally — each silently
wrong rather than obviously broken.

```markdown
# Mutation testing status

base_tree: 4f1c9a2e8b3d5f7a1c6e9b2d4f8a3c5e7b9d1f2a
fork: /path/to/fork
budget: 9 runs spent (ceiling in interview.md) · 41m measured per run · 95s local setup
updated: 2026-08-20

## Baseline

| run_id | base_tree | verdict | wall clock | date |
| --- | --- | --- | --- | --- |
| f3a9c1... | 4f1c9a2e... | green | 41m | 2026-08-20 |

## Mutants

| mutant | target property | assertion name | marker | attempts | run_id | base_tree | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| m01-dropped-quorum-guard | acked-writes-survive | `acked write survives failover` | green | 1 | 7b2e44... | 4f1c9a2e... | falsified |
| m02-stale-read-window | reads-see-acked-writes | `read returns acked value` | red | 2 | 9c1f08... | 4f1c9a2e... | rarity — re-running at 30m |
| m03-index-regression | index-monotonic | `fsm index never regresses` | — | 0 | — | — | queued |
```

The **assertion name** column is the mapping from catalog slug to the `name`
`snouty runs --json properties` reports. Fill it in before the sweep; without
it, identifying "the targeted property" in a run is guesswork.

The **attempts** column counts how many times that property has been swept. The
per-property attempt cap (`sweep-and-verdicts.md`) is enforced against it, so a
session resuming a sweep honors the cap instead of restarting the count at zero.

The baseline row is valid only while its `base_tree` matches the fork's current
`mutation-base^{tree}`. That comparison decides whether an iteration needs a
full re-sweep or only the changed mutants — see `sweep-and-verdicts.md`.

Record `base_tree` on every verdict, not just the baseline. It is what tells a
later reader whether a falsification predates a change to the oracle it was
measured against.

## `mutants/{id}.md`

One file per mutant, named for the mutant id. Freeform markdown; cover:

- **Target property** — the catalog slug, and the assertion expected to kill it
- **The mistake** — what the correct code does, what the mutated code does, described rather than pasted as a diff (the patch is the diff)
- **Why it is subtle** — what makes this a plausible thing a developer would write, and what reachability prerequisite the bug needs to manifest
- **Announcement and marker** — where each sits; whether the marker is a `Reachable` assertion or a log record; and whether it proves divergence or only reach
- **Kill chain** — reach → diverge → propagate → fire, from `static-validation.md`
- **Predicted verdict** — which property should fire, and the collateral to expect
- **Actual verdict** — what the run showed, with the run id, and whether it matched the prediction
- **Rejected candidates** — other mutants considered for this property and why they were not wired

A mutant that survived carries the diagnosis and the fix applied, so a later
reader can see whether the eventual kill came from fixing the oracle, the
workload, or the mutant.

## `## Falsification` in the property's evidence file

Append a section to `antithesis/scratchbook/properties/{slug}.md`. These files
are explicitly freeform, so this needs no change to any format
`antithesis-research` owns — and it means anyone reading a property learns
whether it has ever been proven capable of failing.

```markdown
## Falsification

**Falsified** by `m01-dropped-quorum-guard` · run `7b2e44...` · 2026-08-20 ·
base_tree `4f1c9a2e...`

The mutant drops the quorum check on the acknowledgement path. The property
recorded 34 counterexamples against 1,102 examples. Attributed: the marker
`[m01-dropped-quorum-guard] ack accepted below quorum` appears in the
counterexample history `a9f3…` at vtime `12.4` — downloaded with
`snouty runs --json logs`, which streams that history up to the failure — and
the sampled counterexamples all show a leader partition in `active_faults`,
matching the predicted kill chain.

**Gap this exposed:** the original assertion compared against the attempted
write count rather than the acknowledged count, and did not fire until it was
re-keyed. See the assertion change in `src/replication/ack.go`.
```

Use the same section for the other outcomes: **not mutatable**, **withdrawn**,
or **outstanding**, each with its reason.

Keep the section rather than replacing it on a later sweep — append a dated
entry. A property falsified, then broken by a refactor, then falsified again is
exactly the history a reader wants.

These notes do not disturb a sweep in flight. `fork.sh` excludes the
scratchbook, so editing it leaves `base_tree` — and the recorded baseline —
intact (see `mutation-harness.md`).

## `report.md`

The deliverable. Lead with the table; the reader wants the whole catalog's
status at a glance.

```markdown
# Mutation testing report

base_tree: 4f1c9a2e... · baseline run `f3a9c1...` (green) · 2026-08-20

**3 of 12 in-scope properties were falsified.** Lead with that count — a table of
mixed verdicts reads as "accounted for" at a glance whether or not much was
proven.

| Property | Class | Verdict | Mutant | Run | base_tree |
| --- | --- | --- | --- | --- | --- |
| acked-writes-survive | Always | falsified | m01-dropped-quorum-guard | `7b2e44...` | `4f1c9a2e...` |
| no-split-brain | Unreachable | falsified (collateral, verified) | m01-dropped-quorum-guard | `7b2e44...` | `4f1c9a2e...` |
| reads-see-acked-writes | Always | falsified | m02-stale-read-window | `9c1f08...` | `4f1c9a2e...` |
| wal-fsync-before-ack | Always | not mutatable — Postgres not built here | — | — | — |
| snapshot-consistent | Always | outstanding — attempt cap reached | m06-snapshot-skew | `6a4e02...` | `4f1c9a2e...` |
| config-change-safe | Always | withdrawn — unfalsifiable | m05-config-race | `2d8b71...` | `4f1c9a2e...` |
```

Then, per category:

- **Falsified** — one line each on how it was falsified, with the evidence tying the mutant's marker to the property's counterexample history, and whether anything had to be fixed first. Gaps the sweep closed belong here; they are the concrete value the sweep produced
- **Falsified after refinement** — properties whose assertion was rewritten during the sweep and then killed by the mutant that motivated the rewrite. Kept separate because the kill is circular: it shows the new assertion catches this bug, not that the original claim was sound
- **Refined** — properties whose catalog entry was corrected rather than retired, with what changed
- **Proposed fixes, not applied** — when interview question 4 said propose-only: the diff for each assertion or workload change the sweep found, and the property it leaves outstanding
- **Properties with no callsite** — run properties that are not known platform telemetry and that no assertion in the source accounts for (see `catalog-reconstruction.md`); the user needs to say whether each is theirs. Not to be confused with *outstanding — unattributed*, which is a swept property whose kill could not be tied to its mutant's marker
- **Not mutatable** — properties owned by components not built from source here. A fact about the harness, not a defect in the property
- **Outstanding** — what is blocking each, and what would unblock it
- **Withdrawn** — the reason, and where it was routed
- **Passed on the baseline, not mutated** — the `Reachable` and `Sometimes` properties. For `Reachable`, passing *is* the whole claim. For `Sometimes` it is not: a green `Sometimes` shows the condition held once, and says nothing about whether the property would notice the system ceasing to achieve it. Do not present these as validated
- **Catalog observations** — `Sometimes` conditions that look trivially satisfiable, with the suggested `Reachable(...)` rewrite for the user to decide on
- **Assertions with no validated property** — SDK assertions left in the code behind withdrawn properties
- **Fixes applied** — assertion, workload, and catalog changes made during the sweep, so the user can review them as a set

Reference runs by **run id**, not by pasting a triage report URL: those URLs are
signed and expire. Tell the reader to open one with
`snouty runs show <run_id> --web`.

Close with what the report does *not* establish — properties never mutated and
why, paths the workload still does not reach, and any mutant whose marker proved
reach but not divergence. A mutation report that reads as unqualified validation
is overclaiming; the honest boundary is part of the deliverable.

If the catalog was reconstructed (`catalog-reconstruction.md`), say so at the top
and say what follows from it: the sweep validated the assertions that existed,
and says nothing about properties nobody asserted. Recommend an
`antithesis-research` pass for that half.
