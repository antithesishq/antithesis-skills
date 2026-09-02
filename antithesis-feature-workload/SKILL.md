---
name: antithesis-feature-workload
description: >-
  Design and build an Antithesis workload for a specific feature: analyze the
  feature, discover its testable properties, build a self-driving workload
  that runs locally and in Antithesis, and iterate until the feature's
  behaviors are exercised and its invariants are checked.
metadata:
  version: 0.0.0
  model_guidance:
    - model: all
      level: required
      instructions: >
        This skill teaches you how to build an Antithesis workload scoped to
        a specific feature. Start from a feature — done or in development —
        understand what it does and what could go wrong, discover testable
        properties, and build a self-driving workload that exercises the
        feature's behaviors and checks its invariants. The workload does NOT
        use Test Composer — it is a self-driving program that runs identically
        locally and in Antithesis.
---

# Build a feature workload for Antithesis

## Purpose and Goal

Start from a specific feature and produce a workload that tests it.
Success means:

- The feature is understood well enough to identify its testable properties
- Properties are concrete and specific — invariants, reachable behaviors,
  failure modes — not vague goals
- A self-driving workload exists that exercises the feature's behaviors
- Reach claims fire, proving the workload reaches the feature's important
  states
- Feature invariants are checked by assertions that use the correct SDK types
- Optionally: the workload has run in Antithesis and findings have been
  verified

This skill is a parallel entry point into the Antithesis workflow. Where the
standard pipeline goes research → setup → workload (broad coverage), this
skill goes feature analysis → targeted workload → iterate (feature focus).

## Entry Points

This skill handles two starting points:

- **Feature is done**: Source code is available. Full analysis, full workload,
  all assertions expected to pass.
- **Feature is in development**: Some code may exist, or just a spec or idea.
  The workload includes TDD-style stubs — assertions that fail until the
  feature catches up. As code lands, assertions go green. The "Update workload
  for feature changes" workflow handles evolution.

Both entry points go through the same workflow. What varies is how many
assertions pass on the first run.

## Prerequisites

- A feature to test — source code, a spec, a description, or a combination
- Access to the SUT source code
- Docker Compose v2 and a container engine (Docker or Podman) for local runs
- `snouty` CLI installed when moving to Antithesis runs (not needed for
  local-only work)

## Relationship to Other Skills

- **antithesis-research**: Feature-workload performs *feature-scoped* analysis
  — the same codebase exploration techniques narrowed to "what could go wrong
  with this feature" rather than "what properties does this entire system
  have." If full research artifacts already exist in the scratchbook, use them
  as context but don't require them.
- **antithesis-workload**: Feature-workload builds self-driving workloads, not
  Test Composer commands. Assertion patterns, value menus, fault-tolerant
  design, and reach claims apply to both — this skill carries its own
  reference material adapted for feature-scoped work.
- **antithesis-setup**: Feature-workload does not assume Antithesis
  infrastructure is or isn't set up. When the user wants to move to Antithesis
  and infrastructure is needed, delegate to `antithesis-setup`.
- **antithesis-launch**: Use to submit Antithesis runs. Do not run
  `snouty launch` directly.
- **antithesis-triage**: Use after each Antithesis run with a focused lens:
  "are the feature's properties being exercised? Any failures?" rather than a
  broad property portfolio review.
- **antithesis-debug**: Use when triage shows a property failure that needs
  deeper investigation — inspect container state at the failure moment,
  time-travel to understand the sequence.

## Definitions

- **SUT:** System under test.
- **Feature property:** A concrete, testable claim about what the feature
  should do, what invariants it should maintain, or what behaviors should be
  reachable.
- **Reach claim:** A `Sometimes` assertion that verifies the workload actually
  exercises a feature behavior. Unfired reach claims mean the workload isn't
  reaching the right states.
- **Self-driving workload:** A single program that drives the SUT, checks
  invariants, and runs without external orchestration. No Test Composer.
- **Dual-mode:** The workload uses SDK assertions when `ANTITHESIS_OUTPUT_DIR`
  is set (Antithesis) and equivalent local checks when it is not (local).

## Documentation Grounding

Use the `antithesis-documentation` skill to access Antithesis docs.

