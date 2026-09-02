# Iteration

## Goal

When feature properties aren't being exercised or reach claims aren't firing,
decide what to change and change it. The iteration signal comes from what you
observe: reach claims, workload output, triage results, and the feature's
properties.

## The Iteration Signal

### Reach claims first

Before adjusting anything, check reach claims:

1. Are **operational reach claims** firing? (Is the workload performing
   operations at all?)
2. Are **behavior reach claims** firing? (Is the workload reaching the
   feature's important states?)

If operational reach claims aren't firing, the workload has a basic problem —
it's not performing the operations it's supposed to. Fix this before anything
else.

If behavior reach claims aren't firing, the workload is running but not
reaching the feature's key states. The workload needs to change — see
"Workload adjustments" below.

If reach claims are firing but invariants aren't being tested (assertions
never evaluate), the workload is in the right neighborhood but the conditions
for checking the property aren't aligning — see "Narrowing" below.

Before treating an unfired reach claim as a gap, make sure it's a
precondition claim, not the negation of an `Always` at the same site. The
negation of a green `Always` cannot fire. Fix the claim, not the workload —
see `references/assertions.md`, "A Reach Claim Asserts the Precondition,
Never the Violation."

### Triage results (Antithesis runs)

After an Antithesis run, `antithesis-triage` reports property status:

- **Passed**: The invariant held throughout. Good — but the workload may not
  have reached all the conditions where the invariant could be violated.
- **Failed**: The invariant was violated. This needs verification — see
  `references/verification.md`.
- **Unfound**: The assertion was never evaluated. The workload isn't reaching
  the code path at all.

Frame triage with a focused lens: "Are the feature's properties being
exercised? Are the reach claims firing? Any failures?"

## Iteration Moves

There is no fixed order. Use what you observe to decide what to adjust.

### Workload adjustments

- **More concurrency.** If the feature involves shared state or concurrent
  access, add more concurrent clients, threads, or operations.
- **Different timing.** Add delays between operations, change batch sizes,
  interleave different operation types.
- **Different values.** Revisit the value menu — are you hitting the right
  boundaries? Add values discovered from recent code reading. See
  `references/interesting-values.md`.
- **More aggressive patterns.** Operations that stress the feature harder —
  rapid create/delete cycles, full/empty transitions, burst traffic.
- **Operation ordering.** If a property involves a specific sequence of
  operations, add workload modes that emphasize that sequence.
- **Swarm parameters.** Vary the shape of randomness across runs — different
  probability distributions, action weight biases. See
  `references/self-driving-workload.md`, "Randomness and swarm testing."

### Assertion adjustments

- **Add intermediate assertions.** If you're unsure whether a property
  violation is happening silently, add assertions that detect intermediate
  states — states that should or shouldn't hold if the feature is working
  correctly.
- **Add SUT-side assertions.** When a property involves internal state the
  workload can't observe directly, add surgical assertions in the SUT at
  the relevant code points.
- **Refine existing assertions.** An assertion that's too broad produces
  false positives; too narrow misses real violations. Adjust based on what
  you see.
- **Add reach claims for deeper states.** If the current reach claims fire
  but the workload isn't exercising interesting conditions, there may be
  deeper states you haven't verified. Add claims further along the feature's
  important paths.

### SUT configuration adjustments

- **Smaller buffers.** Reduce queue sizes, connection pool sizes, batch
  sizes — operate closer to limits to make boundary conditions more likely.
- **Shorter timeouts.** Make timeout-related properties exercise faster.
- **Fewer replicas.** Reduce the number of replicas to concentrate state
  transitions on fewer nodes.
- **Enable fault types.** If a property involves crash recovery or clock
  behavior, confirm the relevant faults are enabled (see
  `references/faults.md`).

### Property revision

If nothing is working after 2–3 iterations, the properties may need revision.
Go back to `references/feature-analysis.md`:

- Re-examine the feature's code with what you've learned from running the
  workload
- Look for properties you missed — behaviors, invariants, or failure modes
  that the workload is revealing
- Consider whether existing properties are too broad or too narrow to test
  effectively

### Narrowing

When reach claims fire but properties aren't being tested effectively:

- The feature may need more specific workload patterns to create the exact
  conditions for assertion evaluation
- The assertions may be checking the wrong thing — the invariant is correct
  but the check isn't positioned where the workload drives
- The values may be wrong — the workload reaches the right operations but
  with values that don't exercise the boundaries

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

- Properties that require fault injection
- Properties that require specific scheduling
- Exploring beyond what local concurrency can produce
- Longer runs that cover more state space

**Run duration guidance:**
- Quick check: 10–15 minutes (verify harness works)
- Standard run: 30–60 minutes (normal coverage)
- Deep exploration: 2–4 hours (hard-to-exercise properties)

Start short to verify the harness works, then increase duration as confidence
grows that the workload is exercising the feature effectively.

## Feature Evolution

When the feature changes — new code lands, the spec evolves, requirements
shift — the workload needs to keep up.

### Detecting what changed

- Re-read the feature's code or spec. What's new, modified, or removed?
- Check which existing properties still hold against the current code
- Identify new properties introduced by the changes
- Identify properties that are now obsolete (the feature no longer has
  the behavior they test)

### Updating the workload

- **New properties**: Add assertions and reach claims. For properties on
  unbuilt code, add TDD-style stubs that will fail until the code lands.
- **Changed properties**: Update assertions to match the new behavior. A
  property that was "counter never decreases" might become "counter never
  decreases by more than the rebalance threshold."
- **Obsolete properties**: Remove assertions and reach claims that test
  behavior the feature no longer has. Don't leave dead assertions — they
  produce false positives or never fire.
- **New operations**: Add workload operations to exercise new API surface.
  Update value menus for new code paths.

### Re-validating

After updating, re-validate locally. The same iteration loop applies: check
reach claims, verify assertions, iterate.

## Recording Iterations

After each iteration, update
`antithesis/feature-workloads/<feature-slug>/analysis.md`:

- What was changed and why
- What was observed (reach claims, assertion results, workload behavior)
- Whether properties were revised
- What to try next

This trail is critical — without it, the next iteration starts from scratch
instead of building on what's been learned.
