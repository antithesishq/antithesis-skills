# Iteration

## Goal

Use triage results to improve the workload: fix assertions, expand coverage, and add missing properties.

## When to Use This

After running `antithesis-triage` on a completed test run and reviewing the results.

## Triage-to-Improvement Loop

1. Review which properties passed, failed, or were unfound.
2. For failed properties, decide whether the problem is a SUT bug, a flawed assertion, or a workload gap.
3. For unfound properties, check whether Sometimes reach claims (see `assertions.md`, "Sometimes Assertions as Workload Reach Claims") cover the relevant behaviors. Unfired Sometimes assertions are the sharpest signal — each one names a behavior the workload was designed to drive but did not. Use them as the prioritized list of what to fix: add or adjust commands until the unfired assertions start firing. When no reach claims exist for the unfound property, add them as part of the fix so the next run has the signal.
4. Before you treat an unfired reach claim as a coverage gap, confirm that it is a precondition claim and not the negation of an `Always` or `AlwaysOrUnreachable` at the same site. The negation of a green `Always` cannot fire, so it proves nothing about coverage, and the paired `Always` is not vacuous. Fix the reach claim instead of the workload — see `assertions.md`, "A Reach Claim Asserts The Precondition, Never The Violation".
5. When extra guidance is needed beyond workload changes, prefer targeted `Reachable(...)`, `Unreachable(...)`, or non-trivial `Sometimes(cond, ...)` assertions in the SUT over generic workload-side canaries.
6. For newly discovered behaviors, add new properties and assertions and record them in the Antithesis scratchbook.

## Common Improvements

- Add non-trivial `Sometimes(cond)` assertions when a semantic state should occur at least once.
- Add new `parallel_driver_` commands to generate more diverse load patterns.
- Vary probability and action weights across timelines — see `test-commands.md`, "Vary randomness across timelines".
- Refine the menu axis (the values your workload draws from) — see `interesting-values.md`.
- Add `anytime_` validation commands to check invariants under active fault injection.
- Refine `Always` assertions that are too broad or too narrow.
- Add `Reachable` assertions to confirm the workload or SUT covers expected outcomes and branch results.
- Remove redundant early reachability markers when later outcome markers already provide the sharper signal.

## Update the Antithesis scratchbook

Update `antithesis/scratchbook/property-catalog.md` whenever properties are added or changed — refresh `commit` and `updated` in the provenance frontmatter; preserve `sut_path` and `external_references` from the existing catalog. The frontmatter format is defined in the `antithesis-research` skill, `references/scratchbook-setup.md`. For new properties, write a corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md`. For changed properties, update the existing evidence file to reflect the new understanding.

When the work resolves an open question on a property (or surfaces a new one), keep the Open Questions list under the property in sync with the evidence file. See the `antithesis-research` skill, `references/property-catalog.md` ("Open Questions Conventions").

## Cross-Reference

Use `antithesis-research` if triage reveals a new subsystem, guarantee, or failure mode that needs fresh research.
