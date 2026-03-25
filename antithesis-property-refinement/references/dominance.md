# Resolving Dominance Relationships

## Goal

Confirm or reject every suspected dominance relationship in the selected
property set. After this step, each suspected dominance pair has a definitive
answer with code evidence.

## What Dominance Means

Property A dominates property B if every way B can fail also causes A to fail.
If there is any scenario where B is violated but A still holds, A does not
dominate B.

Dominance means testing A inherently covers B — any input or fault sequence that
would catch a violation of B would also catch a violation of A.

## Approach

Use a single agent for all dominance resolution in the selected set. Dominance
is a graph problem — the agent needs to see all pairs to reason about
transitivity (if A dominates B and B dominates C, then A dominates C).

The agent receives:

- The suspected dominance pairs from `antithesis/scratchbook/property-relationships.md`
  (only those involving properties in the selected set)
- The evidence files for all properties in the selected set (post-investigation,
  with open questions resolved)
- Access to the codebase

Instructions for the agent:

> For each suspected dominance pair (A dominates B), determine whether the
> dominance holds by checking B's failure modes against A's invariant:
>
> 1. From B's evidence file, enumerate every way B can be violated — the failure
>    scenarios, crash windows, and code paths that break B's invariant.
> 2. For each failure mode of B, trace the code to determine: does this failure
>    also violate A's invariant?
> 3. If all of B's failure modes also violate A → dominance confirmed.
> 4. If any failure mode of B does not violate A → dominance rejected.
>
> For each pair, return:
> - Confirmed or rejected
> - The specific failure modes of B that were checked
> - For confirmed: why each failure mode of B necessarily violates A
> - For rejected: the specific failure mode of B that does not violate A,
>   with the code evidence showing B can fail while A holds
>
> After resolving individual pairs, check for transitive dominance. If A
> dominates B and B dominates C, note that A transitively dominates C.
>
> Also watch for suspected dominance that the relationship map missed — if
> during your analysis you find that A dominates B but this was not flagged
> as suspected, report it.

## After Dominance Resolution

- Update the relationship map with confirmed/rejected findings and evidence
- For confirmed dominance: update both evidence files to document the
  relationship. Mark the dominated property in the catalog as dominated, with a
  reference to the dominating property and the reasoning.
- For rejected dominance: update the relationship map to explain why the
  suspected dominance does not hold. Both properties remain active.

## Dominance Is Not Dependency

Cross-property dependencies are not dominance. "A is a precondition for B" means
B cannot hold unless A holds — but that does not mean testing A covers B. They
exercise different invariants. Both need testing.

For example: "writes are replicated" is a precondition for "writes survive
failover," but testing replication does not test failover recovery. The failure
modes are different.

## Dominance Is Not Description Overlap

Two properties can have overlapping descriptions but exercise different code
paths. "Acknowledged writes survive leader failover" and "acknowledged writes
survive graceful shutdown" sound similar but exercise different code — one tests
crash recovery, the other tests the shutdown drain path. Neither dominates the
other because each has failure modes the other doesn't cover.
