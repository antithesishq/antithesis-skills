# Mutant Design

## Goal

Turn one safety property into one mutant: a small, realistic source change that
violates that property's invariant and nothing else you didn't intend.

Read the property's catalog entry and its evidence file at
`antithesis/scratchbook/properties/{slug}.md` together. The evidence file
already records the code paths, failure scenarios, and timing windows behind the
property — that is where a good mutant comes from. A mutant designed without it
tends to break the property in a way no developer would have written, which
proves nothing about whether the catalog catches *plausible* bugs.

If the evidence file is missing or thin — a reconstructed catalog has thin ones,
and an inherited harness may have none — read the assertion's callsite and the
code around it instead, and write what you learn into the evidence file as you
design. A mutant needs that understanding either way; rebuilding it per property
is the cost of a missing scratchbook.

Only `Always`, `AlwaysOrUnreachable`, and `Unreachable` properties are mutated.
See `SKILL.md`, "Scope", for why liveness and reachability properties are
validated by the baseline instead.

## The three-part patch

Every mutant patch contains exactly three things. Each answers a different
question, and the diagnosis in `sweep-and-verdicts.md` depends on being able to
answer them separately.

### 1. The startup announcement — *is the right build deployed?*

A constant line emitted at process start, **before `setup_complete`**, near the
entrypoint rather than deep in the code:

```
ANTITHESIS MUTANT ACTIVE: m04-duplicate-term-ge
```

It answers a question that can be settled locally, for free, before any run
budget is committed — `snouty validate` brings the system up and watches for
`setup_complete`, so this line lands inside the window it is watching.

Emit it on stdout or stderr with no color codes, and flush it: a Python or C++
service whose stdout is block-buffered on a pipe may otherwise hold it for
minutes. Repeats are fine — one sighting per run is proof, so a line per node or
per process costs nothing. Keep it shallow; it is a build fingerprint, not
instrumentation, and it must not depend on the SUT reaching any interesting
state.

Put it in the **same service** the mutation is in. An announcement emitted by
whichever container starts first proves nothing about the image carrying the
bug. If the mutated component has no entrypoint of its own — a library, a batch
job — put it in the earliest code of that component that always runs, and note
in the evidence file what the announcement does and does not prove.

### 2. The marker — *did the buggy code actually execute?*

A signal at the point of divergence, carrying the mutant id:

```
Reachable("[m04-duplicate-term-ge] duplicate term accepted")
```

Because each mutant is built as its own image, this marker exists only in the
image that wants it. It cannot pollute the baseline, and it cannot show up red
on some other mutant's run. On this mutant's run it is a normal property: green
means the divergence happened, red means it never did — which is the single most
useful fact when a mutant survives.

**Where the SDK does not catalog assertions, the marker is a log record
instead.** JavaScript has no Antithesis SDK — `antithesis-setup`'s
`references/language/javascript.md` directs those projects to a hand-rolled
fallback — and a fallback assertion that only emits on hit has no "never
reached" state to report. In those services, emit a distinct log line at the
divergence point and read it back with `snouty runs events` (see the second
constraint below). Record in the mutant's evidence file which form the marker
takes, so triage knows where to look.

Three practical constraints on the assertion form:

- **The SDK must be importable at that site.** A new import in a crate, module, or translation unit that doesn't already depend on the SDK means a new dependency edge — and under the hermetic, vendored builds Antithesis requires, adding one usually fails the build outright rather than degrading. Check this while designing, not after the build fails. If the site can't reach the SDK, use the log-record form.
- **A log-record marker is read with `snouty runs events "$RUN_ID" "<marker text>"`**, which searches a run's events from the CLI. Do not make this path depend on the `antithesis-query-logs` skill: that needs an authenticated `agent-browser`, which an unattended sweep does not have, and this marker is exactly the case a fallback-SDK or JavaScript service always lands in.
- **Cataloging is per-artifact.** A Java module jar, a Python wheel, or a strong-named .NET assembly that isn't in the image's catalog set yields an uncataloged marker, which reports as absent rather than red. If the mutated component sits outside what `/opt/antithesis/catalog/` covers, use the log-record form.