- SDK reference: `https://antithesis.com/docs/reference/sdk.md`
- Properties and assertions: `https://antithesis.com/docs/concepts/properties_assertions/assertions.md`
- Fault injection: `https://antithesis.com/docs/product/fault_injection.md`
- Docker Compose setup: `https://antithesis.com/docs/getting_started/setup_guide/docker_compose.md`

## Reference Files

| Reference                             | When to read                                          |
| ------------------------------------- | ----------------------------------------------------- |
| `references/feature-analysis.md`      | First — system orientation, understanding the feature, discovering properties |
| `references/self-driving-workload.md` | Building the workload                                 |
| `references/assertions.md`            | Writing assertions for feature properties and reach claims |
| `references/interesting-values.md`    | Choosing values that exercise the feature's boundaries |
| `references/faults.md`               | Assessing whether fault injection matters for this feature |
| `references/iteration.md`            | When reach claims aren't firing or properties aren't exercised |
| `references/verification.md`         | Verifying a finding is real                            |

## Recommended Workflows

### Design and build a feature workload

1. Read `references/feature-analysis.md`
2. Orient to the system: if existing research artifacts exist in
   `antithesis/scratchbook/`, read them; otherwise build a lightweight
   orientation scoped to the feature's neighborhood — architecture, data flow,
   concurrency model
3. Understand the feature — from code, spec, conversation, or combination.
   For features in development, identify what's built vs. planned
4. Discover feature properties — invariants, reachable behaviors, failure
   modes. For features in development, properties for unbuilt parts become
   TDD-style stubs
5. Read `references/faults.md` to assess which fault types matter for this
   feature
6. Record findings in
   `antithesis/feature-workloads/<feature-slug>/analysis.md`
7. Read `references/self-driving-workload.md`
8. Read `references/assertions.md`
9. Read `references/interesting-values.md`
10. Build value menus from boundary values and configured-limit families on
    the feature's code paths
11. Design and build the workload: self-driving program with dual-mode
    assertions, fault tolerance, operation tracking, and reach claims for the
    feature's key behaviors
12. Build docker-compose for local runs (or use existing setup)
13. Run locally. Read `references/iteration.md` when reach claims aren't
    firing or properties aren't being exercised. Iterate: check reach claims
    first, then adjust workload, assertions, SUT config, or properties as the
    evidence directs
    - Reach claims not firing → adjust workload or revisit feature
      understanding
    - Properties not being exercised → adjust operations, values, or
      assertions
    - Feature understanding seems wrong → loop back to step 3
