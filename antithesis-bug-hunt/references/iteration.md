# Iteration

## Goal

When the bug doesn't trigger, decide what to change and change it. The
iteration signal comes from what you observe: reach claims, workload output,
triage results, and the trigger hypothesis.

## The Iteration Signal

### Reach claims first

Before adjusting anything, check reach claims:

1. Are **operational reach claims** firing? (Is the workload performing
   operations at all?)
2. Are **precondition reach claims** firing? (Is the workload reaching the
   conditions the bug needs?)

If operational reach claims aren't firing, the workload has a basic problem —
it's not performing the operations it's supposed to. Fix this before anything
else.

If precondition reach claims aren't firing, the workload is running but not
reaching the bug's preconditions. The workload needs to change — see
"Workload adjustments" below.

If reach claims are firing but the bug isn't triggering, the workload is in
the right neighborhood but the conditions aren't aligning — see "Narrowing"
below.

Before treating an unfired reach claim as a gap, make sure it's a
precondition claim, not the negation of an `Always` at the same site. The
negation of a green `Always` cannot fire. Fix the claim, not the workload —
see `references/assertions.md`, "A Reach Claim Asserts the Precondition,
Never the Violation."

### Triage results (Antithesis runs)

After an Antithesis run, `antithesis-triage` reports property status:

- **Passed**: The invariant held throughout. The bug didn't trigger — but the
  workload may not have reached the right conditions.
- **Failed**: The invariant was violated. This needs verification — see
  `references/verification.md`.
- **Unfound**: The assertion was never evaluated. The workload isn't reaching
  the code path at all.

Frame triage with a focused lens: "I'm hunting for [specific bug]. Did it
trigger? Are the reach claims firing?"

### Narrowing

Reach claims are firing but the bug isn't triggering. The workload is in the
right neighborhood — it reaches the preconditions — but the specific
conditions that cause the bug aren't aligning. This is the hardest iteration
state because the workload is doing the right thing and the remaining gap is
subtle.

- **Tighten the state space.** Reduce buffer sizes, shorten timeouts, fewer
  replicas — make the system operate closer to its limits so the bug's
  conditions are more likely to align.
- **Increase concurrency pressure.** More concurrent clients, tighter
  interleaving. The bug may need a specific interleaving that wider
  concurrency produces more often.
- **Bias toward the trigger sequence.** If the hypothesis involves a specific
  operation ordering, use swarm parameters to heavily bias toward that
  sequence in some runs.
- **Add deeper reach claims.** The current claims show you reach the
  preconditions, but there may be intermediate states between the
  preconditions and the bug that you haven't verified. Add claims further
  along the trigger path to find where the gap is.
- **Extend run duration.** If the bug requires a rare alignment, longer runs
  give more chances. Move from 30-minute runs to 2-4 hour runs.
- **Consider missing faults.** The bug may need a fault type that isn't
  enabled. Check `references/faults.md` and confirm the relevant faults are
  active for the tenant.

## Iteration Moves

There is no fixed order. Use what you observe to decide what to adjust.

### Workload adjustments

- **More concurrency.** If the bug requires interleaving, add more concurrent
  clients, threads, or operations.
- **Different timing.** Add delays between operations, change batch sizes,
  interleave different operation types.
- **Different values.** Revisit the value menu — are you hitting the right
  boundaries? Add values discovered from recent code reading. See
  `references/interesting-values.md`.
- **More aggressive patterns.** Operations that stress the system harder —
  rapid create/delete cycles, full/empty transitions, burst traffic.
- **Operation ordering.** If the trigger hypothesis involves a specific
  sequence, add workload modes that emphasize that sequence.
- **Swarm parameters.** Vary the shape of randomness across runs — different
  probability distributions, action weight biases. See
  `references/self-driving-workload.md`, "Randomness and swarm testing."

### Assertion adjustments

- **Add intermediate assertions.** If you're unsure whether the bug is
  happening silently, add assertions that detect intermediate states on the
  path to the bug — states that should or shouldn't hold if the bug's
  mechanism is active.
- **Add SUT-side assertions.** When the bug involves internal state the
  workload can't observe directly, add surgical assertions in the SUT at
  the relevant code points.
- **Refine existing assertions.** An assertion that's too broad produces
  false positives; too narrow misses the bug. Adjust based on what you see.
- **Add reach claims for deeper preconditions.** If the current reach claims
  fire but the bug doesn't trigger, there may be deeper preconditions you
  haven't verified. Add claims further along the trigger path.

### SUT configuration adjustments

- **Smaller buffers.** Reduce queue sizes, connection pool sizes, batch
  sizes — make the bug's conditions more likely by operating closer to
  limits.
- **Shorter timeouts.** Make timeout-related bugs trigger faster.
- **Fewer replicas.** Reduce the number of replicas to concentrate state
  transitions on fewer nodes.
- **Enable fault types.** If the trigger hypothesis involves crashes or
  clock skew, confirm the relevant faults are enabled (see
  `references/faults.md`).

### Hypothesis revision

If nothing is working after 2–3 iterations, the trigger hypothesis may be
wrong. Go back to `references/targeted-research.md`:

- Re-examine the code with what you've learned from running the workload
- Look for alternative mechanisms that could produce the same symptoms
- Consider whether the bug is real at all — did you validate it?

## Local vs Antithesis Iteration

### Local iteration

Faster feedback loops. Run the workload, observe, adjust, run again. Good for:

- Verifying reach claims fire
- Testing new operation patterns
- Validating workload correctness (no assertion bugs)
- Quick smoke tests (5-minute runs)

### Antithesis iteration

Slower but more powerful. Antithesis explores interleavings, injects faults,
and searches the state space. Good for:

- Bugs that require fault injection
- Bugs that require specific scheduling
- Exploring beyond what local concurrency can produce
- Longer runs that cover more state space

**Run duration guidance:**
- Quick check: 10–15 minutes (verify harness works)
- Standard hunt: 30–60 minutes (normal search)
- Deep exploration: 2–4 hours (hard-to-trigger bugs)

Start short to verify the harness works, then increase duration as confidence
grows that the workload is reaching the right state.

## Recording Iterations

After each iteration, update `antithesis/bug-hunt/<bug-slug>/analysis.md`:

- What was changed and why
- What was observed (reach claims, assertion results, workload behavior)
- Whether the hypothesis was updated
- What to try next

This trail is critical — without it, the next iteration starts from scratch
instead of building on what's been learned.
