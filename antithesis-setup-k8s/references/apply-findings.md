# Apply Findings

How to apply the findings determined in the horizontal and vertical classification to simplify our Kubernetes SUT.

## Requirements

`antithesis/scratchbook/k8s-minimization/working.md` with completed Horizontal classification and Component inventory sections.

## Steps

1. Drop any component that is seemingly out-of-scope
2. For every kept component, apply the **Decisions** listed in the `working.md`. This could be a keep, simplify, drop, or replace.
<!-- perhaps we want to drop dependency stub components -->
3. Re-read the working file after editing to confirm no kept component lost a dependency that is required.


Apply the changes onto the Kubernetes manifests listed in `antithesis/config/manifests/`. This should minimize the Kubernetes manifests so that the SUT is able to run in Antithesis.