14. If moving to Antithesis:
    a. Check existing setup; use `antithesis-setup` if infrastructure is needed
    b. Use `antithesis-launch` for runs
    c. Use `antithesis-triage` for analysis (framed: "are the feature's
       properties being exercised? Any failures?")
    d. Based on triage results: if a property failed, go to step 15; if reach
       claims aren't firing, go to "Iterate after a run"; if the mechanism is
       unclear, use `antithesis-debug` for deeper inspection
15. When a property fails, read `references/verification.md`. Classify the
    finding. Any real bug found while testing a feature is valuable.
16. Document findings in
    `antithesis/feature-workloads/<feature-slug>/analysis.md`

### Iterate after a run

1. Read `references/iteration.md`
2. Read `references/assertions.md` if assertions need to change
3. Check reach claims — are feature behaviors being reached?
4. Choose iteration moves based on what you observe: workload adjustments,
   assertion adjustments, SUT configuration changes, or property revision
5. Update `antithesis/feature-workloads/<feature-slug>/analysis.md` with what
   changed, what was observed, and what to try next

### Update workload for feature changes

For when the feature evolves and the workload needs to keep up:

1. Re-read the feature (what changed in the code or spec)
2. Check which properties still hold, which are new, which are obsolete
3. Update workload, assertions, and reach claims — TDD-style stubs for new
   unbuilt parts, remove stubs for parts that are now built and passing
4. Re-validate locally

## General Guidance

- **One feature at a time.** Don't try to build workloads for multiple
  features simultaneously. Each feature gets its own analysis, workload, and
  iteration cycle.
- **Properties drive the workload.** Every operation, assertion, and value
  choice should connect to a discovered feature property. If work doesn't
  relate to a property, either discover a new property or stop.
- **Reach claims are the compass.** Unfired reach claims tell you the workload
  isn't exercising the feature's key behaviors. Check them first on every
  iteration — before adjusting anything else, make sure the workload is
  reaching the right states.
- **Local is the default starting point.** Start locally unless the feature's
  properties explicitly require Antithesis capabilities (fault injection,
  scheduling control). Local iteration is faster and gives tighter feedback
  loops.
- **Verify before declaring victory.** A property failure is a candidate, not
  a confirmed bug. Read the counterexample. Understand the sequence. Confirm
  the mechanism. Harness bugs, assertion bugs, and workload bugs all produce
  property failures too.
- **Record everything.** The feature-workloads directory is the trail from
  "we have a feature" to "we have a working workload." Future readers need to
  understand what properties were discovered, what was tested, and what was
  found.
- **Design workloads to be fault-tolerant.** Under Antithesis fault injection,
  transient errors are expected. The workload must make progress through
  failures — retry with backoff, reconnect on disconnect, and track what was
  attempted vs what was acknowledged.
- **Keep Antithesis-only code out of production paths.** If you must touch
  shared code for assertions, make the change surgical. SDK assertions no-op
  outside Antithesis, so the production cost is negligible.
- **Write workload code in the project's language** so it can reuse the
  project's clients, helpers, and libraries.
- **The workload grows with the feature.** For in-development features, build
  the full workload with TDD-style stubs for unbuilt parts. Assertions go
  green as code lands. Don't wait for completion to start testing.

## Output

- `antithesis/feature-workloads/<feature-slug>/analysis.md` — feature
  properties, codebase findings, fault assessment, iteration history
- Workload code (self-driving program with dual-mode assertions)
- `docker-compose.yml` for local runs (unless existing setup suffices)
- Assertions targeting feature invariants plus reach claims for feature
  behaviors

## Self-Review

Before declaring this skill complete, review your work against the criteria
below. If your agent supports sub-agents, create a fresh-context reviewer.

Review criteria:

- System orientation was performed — enough understanding of the architecture,
  data flow, and concurrency model to navigate the feature's neighborhood (or
  existing research artifacts were used)
- Feature properties are documented in `analysis.md` and connect to specific
  code paths with evidence from the codebase (or to planned behavior for
  in-development features)
- Each property is concrete and testable — not a vague goal like "test the
  feature" but a specific invariant, reachable behavior, or failure mode
- The workload exercises the feature's key behaviors (verified by reach claims
  that actually fire — or, for in-development features, reach claims for built
  parts fire while stubs for unbuilt parts are clearly marked)
- Assertions use the correct SDK type for their semantics (`Always` /
  `AlwaysOrUnreachable` for invariants, `Sometimes` for reach claims,
  `Reachable` for path reachability) — see `references/assertions.md`
- `Sometimes(true, ...)` assertions should be rewritten as `Reachable(...)`
- The workload is a self-driving program with a single entrypoint, not Test
  Composer commands
- The workload is fault-tolerant — retries transient errors, makes progress
  through failures, doesn't bail on the first error
- The workload tracks attempted vs acknowledged operations so assertions can
  check bounds, not exact values
- The workload is dual-mode — SDK assertions when `ANTITHESIS_OUTPUT_DIR` is
  set, local checks otherwise
- Reach claims assert the precondition, not the violation — they fire when the
  system is correct
- No reach claim is the negation of an `Always` or `AlwaysOrUnreachable` at
  the same site
- Value choices use boundary values and configured-limit families from the
  feature's code paths, not arbitrary ranges — see
  `references/interesting-values.md`
- Assertion property names are inline constant string literals, unique across
  the project — never constructed at runtime
- Randomness in the workload goes through the SDK's random module for
  deterministic replay (standard library random for local mode)
- Randomness shape varies across runs (swarm testing) — probabilities and
  action weights are drawn at the start of each run, not hardcoded
- Workload-only instrumentation was not used where surgical SUT-side
  assertions would provide materially better search guidance for rare,
  dangerous, or timing-sensitive internal states
- Assertions are in workload code or surgical SUT locations — not scattered
  across production paths
- If moving to Antithesis: the `antithesis-setup` skill was used for
  infrastructure, not ad-hoc setup
- If fault types are relevant to the feature's properties: those faults are
  confirmed as enabled for the tenant — see `references/faults.md`
- The feature-workloads directory records what was analyzed, what properties
  were discovered, what was tested, and what was found at each iteration
