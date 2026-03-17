# Assertions

## Goal

Map each property in the catalog to a concrete Antithesis SDK assertion. Some assertions belong in workload code; others belong inside the SUT.

## Match the Assertion to the Property Type

- **`Always` / `AlwaysOrUnreachable`**: Use for safety and correctness properties. Example: a balance never goes negative.
- **`Sometimes`**: Use for liveness properties and for proving the workload reaches interesting states. Example: leader election completes at least once.
- **`Reachable` / `Unreachable`**: Use for code-path or behavior coverage. `Reachable` checks workload expressiveness; `Unreachable` guards against critical failure paths.

## Assertion Placement

- **Workload-level assertions:** Use for request/response invariants and client-visible guarantees.
- **Deep assertions:** Use for internal invariants the workload cannot observe directly.
- Keep deep assertions surgical and minimize SUT edits.

## Use Deterministic Randomness

All randomness in test workloads must go through the Antithesis SDK's random module for deterministic replay. This applies to workload code, not the SUT itself.

## Naming

Give assertions clear, descriptive names. These names appear in triage reports, so they should be immediately understandable.
