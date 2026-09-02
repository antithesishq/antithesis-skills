---
name: antithesis-bug-hunt
description: >-
  Hunt for a specific bug using Antithesis: analyze the bug report, build a
  targeted reproduction workload, iterate locally and in Antithesis until the
  bug is found and verified.
metadata:
  version: 0.0.0
  model_guidance:
    - model: all
      level: required
      instructions: >
        This skill teaches you how to hunt for a specific known bug using
        Antithesis. Start from a bug report or description, understand how
        the bug could happen in the codebase, build a targeted workload to
        trigger it, and iterate until you have a verified reproduction. The
        workload does NOT use Test Composer — it is a self-driving program
        that runs identically locally and in Antithesis.
---

# Hunt for a specific bug with Antithesis

## Purpose and Goal

Start from a known or suspected bug and produce a verified reproduction.
Success means:

- The system is understood well enough to navigate the bug's neighborhood
- The bug's trigger conditions are understood from targeted codebase analysis
- A self-driving workload exists that exercises the bug's preconditions
- The bug has been triggered and verified as a real SUT defect (not a harness
  problem)
- Optionally: a local reproduction exists that demonstrates the bug outside
  Antithesis

This skill is a parallel entry point into the Antithesis workflow. Where the
standard pipeline goes research → setup → workload (broad coverage), bug-hunt
goes system orientation → targeted research → reproduction workload → find
the bug (narrow focus).

## Entry Points

This skill handles several starting points:

- **An open bug report** from an issue tracker or a user description
- **A closed bug to verify** — prove the fix actually holds, or prove it
  doesn't
- **A suspected weakness** — a concern about a system area that hasn't been
  confirmed as a specific bug yet

All entry points go through the same phases; the targeted research reference
adapts to each.

## Prerequisites

- A bug report, issue, description, or closed bug to verify
- Access to the SUT source code
- Docker Compose v2 and a container engine (docker or podman) for local
  reproduction
- `snouty` CLI installed when moving to Antithesis runs (not needed for
  local-only work)

## Relationship to Other Skills

- **antithesis-research**: Bug-hunt performs *targeted* research — the same
  codebase exploration techniques scoped to "how could this bug happen" rather
  than "what properties does this system have." If full research artifacts
  already exist in the scratchbook, use them as context but don't require them.
- **antithesis-workload**: Bug-hunt builds workloads but does NOT use Test
  Composer. The workload is a self-driving program that runs identically
  locally and in Antithesis. Assertion patterns, value menus, fault-tolerant
  design, and reach claims from the workload skill all apply — this skill
  carries its own reference material for these topics, adapted for the
  bug-hunt context.
- **antithesis-setup**: Bug-hunt owns enough docker-compose to run the SUT
  locally. When moving to Antithesis, delegate to `antithesis-setup` for
  Antithesis-specific infrastructure (config images, instrumentation,
  registry).
- **antithesis-launch**: Use to submit Antithesis runs. Do not run
  `snouty launch` directly.
- **antithesis-triage**: Use after each Antithesis run with a focused lens:
  "did this specific bug trigger?" rather than a broad property portfolio
  review.
- **antithesis-debug**: Use when triage shows a property failure that needs
  deeper investigation — inspect container state at the failure moment,
  time-travel to understand the sequence.

## Definitions

- **SUT:** System under test.
- **Trigger hypothesis:** A specific, testable claim about what conditions
  cause the bug — what operations, what state, what timing or faults.
- **Reach claim:** A `Sometimes` assertion that verifies the workload actually
  reaches the bug's preconditions. Unfired reach claims mean the workload
  isn't exercising the right paths.
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
| `references/targeted-research.md`     | First — system orientation, understanding the bug, forming the trigger hypothesis |
| `references/self-driving-workload.md` | Building the workload                                 |
| `references/assertions.md`            | Writing assertions for the bug condition and reach claims |
| `references/interesting-values.md`    | Choosing values that make the bug more likely          |
| `references/faults.md`               | Assessing whether fault injection is needed and which types |
| `references/iteration.md`            | When the bug doesn't trigger                           |
| `references/verification.md`         | Verifying a finding is real                            |

