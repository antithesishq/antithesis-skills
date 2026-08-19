# Sweep and Verdicts

## Goal

Launch the mutants, read what came back, and turn each survivor into a specific
defect with a specific fix — not into "the property missed it."

## Before launching

The baseline gate in `SKILL.md` must already be satisfied: a green baseline at
the current `base_tree`, recorded in `status.md`. The sweep launches **mutants
only**.

Every mutant image must have been verified locally first
(`mutation-harness.md`, "Verify before launching"). A run spent on an unpatched
build produces a survivor that means nothing and costs a full duration to
discover.

## Map slugs to property names first

Verdicts are keyed by catalog slug (`acked-writes-survive`), but
`snouty runs --json properties` reports the assertion's **message string** as
`name`. Build the mapping once, before the sweep, from the catalog's
**Invariant** field and `antithesis/scratchbook/existing-assertions.md`, and
record it in `status.md` next to each mutant. A reconstructed catalog produces
this mapping as a byproduct of its join (`catalog-reconstruction.md`) — record it
there rather than rebuilding it here.

Without it, "did the targeted property fire?" — the question the whole ladder
rests on — becomes a guess. The marker is the one case where the mapping is
free: its `[{mutant-id}]` prefix means
`snouty runs --json properties --name "[m04-duplicate-term-ge]" "$RUN_ID"`
finds it directly.

`--name` is a case-insensitive **substring** match, so one message that is a
prefix of another returns both. Confirm the filtered result is a single property
whose name matches exactly before reading a verdict off it.

## Launching

Use the `antithesis-launch` skill for every run. Do not call `snouty launch`
directly. Supply these explicitly; a calling skill's parameters take precedence
over that skill's defaults.

**Point it at the fork.** `--config "$FORK/$CONFIG"` — the mutated
compose lives in the fork, and the launch skill would otherwise discover the
user's real `antithesis/config` and launch the unmutated system.

