# Iteration

## Goal

Use triage results to improve the workload: fix assertions, expand coverage, and add missing properties.

## When to Use This

After running `antithesis-triage` on a completed test run and reviewing the results.

## Triage-to-Improvement Loop

1. Review which properties passed, failed, or were unfound.
2. For failed properties, decide whether the problem is a SUT bug, a flawed assertion, or a workload gap.
3. For unfound properties, add or adjust commands until the relevant code paths become reachable. Use `Sometimes` assertions as canary checks when needed.
4. For newly discovered behaviors, add new properties and assertions and record them in the Antithesis scratchbook.

## Common Improvements

- Add `Sometimes` assertions to verify the workload exercises rare but important paths.
- Add new `parallel_driver_` commands to generate more diverse load patterns.
- Add `anytime_` validation commands to check invariants under active fault injection.
- Refine `Always` assertions that are too broad or too narrow.
- Add `Reachable` assertions to confirm the workload covers expected code paths.

## Update the Antithesis scratchbook

Update `antithesis/scratchbook/property-catalog.md` whenever properties are added or changed.

## Cross-Reference

Use `antithesis-research` if triage reveals a new subsystem, guarantee, or failure mode that needs fresh research.