## Recommended Workflows

### Hunt a bug

1. Read `references/targeted-research.md`
2. Orient to the system (Step 1 of that reference): if existing research
   artifacts exist in `antithesis/scratchbook/`, read them; otherwise build
   a lightweight orientation — architecture, data flow, deployment topology,
   concurrency model — scoped to the bug's neighborhood
3. Understand the bug (Step 2): parse the bug report, validate it, or
   examine the fix if hunting a closed bug. For a suspected weakness, go
   straight to codebase exploration
4. Explore the codebase (Step 3): trace the symptom path, examine
   concurrency, state management, error handling, and unproven assumptions
   relevant to the bug
5. Form a trigger hypothesis and classify: locally reproducible vs needs
   Antithesis
6. Read `references/faults.md` to assess whether fault injection is needed
   and which fault types are relevant
7. Re-evaluate the trigger hypothesis against the faults assessment: if
   required faults are unavailable, revise the hypothesis or reclassify
   before building
8. Record findings in `antithesis/bug-hunt/<bug-slug>/analysis.md`
9. Read `references/self-driving-workload.md`
10. Read `references/assertions.md`
11. Read `references/interesting-values.md`
12. Design and build the workload: self-driving program with dual-mode
    assertions, fault tolerance, operation tracking, and reach claims for the
    bug's preconditions
13. Build value menus from boundary values and configured-limit families on the
    bug's code paths
14. Write docker-compose for local reproduction (minimal — only the services
    needed to trigger the bug)
15. Run locally. Read `references/iteration.md` when the bug doesn't trigger.
    Iterate: check reach claims first, then adjust workload, assertions, SUT
    config, or hypothesis as the evidence directs
