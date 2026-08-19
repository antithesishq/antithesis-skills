# Static Validation

## Goal

Catch on paper the two ways a mutant fails to do its job, before a run is spent
learning the same thing.

A mutant is a hypothesis: *this bug violates safety property `{slug}`, and the
assertion guarding it will fire.* A survivor is the most expensive result to
debug after the fact — it looks identical whether the mutant, the oracle, or the
workload was at fault. So trace the chain by hand first. Every mutant gets a
trace before it is built.

## The kill chain

Four links. Walk them in order and write each one down.

### 1. Reach — what drives execution into the mutated code?

Name the specific test command or workload action in `antithesis/test/` that
gets there, and any coverage state it depends on first. "The client sends
writes" is not a link; "`parallel_driver_writer` issues a write while
`anytime_partition` has the leader isolated" is.

If nothing in the current test commands exercises that path, the mutant is
un-killable as wired. Record it as a **workload gap** and follow the rule in
"What a trace may and may not authorize" below.

### 2. Diverge — does the buggy branch produce a different state?

Confirm the mutated code actually yields something the correct code would not.
A mutant that computes a different intermediate value which is then re-clamped,
rounded, retried, or recomputed back to the correct result before anything
observes it is **convergent**, and no run will kill it.

Watch for idempotent operations applied twice, retry loops that mask a first
wrong attempt, and values re-derived from a source the mutation didn't touch.

### 3. Propagate — does the divergence reach the observation point?

Follow the divergent state forward to where the targeted assertion reads it.
Confirm nothing corrects, smooths, or discards it on the way, and that it is
visible in the process and on the node where the assertion runs. State that
crosses a boundary the assertion cannot see is state the assertion cannot check.

### 4. Fire — does the assertion's predicate go false?

Read the actual predicate, not the property's prose. Confirm the divergent value
makes it evaluate false.

This is where mis-implemented oracles surface: a predicate that is too loose
(`<=` where the invariant says `<`, a tolerance that swallows the error), keyed
on a coarser quantity than the one that diverges, reading a different field,
node, or epoch, or guarded behind a condition the mutation itself disables.

If the trace shows the SUT is genuinely wrong with the mutant on but the
assertion still would not fire, **the assertion is the defect and the mutant has
already done its job.** Record that as the mutant's **predicted verdict** and follow the rule below. Any change goes through
`antithesis-workload`'s `references/assertions.md` conventions, and record in
the property's evidence file the gap the mutant exposed.

## The two failure modes

Every static rejection reduces to one of these.

**Un-killable.** No run can make the targeted property fire.

- *Unreachable path* — the workload never drives execution into the mutated code. Extend the workload with an action or fault that forces it. If that is not feasible in this harness, the mutant is not viable: record it as a rejected candidate and design a different one for that property.
- *Convergent behavior* — the divergence is erased before observation. Choose a different mistake for the same property, or move the observation point to where the transient divergence is visible.
- *Self-masking* — the mutation also disables the code that would have reported it. Narrow the mutation to the buggy behavior alone, leaving the reporting path intact.

**Mis-implemented oracle.** The SUT is wrong, but the assertion does not notice.
Tighten it, re-key it to the diverging state, or relocate it to where that state
is visible. This is a real finding about the catalog, not a detour.

## Predict the verdict

Finish each trace with a prediction, recorded in
`antithesis/scratchbook/mutation-testing/mutants/{id}.md`:

- the chain in brief — reach → diverge → propagate → fire — naming the workload action that reaches the site and the assertion that should kill it
- which property fires, and what collateral damage to expect
- what the marker should show: green, since the divergence is predicted to happen

A prediction turns triage into a confirmation instead of an investigation. When
a mutant survives despite a clean trace, the gap is in the *trace* — some
assumption in the chain was wrong, and the same blind spot is probably hiding in
the other mutants too. Revisit them before re-sweeping.

## Scaling the trace

Tracing every mutant in one context degrades quickly. Delegate one property per
sub-agent: give it the property's catalog entry, its evidence file, the mutant
proposal, and the paths to the SUT and `antithesis/test/`, and have it return
the four links plus a verdict prediction as a compact summary. Review the batch
yourself and reject the weak candidates before wiring any of them.

Without sub-agents, trace them sequentially, and expect to re-read the evidence
file for each one rather than working from memory of the last.

## What a trace may and may not authorize

A trace is a prediction, not a result. It is read off code by an agent that has
not run it, often a sub-agent whose reasoning the orchestrator only reviews.

**It may authorize:** rejecting or re-designing a mutant, changing which
property a mutant targets, scoping a property out, and recording a predicted
verdict that the run will confirm or refute.

**It may not authorize a change to the user's source on its own.** If the trace
says the oracle is too loose, that is a hypothesis with a cheap test: launch the
mutant and let it survive. A survivor at the assertion is evidence; a trace that
says one would survive is a guess, and acting on it rewrites a working assertion
on the strength of a paper reading — with a full re-baseline and re-sweep behind
it, since the fix lands in the real tree.

So: launch the mutant, record the prediction, and fix the oracle once the run
agrees.

**Where a fix is genuinely required before launching** — most often a workload
that cannot reach the mutated code at all, where the run would only confirm what
the trace already showed — it is still a real-tree change. That means: honor the
answer to interview question 4 (apply, or propose and stop), and re-fork plus
re-baseline before the sweep, because the fix moves `base_tree` and the recorded
baseline no longer describes the code being tested. Batch these with any other
real-tree fixes in the round; do not re-baseline once per fix.
