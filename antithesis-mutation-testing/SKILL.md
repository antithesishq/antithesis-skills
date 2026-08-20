---
name: antithesis-mutation-testing
description: >
  Validate that an Antithesis property catalog can actually catch bugs. For
  each safety property, inject one realistic mutant into the SUT, run it, and
  confirm the targeted property fires. Diagnoses survivors as a bad mutant, bad
  oracle, bad workload, or bad property, and routes fixes back to
  antithesis-workload or antithesis-research. Use once the harness is built and
  a baseline run is green.
compatibility: Requires the `docker-compose` binary (Docker Compose v2), which snouty execs directly; `podman compose` is not supported, though podman as the container runtime behind `DOCKER_HOST` is fine. Also requires snouty (https://github.com/antithesishq/snouty), jq, git, and rsync. Crediting collateral damage additionally needs the antithesis-query-logs skill and its authenticated agent-browser; without it, credit only what `snouty runs events` can establish.
---

# Antithesis Mutation Testing

## Purpose and Goal

Validate the *oracle*, not the system under test.

A property that passes on every run tells you nothing bad was observed. It does
not tell you the property would have noticed if something bad had happened — and
a property that could never fail looks identical to one that is genuinely
guarding the system.

Mutation testing removes that ambiguity. For each property, inject one
realistic bug designed to break exactly that property, run it under Antithesis,
and confirm the property fires.

Success means:

- Every in-scope property is falsified by a mutant, or carries one of the other four verdicts: *not mutatable*, *outstanding*, *withdrawn*, or *refined* (see `references/evidence-and-report.md`, "Verdicts and qualifiers")
- Each falsification is backed by a run whose evidence shows the property failed for the predicted reason, not as collateral from an unrelated cascade
- Bad oracles and workload gaps found along the way are fixed; bad properties are routed back to `antithesis-research`
- `antithesis/scratchbook/mutation-testing/report.md` records the outcome for every in-scope property, with the run that proves it
- The user's working tree carries no mutation — every mutant lives in the fork, and `clean.sh` confirms it. Fixes the user authorized in the opening interview may land there; a mutation never does

Use the `antithesis-research` skill to build the property catalog, the
`antithesis-setup` skill to scaffold the harness, and the `antithesis-workload`
skill to implement assertions and test commands. Use the `antithesis-launch`
skill to submit runs — do not run `snouty launch` directly. Use the
`antithesis-triage` skill to read results.

## Prerequisites

- If the Antithesis scratchbook (usually `antithesis/scratchbook/`) is missing, or has fallen behind the assertions in the code, reconstruct a catalog from those assertions plus the baseline run — see `references/catalog-reconstruction.md`. This is not a blocker; it does narrow what the sweep can claim.
- DO NOT PROCEED if the Antithesis config directory contains a `manifests/` subdirectory. Kubernetes harnesses are not supported yet: mutant selection works by building one image per mutant and swapping the tag in `docker-compose.yaml`. Tell the user this and stop. Check this **before** the compose check below — a Kubernetes harness has no `docker-compose.yaml`.
- DO NOT PROCEED if there is no `docker-compose.yaml` for Antithesis and no `manifests/` directory either. Use the `antithesis-setup` skill to create the compose harness.
- DO NOT PROCEED if the SUT and workload contain no Antithesis SDK assertions at all. Use the `antithesis-workload` skill first — there is no oracle to validate. This is the one prerequisite a reconstruction cannot stand in for: properties with nothing asserting them give a mutant nothing to falsify.
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
property names first". Both this check and the scoping step below are guesswork
without it. An assertion Antithesis never cataloged cannot be
falsified, so a mutant aimed at it would spend a run to learn nothing — but this
does **not** fail the gate. Scope each missing one out as *outstanding — not
cataloged* and continue with the rest (`references/catalog-reconstruction.md`
diagnoses why it is missing). Only if *none* of them appear is the harness
broken rather than incomplete: stop and report that.

Check the instrumentation signals too — `Software was instrumented`, `Symbols
were uploaded`, `Thread pausing was enabled` (`antithesis-triage`,
`references/instrumentation.md`). Report them, but **gate on them only for a
language that supports coverage instrumentation**, where absence means the
harness is misbuilt. Python is cataloging-only and the fallback SDK emits no
instrumentation; the harness works the same on those SUTs, but the fuzzer has no
coverage feedback to steer toward a mutant's divergence, so a survivor there is
more likely to be a search that never got there than an oracle that missed. Say
so in the report, and prefer a longer re-run to a *bad oracle* diagnosis.

Green does **not** require every property in the run to pass:

- A failing `Reachable` or `Sometimes` means the workload never drove the system into that state. It does not block the sweep. Record it and route it to `antithesis-workload`. It also flags the region it guards as unexercised, which is worth carrying into scoping: a safety property in that same region is likely to come back *outstanding — workload gap*.
- Telemetry and volume properties (`Hypervisor utilization`, `Customer output volume`, and similar) are not SUT correctness signals. Ignore them.

**A failing safety property stops the skill.** Report the failures and route the
user to `antithesis-workload` or `antithesis-research`. Do not design mutants
against a system with a known safety failure.

**Read `counterexample_count` before applying that rule.** `Always` and
`Sometimes` imply `Reachable` (`antithesis-triage`, `references/properties.md`),
so a safety property that was never reached can surface as failing without any
invariant having been violated. A property with `counterexample_count` above
zero is a real violation and stops the sweep. One with no counterexamples and no
examples was never evaluated: that is a coverage gap, not a safety failure — do
not report it to the user as one. Record it, route it to `antithesis-workload`,
and carry it into scoping below, which decides what to do with it.

Read `status.md` for a recorded baseline; it is valid only while its
`base_tree` fingerprint matches the current one. On a first sweep the file does
not exist yet — **create it here, in the shape `references/evidence-and-report.md`
defines**, and write to it from this point on: the baseline row, then each run id
before the next launch, then verdicts. It is what a later session resumes from,
so a sweep that only writes it at the end has nothing to resume. If there is no
valid baseline, establish one per `references/sweep-and-verdicts.md`,
"Establishing the baseline": build and validate with the harness scripts —
never a bare `compose build`, which would push a baseline image to the user's
real registry tag — then launch through `antithesis-launch` as an `--ephemeral`
run under `--source mutation-testing:baseline`, and record the two measurements
it takes (per-run wall clock and local setup time) in `status.md`.

When the catalog is being reconstructed, this run comes first and supplies the
property list. The gate itself is unchanged — a red safety property still stops
the skill, whether or not there was a catalog naming it.

If the baseline's measured wall clock puts the sweep over the ceiling agreed in
the interview, that is the budget rule below, not a new question. If it fits the
ceiling, proceed without asking, however far off the rule of thumb it was.

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

Scan first, then ask all five before doing anything else. These decide how much
the skill spends, how far it goes without you, and what it may change in your
tree. The scan has to come first because question 2 is quoted in terms of N, the
safety-class property count, and only the scan supplies it.

**Scan the source for SDK assertion callsites, always** — not only when
the catalog is missing. `references/catalog-reconstruction.md` gives the
per-language spellings. The scan costs nothing, and it is the only way to know
which of three situations you are in:

- **Catalog present and consistent with the scan** — count its safety-class properties; that is the mutant count
- **No catalog** — reconstruct one (`references/catalog-reconstruction.md`); the scan's safety-class count is the mutant count
- **Catalog present but the scan finds assertions it never mentions** — the catalog has fallen behind. Reconstruct the missing entries only, and say so

Show the user the property list either way, with the class of each. This is the
moment to correct a name or a scope call: before any budget is spent, and while
they are still here to correct it.

1. **Fork location.** Where the ephemeral mutated copy lives. Default: the
   agent's scratchpad. Also ask whether any large build directories should be
   excluded from the copy (see `references/mutation-harness.md`).
2. **Budget and concurrency.** Quote a **range**, not the first sweep. *N
   mutants plus a baseline is N+1 runs at minimum, but most properties need more
   than one attempt: budget around 5N runs, plus about T of image builds.* Builds
   are often the larger number, and a budget that counts only runs will mislead.
   T is not measurable yet — the fork does not exist — so quote an estimate from
   the number of services and say the baseline build will measure it before the
   sweep goes out, the same way the per-run figure is settled. Quoting N+1 as if it
   were the total is the mistake to avoid: a full re-sweep follows every round of
   core fixes, each property may be re-attempted, and a rare kill gets a longer
   re-run. **Ask for a total run ceiling for the session** and use ~5N as the
   proposed figure. For wall clock, say a run takes appreciably longer than its
   duration once setup, exploration, and report generation are counted — a
   starting rule of thumb is about 45 minutes for a 15-minute run — and say
   plainly the baseline will measure it on this system before the sweep goes out.
   Then ask how many runs may be **in flight** at once. Note that submissions are
   serialized regardless (see `references/sweep-and-verdicts.md`); the limit
   governs concurrent runs, not concurrent launches.
3. **Rounds.** Checkpoint after each sweep, or iterate autonomously.
4. **Changes to your source.** May the skill apply assertion and workload fixes
   directly to the user's tree, or should it propose them and leave them
   unapplied? Mutant patches never touch the real tree either way — this is
   about the fixes a sweep finds. If they say propose-only, every such fix is
   recorded in `report.md` as a diff and the property stays outstanding until
   they apply it.
5. **On a bad property.** Stop and route to `antithesis-research`, or refine the
   catalog in place — correct the property, or withdraw it when it is
   conceptually unfalsifiable — and keep going on the others.

Answering *autonomous* plus *refine* plus *apply* gives a workflow that runs
until it converges or exhausts its budget.

**Write the answers to `antithesis/scratchbook/mutation-testing/interview.md`
before spending anything** — the four paths, the five answers, and the agreed
scope (`references/evidence-and-report.md` has the shape), updated whenever an
answer changes. It is the only record of what the user authorized, and what a
stopped sweep resumes from.

**The run ceiling confirmed here is the standing authorization for this
session.** Later rounds within it do not need re-confirmation, in either
workflow — that is what makes autonomous mode autonomous; a later session
re-confirms it once on resume. A round that would exceed the ceiling stops: in
the checkpointed workflow, to ask; in the autonomous workflow, to write the
report with what is outstanding. Track runs spent against the ceiling in `status.md`
from the first launch, not retroactively.

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
2. Read `references/mutation-harness.md`; copy the harness into `antithesis/scratchbook/mutation-testing/`, resolve the paths each script takes (`--source`, `--patches`, `--images`, `--fork`), and materialize the fork. Each script states its `INTENT` / `ASSUMES` / `GUARANTEES` and stops when an assumption fails; if one is wrong for this repo, edit the script and its `ASSUMES` to match, leaving `INTENT` and `GUARANTEES` alone
3. Populate `antithesis/scratchbook/mutation-testing/images.txt` with the compose image names built from this repo. Nothing works until this is right, and an empty file is a hard error
4. Satisfy the baseline gate (above)
5. If the scratchbook has no catalog, read `references/catalog-reconstruction.md` and reconstruct one from the assertions and the baseline run
6. Select in-scope properties (see "Scope" below), using the baseline triage to drop unexercised ones
7. Read `references/mutant-design.md` and `references/static-validation.md`
8. Design one mutant per in-scope property; delegate one property per sub-agent where supported (see `references/static-validation.md`). Review the batch and reject weak, crashy, or un-killable candidates before wiring any
9. Author the accepted mutants in the fork, one `mut/<id>` branch each, and export them with `sync-patches.sh`
10. Build the baseline and every mutant image, then verify each mutant locally with `verify-mutant.sh`
11. Read `references/sweep-and-verdicts.md`; launch the sweep. Submissions are serialized — one `select-mutant.sh` → launch at a time — while the runs themselves overlap up to the agreed limit
12. Poll, triage, and classify each run
13. Read `references/evidence-and-report.md`; record verdicts and write the report
14. Run `clean.sh` to remove the fork and confirm the user's tree carries no mutation — when the sweep has converged or been abandoned, and after any failure. **Not when it stopped and will be resumed**: the fork holds any mutant branch not yet exported to a patch, and `clean.sh` deletes it. Run `sync-patches.sh` first if you must clean a sweep you intend to resume — a resume re-forks from `--source` either way, so nothing else in the fork is load-bearing

### Iterate after a sweep

1. Read `references/sweep-and-verdicts.md`
2. Wait for every run to land, then classify every survivor before changing anything — the fix depends on which link of the kill chain broke, and a real-tree fix applied while a run is in flight moves `base_tree` out from under it
3. Apply all diagnosed fixes for the round together, not one at a time — honoring interview question 4 for anything that touches the user's tree
4. Export every revised mutant with `sync-patches.sh` **before** re-forking — a re-fork replays patches, so an unexported revision would be replaced by the version it was meant to fix. `fork.sh` refuses to run in that state; never clear that message with `--force` (`references/mutation-harness.md`, "When a script stops on an assumption")
5. Re-run under the two-branch rule: mutant-patch-only changes re-run just the changed mutants; any change to the SUT, workload, or assertions invalidates the baseline and requires a fresh baseline plus a full sweep. Rebuild and re-verify every mutant before launching it — the tags are stable across forks, so a stale image would otherwise go out silently
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

- **Unexercised on the baseline.** For `Always` and `AlwaysOrUnreachable`, `example_count` 0 in the baseline means the assertion never evaluated, and a mutant nothing reaches cannot be killed. Treat it as a hypothesis, not a fact: one 15-minute randomized run reporting no examples is a sample, and the properties it under-samples are the ones guarding deep, rare states — exactly the ones most worth validating. Confirm with a longer baseline before scoping any property out, then route it to `antithesis-workload` and record it as *outstanding — workload gap*, saying in the report that it was never mutated. Check this at scoping time, before designing anything.
  **`Unreachable` is the exception: `example_count` 0 is its healthy state**, since it passes by never being reached. Never scope an `Unreachable` out on that basis — whether its guarded region is exercised is exactly what the mutant's marker establishes. Take the class from the **assertion scan**, which runs on every sweep. The catalog's **Type** field cannot answer this — it records Safety / Liveness / Reachability, and all three safety classes collapse to `Safety`, so a catalog read alone will scope out every `Unreachable` property in the catalog
- **Not mutatable.** The property is owned by a component not built from source in this repo (a stock database image, a managed queue). That is a fact about the harness, not a defect in the property, and such a property must never be withdrawn from the catalog on these grounds
- **Not cataloged.** The assertion exists in the source but never appeared in the baseline's property list, so Antithesis has nothing to report a verdict on. Record it as *outstanding — not cataloged* with the instrumentation diagnosis from `references/catalog-reconstruction.md`. The same verdict covers a mutant that never passes `verify-mutant.sh`, or whose patch has gone `STALE`: the sweep could not obtain a result, and says so

While scoping, note any `Sometimes` whose condition looks trivially satisfiable
— `Sometimes(true)` in all but name. That is a real catalog observation worth
reporting, with the `Reachable(...)` rewrite `antithesis-workload`'s own
self-review already calls for. Report it; never apply it unattended.

## General Guidance

- **Mutations only ever exist as patches, and only in the fork.** Never apply a mutant patch to the user's working tree; oracle and workload fixes land there, mutants never do.
- **One mutant per property, modeling a realistic mistake.** A dropped guard, a flipped comparator, an off-by-one, a missing clamp — not vandalism.
- **Do not game the loop.** A kill obtained by hobbling the workload into a narrow deterministic path, or by coarsening a mutant into obvious vandalism, is worse than an honestly-recorded un-killable candidate. The goal is a catalog that catches real bugs, not a table of green checkmarks.
- **Re-keying an assertion to the mutant that will then validate it proves nothing.** When a survivor is diagnosed *bad oracle* and the fix re-points the predicate at the state this mutant diverges, the re-swept kill is circular: the only bug that property is known to catch is the one it was rewritten to catch. Do it when the assertion is genuinely wrong, but record it in the report as *falsified after refinement*, never as a plain falsification.
- **A mutant that exposes a bad oracle is a success, not a detour.** Record the gap it found in the property's evidence file.
- **Prefer refining a property to withdrawing it**, and never withdraw one silently.
- **Mutant runs deliberately fail properties.** They must always be launched with a dedicated `--source` and `--ephemeral` so they cannot be mistaken for regressions in the user's real test history.

## Output

- `antithesis/scratchbook/mutation-testing/patches/` — one patch per mutant; the patch set is the list of wired mutants
- `antithesis/scratchbook/mutation-testing/mutants/{id}.md` — per-mutant evidence: target, mistake, kill chain, predicted and actual verdict
- `antithesis/scratchbook/mutation-testing/interview.md` — the agreed paths, answers, and scope; what a later session resumes from
- `antithesis/scratchbook/mutation-testing/status.md` — sweep state, baseline record, run ids; resumable while the sweep is in progress
- `antithesis/scratchbook/mutation-testing/report.md` — the outcome for every in-scope property
- A `## Falsification` section appended to each `antithesis/scratchbook/properties/{slug}.md`
- A reconstructed `antithesis/scratchbook/property-catalog.md`, its evidence files, and `existing-assertions.md`, when there was no catalog to start from
- Assertion, workload, and catalog fixes applied in the user's real tree

## Self-Review

Before declaring this skill complete, review the output artifacts against the
criteria below. If your agent supports sub-agents, spawn a fresh-context
reviewer and give it the path to this skill file — it catches blind spots
in-context review misses. Otherwise check each item yourself against your actual
output.

- `interview.md` records the paths, the five answers, and the agreed scope, and matches what the user actually authorized — including any change made on resume
- A green baseline was established at the reported `base_tree` before any mutant was designed, and its run id is recorded in `status.md`
- Every in-scope property carries exactly one verdict from `references/evidence-and-report.md`, "Verdicts and qualifiers" — a reason on everything but *falsified*, and the `base_tree` it was obtained at
- Each falsification cites the run and the evidence tying the mutant's marker to the history the targeted property's counterexample came from — never two run-wide counts, never collateral damage alone, and no collateral credited on the strength of firing first
- Every launched run used the fork's config directory, so what ran was the mutant and not the user's unmutated system
- Each mutant models a realistic developer mistake targeting exactly one property; none was coarsened into vandalism, and no workload was narrowed, to force a kill
- Survivors were classified by which link of the kill chain broke — not filed generically as "the property missed it"
- Real-tree fixes were applied or proposed per interview question 4, never on the strength of a static trace alone, and were followed by a fresh baseline plus a full sweep; mutant-only fixes did not trigger one
- No property was withdrawn for being *not mutatable*; withdrawn entries carry a reason, their evidence files are annotated rather than deleted, and the report lists any SDK assertion left with no validated property
- The sweep stayed within the agreed budget and concurrency limit, and never had two mutants in flight through `select-mutant.sh` → launch at once
- Every launched mutant's announcement was verified locally before its launch and confirmed in the run's own events
- A reconstructed catalog is marked as reconstructed in its provenance, its assertion scan was shown to the user during the interview, and the report says the sweep validated only the assertions that already existed
- `report.md` names every in-scope property with its verdict and, where falsified, the run id that proves it
- The fork is deleted and the user's working tree carries no mutation
