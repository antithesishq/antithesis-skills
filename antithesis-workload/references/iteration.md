# Iteration

## Goal

Use triage results to improve the workload: fix assertions, expand coverage, and add missing properties.

## When to Use This

After running `antithesis-triage` on a completed test run and reviewing the results.

## Triage-to-Improvement Loop

1. Review which properties passed, failed, or were unfound.
2. For failed properties, decide whether the problem is a SUT bug, a flawed assertion, or a workload gap.
3. For unfound properties, add or adjust commands until the relevant code paths become reachable. When extra guidance is needed, prefer targeted `Reachable(...)`, `Unreachable(...)`, or non-trivial `Sometimes(cond, ...)` assertions in the SUT over generic workload-side canaries.
4. For newly discovered behaviors, add new properties and assertions and record them in the Antithesis scratchbook.

## Common Improvements

- Add non-trivial `Sometimes(cond)` assertions when a semantic state should occur at least once.
- Add new `parallel_driver_` commands to generate more diverse load patterns.
- Add `anytime_` validation commands to check invariants under active fault injection.
- Refine `Always` assertions that are too broad or too narrow.
- Add `Reachable` assertions to confirm the workload or SUT covers expected outcomes and branch results.
- Remove redundant early reachability markers when later outcome markers already provide the sharper signal.

## Update the Antithesis scratchbook

Update `antithesis/scratchbook/property-catalog.md` whenever properties are added or changed — refresh `commit` and `updated` in the provenance frontmatter; preserve `sut_path` and `external_references` from the existing catalog. The frontmatter format is defined in the `antithesis-research` skill, `references/scratchbook-setup.md`. For new properties, write a corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md`. For changed properties, update the existing evidence file to reflect the new understanding.

When the work resolves an open question on a property (or surfaces a new one), keep the Open Questions list under the property in sync with the evidence file. See the `antithesis-research` skill, `references/property-catalog.md` ("Open Questions Conventions").

## Cross-Reference

Use `antithesis-research` if triage reveals a new subsystem, guarantee, or failure mode that needs fresh research.