**Put the fork in that mutant's state immediately before launching**, with
`select-mutant.sh <id> --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"`
(see `mutation-harness.md`, "Paths" and "Select before building and before
launching").

Then, per run — all five are required:

- `--duration 15` — the practical floor; project the schedule from the baseline's measured wall clock in `status.md`, not the interview's rule of thumb
- `--source mutation-testing:{mutant-id}` — gives each mutant its own property-history lineage
- `--ephemeral` — keeps deliberately-failing properties out of future reports as historic results
- `--test-name` — the repo name plus the mutant id
- `--description "[mutant {id} → {property-slug}] <what changed since last time>"`

### Concurrency

**Submissions are serialized; runs are not.** The rule is about the fork, not
about mutants: **exactly one process may touch `$FORK` at a time, and it stays
held from `select-mutant.sh` until `snouty launch` returns a run id.**
`build-mutants.sh`, `verify-mutant.sh`, `fork.sh`, `sync-patches.sh`, the
authoring loop, and `clean.sh` all write to the fork as well — the guidance to
run builds and polling in the background applies to *runs* in flight, and none
of those may overlap a held fork.

The window is longer than it looks. `antithesis-launch` runs `compose build`,
then a full `snouty validate` bring-up, then submits; on a multi-node SUT that
is minutes, not a cache hit and a push.

Getting it wrong is not merely a mix-up between two mutants. Mid-select the fork
holds mutated source under the *user's own* image tags, so a build landing there
produces a mutated image under a tag snouty will push to their real registry.
So:

```
for each mutant:            # strictly one at a time
  select-mutant.sh <id> --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"
  antithesis-launch ...     # build (cache hit) + push + submit
  record the run id
                            # only now move to the next mutant
```

The concurrency limit agreed in the interview governs how many **runs may be in
flight**, not how many launches may overlap. If the sweep is larger than the
limit, submit up to the limit and submit each remaining mutant as an earlier run
finishes. A sweep that ignores the limit can starve the user's real testing for
hours.

Write each run id into `status.md` as it comes back, before launching the next —
a sweep that loses its session must be resumable by polling, not by relaunching.

## Polling

Runs are long. Poll in a background loop rather than blocking:

```sh
snouty runs --json show "$RUN_ID" | jq -r '.status'
```

A run is finished once `status` is anything other than `starting` or
`in_progress`. Triage each run as it lands rather than waiting for the whole
batch.

## Gates

Check these before judging any individual mutant.

| Evidence | Diagnosis | Action |
| --- | --- | --- |
| Announcement missing in local validate | Wrong or unpatched build | Caught **pre-launch**; no run budget spent. Rebuild and re-verify |
| Baseline red on a safety property | — | **Stop.** The batch cannot be interpreted: a property that was already failing tells you nothing about your mutant. Report the failures and route to `antithesis-workload` or `antithesis-research` |
| Run did not finish normally — `status` is `incomplete`, `cancelled`, or `unknown`, or `links.triage_report` is null in `snouty runs --json show` | **No result** | Not a survivor. The properties and logs endpoints return 404 for these runs (`antithesis-triage`, `SKILL.md`), so the target's silence is missing data, not evidence. Re-launch the mutant. If it fails the same way twice, diagnose it with the incomplete-run workflow — `failure_moment` plus `build-logs` — before spending another run, and record *outstanding* if it cannot be resolved |

A baseline that goes red after a round of fixes stops the loop the same way, in
both workflows.

## The verdict ladder

For each mutant, in this order. The first questions are cheap and decide most
cases.

**This table yields a *diagnosis*, not one of the five report verdicts.** The
diagnosis says which link of the kill chain broke and what to do about it; the
verdict is what `report.md` records for the property once the round settles:

| Diagnosis | Verdict it becomes |
| --- | --- |
| falsified | *falsified* |
| bad oracle, bad workload, bad mutant, rarity, off-target, too broad, too blatant | not terminal — fix and re-run. Becomes *falsified* once a re-sweep kills it, or *outstanding* if the round ends or the attempt cap is reached first |
| dominated | *outstanding — dominated*, with the dominating property named. Domination makes the target redundant, not validated; retiring it is a catalog decision for `antithesis-research`, not one this sweep makes |
| pre-existing failure | not a verdict — the mutant got no result. Report the failure, then re-run the mutant; *outstanding* if it cannot be separated from the bug |
| unattributed | not terminal — attribute it, or re-run. Becomes *outstanding — unattributed* if neither succeeds |
| bad property | *withdrawn*, or *refined* if the entry is corrected and kept |
| wrong image launched, uncataloged marker | not a verdict — re-run, or record *outstanding — not cataloged* if it cannot be resolved |

| Evidence | Diagnosis | Action |
| --- | --- | --- |
| Announcement missing from the run's events | Wrong image launched | **Check this first, on every run**: `snouty runs events "$RUN_ID" "ANTITHESIS MUTANT ACTIVE: {id}"`. Pre-launch verification says nothing about what the launch's own rebuild produced, or about anything that touched the fork since. One cheap call, and the only row that catches a run of unmutated or wrong-mutant code — every verdict below is meaningless without it. Events are a sample rather than the whole stream, so a missing announcement is not proof the image was wrong; the error direction is safe, since it costs a re-run rather than a false falsification. Not a verdict; check the launch used the fork's config, then re-run |
| Marker absent from the property list entirely | Uncataloged marker | Not a verdict. The assertion was never cataloged (fallback SDK, or an artifact outside the catalog set). Read the marker straight from the run's events instead: `snouty runs events "$RUN_ID" "<marker text>"` — see `mutant-design.md` |
| Marker red, but the target went red anyway | **pre-existing failure** | The divergence never happened, so the mutant did not cause this — it is a real bug the baseline's search missed, or a fault-induced failure. **Do not read it as reach evidence and do not touch the workload.** Triage it as a genuine finding and report it to the user; the mutant itself has no result yet. Re-run the mutant once the failure is understood, and record *outstanding* if the two cannot be separated |
| Marker red, and nothing reaches the **mutated site** — the mutant's kill-chain trace names no workload action that drives execution there, or a site-entry marker is red too | **bad workload** | Confirm before editing anything: no reach in one 15-minute randomized run is a sample, not proof of unreachability. Re-run the baseline longer first — the same bar the rarity row below gets, and this is the row that edits the user's tree. If nothing reaches the site, extend the workload with the action or fault that does, per interview question 4; re-baseline and re-sweep |
| Marker red, but the mutated site **is** reached — the workload drives execution there and only the divergence condition failed to occur | rarity, not a gap | The path is reachable, so the search simply didn't hit the case in 15 minutes. Re-run this mutant alone at 30 or 60 minutes before concluding anything. `base_tree` is unchanged, so the source is identical — but a longer run is a *larger search*, and finding a pre-existing rare bug is exactly what more search buys. A kill that appears only at the longer duration must be checked against a baseline re-run at that same duration before it is credited |
| The mutant reddened much of the catalog at once | too broad | The target's failure is not attributable: one root cause tripped everything downstream. Narrow the mutant and re-run; do not credit the target or the collateral |
| Marker green, target red, **the marker fired in the history the target's counterexample came from**, and the evidence matches the predicted reason | **falsified** | Record it. Credit any incidental falsification that passes the collateral test below |
| Marker green, target red, the marker is in the counterexample's history, but the log shows a **different mechanism** than the trace predicted | re-read before crediting | A prediction is a hypothesis, not a gate. If the log shows the mutant's divergence caused the failure by a route the trace got wrong, it is a **falsified** — credit it and correct the chain in the mutant's evidence file, since the same wrong assumption is probably in the other traces too. If the mechanism has nothing to do with the divergence, the marker's presence is a coincidence: treat it as **unattributed** |
| Marker green, target red, but no counterexample history carries the marker | **unattributed** | Both counts are run-wide totals, so these may be different histories. Not a falsification — see "Attributing a falsification" below |
| Marker green, target green, another property red | off-target or dominated | Either the mutant is too broad — narrow it — or the target is genuinely dominated by the property that fired — which needs an argument that the target cannot be violated without the other firing, recorded in `property-relationships.md`. Domination makes the target redundant, not validated, and never yields *falsified* |
| Marker green, divergence masked or converged before observation | **bad mutant** | The bug ran but was erased before anything could see it. Choose a different mistake for the same property |
| Marker green, divergence reaches the assertion but the predicate tolerates it | **bad oracle** | The catalog has a hole and the mutant found it. Tighten, re-key, or relocate the assertion per `antithesis-workload`'s `references/assertions.md` and interview question 4; re-baseline and re-sweep |
| No observation point could ever distinguish a violation | **bad property** | Per the interview: stop and route to `antithesis-research`, or refine/withdraw and continue |
| `setup_complete` never reached, or a container crashes deterministically on startup | too blatant | The mutant broke the system rather than the property. Narrow it to produce the targeted divergence without the crash. **A container exiting mid-run is not this row** — Antithesis injects container kill and stop faults and restarts the container afterwards (`antithesis-triage`, `references/logs.md`), so exits are routine and say nothing about the mutant |

**Reach is a fact about the mutated site, not about the target.** The two
marker-red rows above ask whether execution got to the *mutation*, which is a
different location from the assertion it targets. Do not substitute the target's
`example_count` for that: an assertion can be evaluated constantly while the
branch the mutant edits is never taken, and for an `Unreachable` property
`example_count` 0 is its *healthy* state (see SKILL.md, "Scope"), so reading
zero examples as a workload gap would send you to rewrite the user's workload
until an `Unreachable` becomes reachable — the opposite of what that property
asserts. Where the divergence marker cannot be placed conditionally, the mutant's
evidence file already records that it proves reach but not divergence
(`mutant-design.md`); a marker-red result there means the *site* was never
entered, which is the `bad workload` row.

## Attributing a falsification

`example_count` and `counterexample_count` are totals **across every history in
the run** (`antithesis-triage`, `references/properties.md`). "Marker green" and
"target red" can therefore describe histories that never met: the mutant ran in
forty histories where nothing failed, and the property failed in a forty-first
where the mutant's branch was never taken. That is not a falsification, and
nothing about the two counts distinguishes it from one.

So the target gets the same test the collateral properties get: **take the
target's counterexample moment and confirm the mutant's marker fired in that
history, before it.**

The check that settles it is the counterexample's own log. `snouty runs --json
logs` streams *the history up to that moment* (`antithesis-triage`,
`references/logs.md`), so a marker inside that stream is by construction in the
same history and earlier than the failure:

```sh
# INPUT_HASH and VTIME come verbatim from the property's counterexamples array
snouty runs --json logs "$RUN_ID" "$INPUT_HASH" "$VTIME" > "$LOG"
grep -c "<marker text>" "$LOG"
```

Do not try to establish this by comparing moment identifiers between a
`snouty runs events` hit and a counterexample: what makes two moments the same
history is not something the ladder should be guessing at. Download the log.

If the marker is absent from the counterexample's own history, the diagnosis is
*unattributed*, not *falsified*.

This matters because the mutant is not the only thing that can redden a
property. Every run injects faults, and the baseline is a different random
exploration — a real, rare, pre-existing bug the baseline's search missed will
surface eventually and look exactly like a kill. A prediction written in advance
makes triage faster, but it is a hypothesis to test, not a conclusion to
confirm: read the evidence for what it shows, not for what the trace said it
would.

Read logs before concluding. The property status alone does not tell you *why*
it failed, and "fired for the predicted reason" is the difference between a
falsification and a coincidence. Use the `antithesis-triage` skill's workflow
for downloading and reading counterexample logs.

## Crediting collateral damage

A mutant that breaks a real invariant usually trips several properties. A
property that fires as collateral **may** count as falsified, which reduces how
many runs the catalog needs — but the bar is evidence, not convenience.

The test, in order:

1. **Attribute it to the mutant, exactly as the target is attributed.** Download the collateral property's counterexample log and confirm the mutant's marker is in that history, before the failure. Skipping this credits a fault-induced or pre-existing failure as a kill — and collateral is where that is most likely, since it is the property nobody predicted would fail. No marker in that history, no credit.
2. Ask whether the collateral property ever fails **in a timeline where the target holds** — evaluated, and not violated. That is the only question separating an independent violation from one root cause cascading downstream, and "the target didn't fail" is not enough: a timeline where the target was never evaluated is the cascade case, not evidence against it. The `antithesis-query-logs` skill answers this, but it needs an authenticated `agent-browser`; where that is unavailable, the counterexample logs are what you have.
3. If both hold, credit it. If either fails, or you cannot establish it either way, do not — an unanswerable question is not a yes. Record it as expected collateral and leave the property needing its own mutant.

**Firing first is not evidence.** In a cascade the downstream property is often
observed *earlier* than the target — corrupted state trips a cheap invariant at
T and the expensive one at T+5 — so ordering credits exactly the case it should
exclude.

Never credit a property just because it went red. One broad mutant can cascade
through most of a catalog and produce a report claiming the whole thing is
validated when a single bug tripped everything downstream. The run-count saving
is real, and it is exactly the pressure this test exists to resist.

## Iterating

**Batch the fixes.** Classify every survivor in the round before changing
anything, then apply all the diagnosed fixes together. One re-sweep per round,
never one per fix.

**Every fix below that touches the user's tree is governed by interview question
4.** The *bad oracle* and *bad workload* rows send you into their real source. If
they answered propose-only, do not edit it: record the diff in `report.md` under
*Proposed fixes, not applied*, leave the property *outstanding*, and carry on
with the other mutants. Only mutant patches may be changed without asking.

**Then re-run under the two-branch rule:**

- **Only mutant patches changed** — `base_tree` is unchanged, so the recorded baseline stays valid. Rebuild and re-run just the changed mutants.
- **The SUT, workload, or assertions changed** — the fix lands in the user's real tree, so re-fork, and `base_tree` moves. The recorded baseline is invalid: establish a fresh one and re-sweep every mutant.

The fingerprint decides this, not your recollection of what you edited — but it
only decides correctly if the fork is regenerated after a real-tree fix. A stale
fork keeps the old `base_tree` and would silently re-measure the old oracle.

A full re-sweep after every round of core fixes is the dominant cost of this
skill. It is also the honest one: a verdict obtained against a different oracle
is not evidence about the current one.

## Terminating

Convergence means the baseline is green and every in-scope property carries one
of the five verdicts: *falsified* with verified evidence, *not mutatable*,
*refined*, *withdrawn* with a recorded reason, or *outstanding* with what is
blocking it. Nothing is left mid-diagnosis.

**The per-property attempt cap applies in both workflows** — default two
re-sweeps after the first. It is what stops a property being retried
indefinitely; the checkpointed workflow reports the cap being reached instead of
deciding alone.

The interview's run ceiling is the standing authorization; a round that would
exceed it stops (`SKILL.md`, opening interview). In the checkpointed workflow,
also present the verdict table and the proposed next batch at the end of each
round.

The autonomous workflow additionally terminates on:

- **Cap resolution without asking** — a property that survives the cap is recorded *outstanding — attempt cap reached*, with what was tried and what is unresolved. Reaching the cap means the sweep could not build a killing mutant in the attempts allowed; that is a fact about the sweep, not about the property, so it never justifies *withdrawn* unattended. Retire a claim only for the reason interview question 5 names: it is conceptually unfalsifiable, established by argument rather than by a spent budget
- **No-progress stop** — a round that falsifies nothing new and refines nothing ends the loop

Withdrawal is never silent, and never applies to a property that was merely
*not mutatable*. Mark the catalog entry withdrawn with its reason, refresh the
catalog's provenance frontmatter as `antithesis-research`'s
`references/property-catalog.md` requires, annotate the property's evidence file
rather than deleting it, and prefer refining to withdrawing. Leave the SDK
assertion in the code and list it in the report under *assertions with no
validated property* — withdrawing a catalog claim is a documentation change,
while deleting instrumentation from someone's source is not something to do
unattended.

## Do not game the loop

See `SKILL.md`, General Guidance. If a mutant and its assertion are both sound
but the kill is rare, make the prerequisite state *more frequent* — add an
action or a fault that drives it — rather than lowering the bar for a kill.