16. If moving to Antithesis:
    a. Use `antithesis-setup` for infrastructure
    b. Use `antithesis-launch` for runs
    c. Use `antithesis-triage` for analysis (framed with focused lens: "did
       this specific bug trigger? Are the reach claims firing?")
    d. Based on triage results: if a property failed, go to step 17; if reach
       claims aren't firing, go to "Iterate after a run"; if the mechanism is
       unclear, use `antithesis-debug` for deeper inspection
17. When a property fails, read `references/verification.md`. Classify the
    finding. Continue the hunt if it's not the target bug.
18. For a confirmed real bug, document the reproduction in
    `antithesis/bug-hunt/<bug-slug>/reproduction.md`
19. Offer to pursue local back-port if the bug was found in Antithesis and
    local reproduction is feasible

### Iterate after a run

1. Read `references/iteration.md`
2. Read `references/assertions.md` if assertions need to change
3. Check reach claims — are preconditions being reached?
4. Choose iteration moves based on what you observe: workload adjustments,
   assertion adjustments, SUT configuration changes, or hypothesis revision
5. Update `antithesis/bug-hunt/<bug-slug>/analysis.md` with what changed,
   what was observed, and what to try next

## General Guidance

- **One bug at a time.** Don't try to hunt multiple bugs simultaneously.
  Each bug gets its own analysis, workload, and iteration cycle.
- **The trigger hypothesis drives everything.** Every workload design
  decision, every assertion, every iteration move should connect back to the
  hypothesis about how the bug triggers. If you find yourself doing work that
  doesn't relate to the hypothesis, either update the hypothesis or stop.
- **Reach claims are the compass.** Unfired reach claims tell you the
  workload isn't reaching the bug's preconditions. Check them first on every
  iteration — before adjusting anything else, make sure the workload is
  exercising the right paths.
- **Local is the default starting point.** Start locally unless the trigger
  hypothesis explicitly requires Antithesis capabilities (fault injection,
  scheduling control). Local iteration is faster and gives tighter feedback
  loops.
- **Verify before declaring victory.** A property failure is a candidate, not
  a confirmed bug. Read the counterexample. Understand the sequence. Confirm
  it matches the reported bug. Harness bugs, assertion bugs, and workload
  bugs all produce property failures too.
- **Record everything.** The bug-hunt directory is the trail from "we have a
  report" to "we have a reproduction." Future readers need to understand what
  was tried, what was found, and what was ruled out.
- **Design workloads to be fault-tolerant.** Under Antithesis fault injection,
  transient errors are expected. The workload must make progress through
  failures — retry with backoff, reconnect on disconnect, and track what
  was attempted vs what was acknowledged.
- **Keep Antithesis-only code out of production paths.** If you must touch
  shared code for assertions, make the change surgical. SDK assertions no-op
  outside Antithesis, so the production cost is negligible.
- **Write workload code in the project's language** so it can reuse the
  project's clients, helpers, and libraries.

## Output

- `antithesis/bug-hunt/<bug-slug>/analysis.md` — trigger hypothesis, codebase
  findings, classification
- `antithesis/bug-hunt/<bug-slug>/reproduction.md` — verified reproduction
  details (when the bug is found)
- Workload code (self-driving program with dual-mode assertions)
- `docker-compose.yml` for local reproduction
- Assertions targeting the specific bug condition plus reach claims for
  preconditions

## Self-Review

Before declaring the hunt complete, review your work against these criteria.
If your agent supports sub-agents, create a fresh-context reviewer.

Review criteria:

- System orientation was performed — enough understanding of the architecture,
  data flow, deployment topology, and concurrency model to navigate the bug's
  neighborhood (or existing research artifacts were used)
- The trigger hypothesis is documented in `analysis.md` and connects the bug
  to specific code paths with evidence from the codebase
- For open bug reports: the report was validated as a real defect — competing
  explanations (reporter's environment, config, misunderstanding) were
  considered and the discriminating evidence recorded
- For closed bugs: the fix was examined — what it covers, what edges it might
  miss, and the trigger hypothesis targets conditions the fix may not handle
- The workload exercises the bug's preconditions (verified by reach claims
  that actually fire)
- Assertions use the correct SDK type for their semantics (`Always` /
  `AlwaysOrUnreachable` for the bug condition, `Sometimes` for reach claims,
  `Reachable` for path reachability) — see `references/assertions.md`
- The workload is a self-driving program with a single entrypoint, not
  Test Composer commands
- The workload is fault-tolerant — retries transient errors, makes progress
  through failures, doesn't bail on the first error
- The workload tracks attempted vs acknowledged operations so assertions can
  check bounds, not exact values
- The workload is dual-mode — SDK assertions when `ANTITHESIS_OUTPUT_DIR` is
  set, local checks otherwise
- Reach claims assert the precondition, not the violation — they fire when
  the system is correct
- Value choices use boundary values and configured-limit families from the
  bug's code paths, not arbitrary ranges — see `references/interesting-values.md`
- Assertion property names are inline constant string literals, unique across
  the project — never constructed at runtime
- Randomness in the workload goes through the SDK's random module for
  deterministic replay (standard library random for local mode)
- Randomness shape varies across runs (swarm testing) — probabilities and
  action weights are drawn at the start of each run, not hardcoded
- If the bug was found: the finding is classified per `references/verification.md`
  and the verification reasoning is documented in `reproduction.md`
- If the finding is classified as a real SUT bug: the documented mechanism
  connects the observed sequence of events to the reported symptoms
- If moving to Antithesis: the `antithesis-setup` skill was used for
  infrastructure, not ad-hoc setup
- If fault types are required by the trigger hypothesis: those faults are
  confirmed as enabled for the tenant — see `references/faults.md`
- The bug-hunt directory records what was tried, what was found, and what was
  ruled out at each iteration