**Place the marker where the mutation actually diverges, not where the enclosing
function is entered.** For a dropped guard, put it inside the branch the guard
would have rejected, so green means "the bug really happened" rather than "the
code containing the bug ran." Where a conditional placement is not cheap to
express, site entry is acceptable — record in the mutant's evidence file that
the marker proves reach but not divergence, so a survivor is diagnosed with that
weaker meaning in mind.

The assertion name must be an inline constant string literal and unique in the
project. The `[{mutant-id}]` prefix makes both automatic.

### 3. The buggy change

A plain source diff — the bug as a developer would have written it. There is no
runtime gate and no selector environment variable to wrap it in: the image is
the selector, so the mutated code is simply the code. That is what keeps a
mutant reviewable as the mistake it models.

## What makes a good mutant

- **One property.** The mutant should break the invariant behind exactly one catalog entry. It will usually break others too (see "Collateral damage"); you name and document the one it targets.
- **A realistic developer mistake.** A dropped guard, `>` where `>=` belonged, an off-by-one, a missing clamp, a check moved outside a lock, an error swallowed instead of propagated. Not vandalism: corrupting a log, decrementing a commit index, or returning garbage tests nothing about whether the catalog catches *plausible* bugs.
- **Subtle.** The bug should need a specific reachability prerequisite to manifest. A mutant that breaks the invariant on every request kills its property in the first second of the run, which tells you the assertion exists but nothing about whether the search can find the interesting case.
- **Non-fatal.** The mutant must not crash a container, hang startup, or prevent `setup_complete`. A container that exits takes the whole run with it and produces an off-target failure instead of a falsification.
- **Reachable by the current workload.** If nothing in `antithesis/test/` drives execution to the site, the mutant is un-killable as wired. Say so during static validation and fix the workload, rather than launching it and paying a run to learn the same thing.
- **In a service built from source here.** A property guarded inside a stock database image or a managed service cannot carry a patch. Scope it out as *not mutatable*; never withdraw it from the catalog for that reason.

Research several candidates per property and wire the strongest. Record the ones
you rejected in the mutant's evidence file — a rejected candidate with a reason
is useful the next time this property needs work.

## Where to break it

Break the invariant the assertion checks, at the place the evidence file says
the guarantee is established. Prefer a mistake in the code that *maintains* the
invariant over one in the code that *checks* it: mutating the check itself often
disables the reporting path along with the behavior, which produces a mutant
that hides its own effect.

## Collateral damage

A mutant that breaks a real invariant usually trips several properties. That is
normal and not a defect.

Name the target. Predict the collateral in the evidence file, so triage confirms
a prediction instead of opening an investigation. A property that fires as
collateral may be *credited* as falsified — but only when its evidence shows a
genuinely distinct violation rather than a downstream cascade of the target's
failure. See `sweep-and-verdicts.md`.

## A note on degenerate `Sometimes` conditions

Report a trivially-satisfiable `Sometimes` as a catalog observation with the
`Reachable(...)` rewrite; never apply it unattended (`SKILL.md`, "Scope").
Triviality is domain-dependent: `Sometimes(queue_drained)` is trivial in a
stateless service and a real liveness claim in a saturated one.

## Anti-patterns

- A mutant that also removes the logging or assertion that would have reported it — it hides its own effect and survives for the wrong reason
- A mutant whose divergent value is re-clamped, retried, or recomputed back to the correct result before anything observes it
- A mutant so broad that half the catalog fires, making the targeted result meaningless
- A mutant coarsened into obvious vandalism because a subtle version was not getting killed — fix the workload or the oracle instead
- Two mutants for one property "to be sure" — pick the strongest and record the other as a rejected candidate
