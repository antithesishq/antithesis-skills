---
name: antithesis-mutation-testing
description: >
  Validate that an Antithesis property catalog can actually catch bugs. For
  each safety property, inject one realistic mutant into the SUT, run it, and
  confirm the targeted property fires. Diagnoses survivors as a bad mutant, bad
  oracle, bad workload, or bad property, and routes fixes back to
  antithesis-workload or antithesis-research. Use once the harness is built and
  a baseline run is green.
compatibility: Requires the `docker-compose` binary (Docker Compose v2), which snouty execs directly; `podman compose` is not supported, though podman as the container runtime behind `DOCKER_HOST` is fine. Also requires snouty (https://github.com/antithesishq/snouty), jq, git, and rsync. Crediting collateral damage additionally needs the antithesis-query-logs skill and its authenticated agent-browser; without it, credit only what the counterexample logs can establish.
---

# Antithesis Mutation Testing

## Purpose and Goal

Validate the *oracle*, not the system under test.

A green run shows nothing bad was observed — not that the property would have
noticed. Mutation testing removes that ambiguity: for each property, inject one
realistic bug designed to break exactly that property, run it under Antithesis,
and confirm the property fires.

Success means:

- Every in-scope property is falsified by a mutant, or carries one of the other four verdicts: *not mutatable*, *outstanding*, *withdrawn*, or *refined* (see `references/evidence-and-report.md`, "Verdicts and qualifiers")
- Each falsification is backed by a run whose evidence shows the property failed for the predicted reason, not as collateral from an unrelated cascade
- Bad oracles and workload gaps found along the way are fixed; bad properties are routed back to `antithesis-research`
- `antithesis/scratchbook/mutation-testing/report.md` records the outcome for every in-scope property, with the run that proves it
- The user's working tree carries no mutation — every mutant lives in the fork, and `clean.sh` confirms it. Authorized fixes may land there; a mutation never does

Use the `antithesis-research` skill to build the property catalog, the
`antithesis-setup` skill to scaffold the harness, and the `antithesis-workload`
skill to implement assertions and test commands. Use the `antithesis-launch`
skill to submit runs — do not run `snouty launch` directly. Use the
`antithesis-triage` skill to read results.

## Prerequisites

- If the Antithesis scratchbook (usually `antithesis/scratchbook/`) is missing, or has fallen behind the assertions in the code, reconstruct a catalog from those assertions plus the baseline run — see `references/catalog-reconstruction.md`. This is not a blocker; it does narrow what the sweep can claim.
- DO NOT PROCEED if the Antithesis config directory contains a `manifests/` subdirectory. Kubernetes harnesses are not supported yet: mutant selection works by building one image per mutant and swapping the tag in `docker-compose.yaml`. Tell the user this and stop. Check this **before** the compose check below — a Kubernetes harness has no `docker-compose.yaml`.
- DO NOT PROCEED if there is no `docker-compose.yaml` for Antithesis and no `manifests/` directory either. Use the `antithesis-setup` skill to create the compose harness.
- DO NOT PROCEED if the SUT and workload contain no Antithesis SDK assertions at all. Use the `antithesis-workload` skill first — there is no oracle to validate, and a reconstruction cannot stand in for this one.
- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if no SUT service is built from source in this repo. A *partial* case — some services built from source, some prebuilt — is fine, and is handled by scoping (below).

### The baseline gate

**A green baseline at the current code state is required before any mutant is
designed.** Mutation testing on a buggy SUT measures nothing: you cannot tell a
property that fired because of your mutant from one that was already failing.

**Green means:** every safety-class property (`Always`, `AlwaysOrUnreachable`,
`Unreachable`) passes.

Separately, check which of the properties you intend to mutate actually appear
in the run's property list. **This needs the catalog-slug to property-name
mapping** — a run reports the assertion's *message string* as `name`, not your
slug — so build it now, per `references/sweep-and-verdicts.md`, "Map slugs to
property names first". An assertion Antithesis never cataloged cannot be
falsified; this does **not** fail the gate. Scope each missing one out as
*outstanding — not cataloged* and continue with the rest
(`references/catalog-reconstruction.md` diagnoses why it is missing) — except on
a fallback-SDK or JavaScript service, where absence means only "not hit in this
run": mutate those like any other, reading the marker from run events
(`references/catalog-reconstruction.md`, the join table). Only if
*none* of them appear is the harness broken rather than incomplete: stop and
report that.

Check the instrumentation signals too — `Software was instrumented`, `Symbols
were uploaded`, `Thread pausing was enabled` (`antithesis-triage`,
`references/instrumentation.md`). Report them, but **gate on them only for a
language that supports coverage instrumentation**. Python is cataloging-only and
the fallback SDK emits none; there the fuzzer has no coverage feedback to steer
toward a divergence, so prefer a longer re-run to a *bad oracle* diagnosis for a
survivor, and say so in the report.

Green does **not** require every property in the run to pass:

- A failing `Reachable` or `Sometimes` does not block the sweep: record it, route it to `antithesis-workload`, and carry it into scoping — a safety property in the same unexercised region is likely to come back *outstanding — workload gap*.
- Telemetry and volume properties (`Hypervisor utilization`, `Customer output volume`, and similar) are not SUT correctness signals. Ignore them.

**A failing safety property stops the skill.** Report the failures and route the
user to `antithesis-workload` or `antithesis-research` — but **read
`counterexample_count` first**. `Always` and `Sometimes` imply `Reachable`
(`antithesis-triage`, `references/properties.md`), so a safety property that was
never reached can surface as failing without any invariant having been violated.
`counterexample_count` above zero is a real violation and stops the sweep; no
counterexamples and no examples means never evaluated — a coverage gap, handled
like the failing `Reachable` above.

Read `status.md` for a recorded baseline; it is valid only while its
`base_tree` fingerprint matches the current one. On a first sweep, create the
file here in the shape `references/evidence-and-report.md` defines and write to
it continuously — a sweep that only writes it at the end has nothing to resume.
If there is no valid baseline, establish one per
`references/sweep-and-verdicts.md`, "Establishing the baseline".

When the catalog is being reconstructed, this run comes first and supplies the
property list. The gate itself is unchanged — a red safety property still stops
the skill, whether or not there was a catalog naming it.

The ceiling is denominated in runs: a measured baseline wall clock far off the
interview's rule of thumb changes the schedule, not the authorization — proceed
within the ceiling without re-asking.

## Definitions and Concepts

- **SUT:** System under test.
- **Mutant:** A small, realistic source change designed to violate exactly one property, built as its own image and identified by a `mNN-<slug>` id.
- **Falsified (killed):** The targeted property failed on that mutant's run, in a history carrying the mutant's marker, for a reason the log ties to the divergence — never merely marker-green and target-red as two run-wide counts (`references/sweep-and-verdicts.md`, "Attributing a falsification").
- **Survived:** The mutant ran, the buggy code executed, and the targeted property still passed. Usually a defect in the mutant, oracle, workload, or property — the verdict ladder separates those from a search that simply never hit the case.
- **Baseline:** A run of the unpatched SUT built from the same source as every mutant. The control.
- **`base_tree`:** The git tree hash of the fork's `mutation-base` commit. The fingerprint that decides whether a recorded baseline still applies.
- **Announcement:** A startup log line carried by a mutant patch, proving the right build is deployed. Checkable locally, before any run budget is spent.
- **Marker:** A signal carried by a mutant patch at the point of divergence, proving the buggy code executed. A `Reachable` assertion where the SDK catalogs assertions; a log record where it does not.
- **Collateral damage:** Properties other than the target that also fail on a mutant's run. Expected; credited only when the evidence shows a genuinely distinct violation.

## Opening interview

Scan first — question 2 is quoted in terms of N, the safety-class property
count, and only the scan supplies it — then ask all five before doing anything
else. These decide how much the skill spends, how far it goes without you, and
what it may change in your tree.

**Scan the source for SDK assertion callsites, always** — not only when the
catalog is missing (`references/catalog-reconstruction.md` gives the
per-language spellings). It tells you which of three situations you are in:

- **Catalog present and consistent with the scan** — count its safety-class properties; that is the mutant count
- **No catalog** — reconstruct one (`references/catalog-reconstruction.md`); the scan's safety-class count is the mutant count
- **Catalog present but the scan finds assertions it never mentions** — the catalog has fallen behind. Reconstruct the missing entries only, and say so

Show the user the property list either way, with the class of each — the moment
to correct a name or scope call is before any budget is spent.

1. **Fork location.** Where the ephemeral mutated copy lives. Default: the
   agent's scratchpad. Also ask whether any large build directories should be
   excluded from the copy (see `references/mutation-harness.md`).
2. **Budget and concurrency.** Quote a **range**: N mutants plus a baseline is
   the N+1 floor, but re-attempts, longer re-runs, and a full re-sweep after
   every round of core fixes make ~5N runs the honest figure — **propose that
   as the total run ceiling for the session**. Add about N × T of image builds,
   where T is one full image-set build — often the larger number. T (estimate
   it from the service count) and the true per-run wall clock (roughly 45
   minutes for a 15-minute run, counting setup and reporting) are unknown until
   the baseline measures them; say so plainly. Then ask how many runs may be
   **in flight** at once — submissions are serialized regardless
   (`references/sweep-and-verdicts.md`).
3. **Rounds.** Checkpoint after each sweep, or iterate autonomously.
4. **Changes to your source.** May the skill apply assertion and workload fixes
   directly to the user's tree, or should it propose them and leave them
   unapplied? Mutant patches never touch the real tree either way — this is
   about the fixes a sweep finds.
5. **On a bad property.** Stop and route to `antithesis-research`, or refine the
   catalog in place — correct the property, or withdraw it when it is
   conceptually unfalsifiable — and keep going on the others.

Answering *autonomous* plus *refine* plus *apply* gives a workflow that runs
until it converges or exhausts its budget.

**Write the answers to `antithesis/scratchbook/mutation-testing/interview.md`
before spending anything** — the paths, the five answers, and the agreed
scope (`references/evidence-and-report.md` has the shape), updated whenever an
answer changes. It is the only record of what the user authorized, and what a
stopped sweep resumes from.

**The run ceiling confirmed here is the standing authorization for this
session.** Later rounds within it need no re-confirmation, in either workflow; a
later session re-confirms once on resume. A round that would exceed the ceiling
stops — to ask, in the checkpointed workflow; to write the report with what is
outstanding, in the autonomous one. Track runs spent against the ceiling in
`status.md` from the first launch.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Properties and assertions: `https://antithesis.com/docs/concepts/properties_assertions/assertions.md`
- SDK reference: `https://antithesis.com/docs/reference/sdk.md`
- Fault injection: `https://antithesis.com/docs/product/fault_injection.md`

## Reference Files

| Reference                          | When to read                                                        |
| ---------------------------------- | ------------------------------------------------------------------- |
| `references/mutation-harness.md`   | Always — the fork, the patch layout, tags, builds, verification      |
| `references/catalog-reconstruction.md` | The scratchbook is missing or lags the code — rebuilding a catalog to mutate against |
| `references/mutant-design.md`      | Designing a mutant for a property; the three-part patch              |
| `references/static-validation.md`  | Tracing the kill chain before spending a run                         |
| `references/sweep-and-verdicts.md` | Launching, polling, classifying survivors, and the iteration loop    |
| `references/evidence-and-report.md`| Recording verdicts, and the final report                             |
| `references/resume.md`             | `interview.md` exists from a previous sweep — resuming it            |

## Recommended Workflows

### First sweep

1. Scan the source for SDK assertion callsites, run the opening interview, and record its answers in `interview.md`
2. Read `references/mutation-harness.md`; copy the harness into `antithesis/scratchbook/mutation-testing/`, resolve the paths each script takes (`--source`, `--patches`, `--images`, `--fork`), and materialize the fork
3. Populate `antithesis/scratchbook/mutation-testing/images.txt` with the compose image names built from this repo (`references/mutation-harness.md`, "Tags")
4. Satisfy the baseline gate (above)
5. If the scratchbook has no catalog, read `references/catalog-reconstruction.md` and reconstruct one from the assertions and the baseline run
6. Select in-scope properties (see "Scope" below), using the baseline triage to drop unexercised ones
7. Read `references/mutant-design.md` and `references/static-validation.md`
8. Design one mutant per in-scope property; delegate one property per sub-agent where supported (see `references/static-validation.md`). Review the batch and reject weak, crashy, or un-killable candidates before wiring any
9. Author the accepted mutants in the fork, one `mut/<id>` branch each, and export them with `sync-patches.sh`
10. Build the baseline and every mutant image, then verify each mutant locally with `verify-mutant.sh`
11. Read `references/sweep-and-verdicts.md`; launch the sweep, one `select-mutant.sh` → launch at a time, with runs overlapping up to the agreed limit
12. Poll, triage, and classify each run
13. Read `references/evidence-and-report.md`; record verdicts and write the report
14. Run `clean.sh` when the sweep has converged or been abandoned, and after any failure — **not when it will be resumed**, and a ceiling stop with outstanding properties counts as to-be-resumed: the fork holds any unexported mutant branch, and its `base_tree` is what a resume diffs against (`references/resume.md`). If you must clean first, run `sync-patches.sh`; the resume then treats any fingerprint drift as real and re-baselines

### Iterate after a sweep

1. Read `references/sweep-and-verdicts.md`
2. Wait for every run to land and classify every survivor before changing anything — a real-tree fix applied while a run is in flight invalidates the baseline out from under it
3. Apply all diagnosed fixes for the round together, honoring interview question 4 for anything that touches the user's tree
4. Export every revised mutant with `sync-patches.sh` **before** re-forking; `fork.sh` refuses otherwise — never clear that with `--force` (`references/mutation-harness.md`, "When a script stops on an assumption")
5. Re-run under the two-branch rule: mutant-patch-only changes re-run just the changed mutants; any change to the SUT, workload, or assertions requires a fresh baseline plus a full sweep. Rebuild and re-verify every mutant before launching it — tags are stable across forks, so a stale image goes out silently
6. Update the report, and run `clean.sh` when the sweep is finished

### Resume a stopped sweep

Budget exhausted, checkpoint declined, session ended — whatever stopped it,
resume from the recorded state rather than re-deriving it. **If `interview.md`
is absent this is a first sweep**: run the opening interview instead. Otherwise
read `references/resume.md` and follow it: it reconciles `status.md` against
the platform, salvages un-exported work from the old fork, decides whether the
recorded baseline still applies, and re-enters the two workflows above at the
right step — without redoing any mutant that already has a verdict at the
current `base_tree`.

## Scope

| Assertion class | Treatment |
| --- | --- |
| `Always`, `AlwaysOrUnreachable`, `Unreachable` | **Mutate.** A green safety property is only *negative* evidence — the vacuous pass this skill exists to rule out |
| `Sometimes(cond)` | **Baseline only.** A `Sometimes` fails only when its condition is false in *every* timeline, so a subtle, prerequisite-gated mutant leaves it green in the timelines that never hit the prerequisite |
| `Reachable` | **Baseline only.** A green `Reachable` already proves the workload drove the system there |

**"In scope" means every safety-class property in the catalog** — the set the
report must account for, whether or not each one ends up with a mutant. Two
kinds get a verdict without being mutated, and both belong in the report:

- **Unexercised on the baseline.** For `Always` and `AlwaysOrUnreachable`, `example_count` 0 in the baseline means the assertion never evaluated, and a mutant nothing reaches cannot be killed. One 15-minute randomized run is a sample, though, and it under-samples exactly the deep, rare states most worth validating: confirm with a longer baseline before scoping anything out, then route it to `antithesis-workload` and record it as *outstanding — workload gap*. The verdict is provisional: it is the same *bad workload* work order as the ladder's, governed by question 4 and the ceiling like any other real-tree fix. Check this at scoping time.
  **`Unreachable` is the exception: `example_count` 0 is its healthy state.** Whether its guarded region is exercised is exactly what the mutant's marker establishes. Take the class from the **assertion scan** — the catalog's **Type** field collapses all three safety classes to `Safety`, so a catalog read alone would scope out every `Unreachable`
- **Not mutatable.** The property is owned by a component not built from source in this repo (a stock database image, a managed queue). A fact about the harness, not a defect in the property — never grounds for withdrawal
- **Not cataloged.** The assertion exists in the source but never appeared in the baseline's property list. Record it as *outstanding — not cataloged* with the instrumentation diagnosis from `references/catalog-reconstruction.md` — unless the service uses the fallback SDK or JavaScript, where absence is normal and the property is mutated like any other (the join table there). The same verdict covers a mutant that never passes `verify-mutant.sh` or whose patch has gone `STALE`: the sweep could not obtain a result, and says so

While scoping, note any `Sometimes` whose condition looks trivially satisfiable
— `Sometimes(true)` in all but name. Report it as a catalog observation with the
`Reachable(...)` rewrite `antithesis-workload`'s self-review calls for; never
apply it unattended.

## General Guidance

- **Mutations only ever exist as patches, and only in the fork.** Never apply a mutant patch to the user's working tree; oracle and workload fixes land there, mutants never do.
- **One mutant per property, modeling a realistic mistake.** A dropped guard, a flipped comparator, an off-by-one, a missing clamp — not vandalism.
- **Do not game the loop.** A kill obtained by hobbling the workload into a narrow deterministic path, or by coarsening a mutant into obvious vandalism, is worse than an honestly-recorded un-killable candidate. The goal is a catalog that catches real bugs, not a table of green checkmarks.
- **Re-keying an assertion to the mutant that will then validate it proves nothing** — the re-swept kill is circular. Do it when the assertion is genuinely wrong, and record it as *falsified after refinement*, never as a plain falsification.
- **A mutant that exposes a bad oracle is a success, not a detour.** Record the gap it found in the property's evidence file.
- **An authorized fix deferred is a sweep left unfinished.** When interview question 4 says apply, the *bad oracle* and *bad workload* diagnoses are work orders, not observations. Iterate the cheap mutant-side fixes first, but once they stabilize, land the real-tree fixes and pay the re-sweep, within the run ceiling (`references/sweep-and-verdicts.md`, "Iterating").
- **Prefer refining a property to withdrawing it**, and never withdraw one silently.
- **Mutant runs deliberately fail properties.** They must always be launched with a dedicated `--source` and `--ephemeral` so they cannot be mistaken for regressions in the user's real test history.

## Output

- `antithesis/scratchbook/mutation-testing/patches/` — one patch per mutant; the patch set is the list of wired mutants
- `antithesis/scratchbook/mutation-testing/mutants/{id}.md` — per-mutant evidence: target, mistake, kill chain, predicted and actual verdict
- `antithesis/scratchbook/mutation-testing/interview.md` — the agreed paths, answers, and scope; what a later session resumes from
- `antithesis/scratchbook/mutation-testing/status.md` — sweep state, baseline record, run ids; resumable while the sweep is in progress
- `antithesis/scratchbook/mutation-testing/history.md` — append-only log of every completed run: run id, mutant, target property, attempt, diagnosis, action taken
- `antithesis/scratchbook/mutation-testing/report.md` — the outcome for every in-scope property
- A `## Falsification` section appended to each `antithesis/scratchbook/properties/{slug}.md`
- A reconstructed `antithesis/scratchbook/property-catalog.md`, its evidence files, and `existing-assertions.md`, when there was no catalog to start from
- Assertion, workload, and catalog fixes applied in the user's real tree

## Self-Review

Before declaring this skill complete, review the output artifacts against the
criteria below — where sub-agents are supported, with a fresh-context reviewer
given the path to this skill file.

- `interview.md` records the paths, the five answers, and the agreed scope, and matches what the user actually authorized — including any change made on resume
- A green baseline was established at the reported `base_tree` before any mutant was designed, and its run id is recorded in `status.md`
- Every in-scope property carries exactly one verdict from `references/evidence-and-report.md`, "Verdicts and qualifiers" — a reason on everything but *falsified*, and the `base_tree` it was obtained at
- Each falsification cites the run and the evidence tying the mutant's marker to the history the targeted property's counterexample came from — never two run-wide counts, never collateral damage alone, and no collateral credited on the strength of firing first
- Every launched run used the fork's config directory
- Each mutant models a realistic developer mistake targeting exactly one property; none was coarsened into vandalism, and no workload was narrowed, to force a kill
- Survivors were classified by which link of the kill chain broke — not filed generically as "the property missed it"
- Real-tree fixes were applied or proposed per interview question 4, never on the strength of a static trace alone, and were followed by a fresh baseline plus a full sweep; mutant-only fixes did not trigger one; no fix question 4 authorized was left unapplied while the ceiling had room for its re-baseline and re-sweep
- No property was withdrawn for being *not mutatable*; withdrawn entries carry a reason, their evidence files are annotated rather than deleted, and the report lists any SDK assertion left with no validated property
- The sweep stayed within the agreed budget and concurrency limit, and never had two mutants in flight through `select-mutant.sh` → launch at once; every completed run has a row in `history.md`
- Every launched mutant's announcement was verified locally before its launch and confirmed in the run's own events
- A reconstructed catalog is marked as reconstructed in its provenance, its assertion scan was shown to the user during the interview, and the report says the sweep validated only the assertions that already existed
- `report.md` names every in-scope property with its verdict and, where falsified, the run id that proves it
- The fork is deleted and the user's working tree carries no mutation
