---
name: antithesis-setup-k8s
description: >
  Scaffold the Antithesis harness for customers running Kubernetes:  Convert helm charts, kustomize templates, or raw Kubernetes manifests into a minimized set of manifests for Antithesis. Verify the Kubernetes manifests are in the correct shape with snouty validate and a local cluster deploy. Hands it off to antithesis-launch if the user wants to submit a run. At the end, the user is ready to run antithesis-workload to build tests. If the desired setup is docker-compose, defer to the antithesis-setup skill.
compatibility: Requires snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-06-22 23dabcd"
---

# Antithesis K8s Setup

## Purpose and Goal

Scaffold the `antithesis/` harness needed to bring the system up in Antithesis in a mostly idle, ready state.

Success means:

- The deployment definition exists in `antithesis/config/manifests/` and references the required SUT images. This is a collection of raw Kubernetes manifests (no helm, no kustomize)
- `antithesis/config/manifests/` is a minimized setup of the k8s-based SUT that is required for the Antithesis run
- `snouty validate` on `antithesis/config/` succeeds
- The harness is ready for the `antithesis-workload` skill to add or iterate on test templates, assertions, and workload code
- If the user asks to submit or launch a run, use the `antithesis-launch` skill — do not run `snouty launch` directly

## Prerequisites

- The user must have a collection of Kubernetes artifacts. This can be a helm chart, kustomize templates, or Kubernetes manifests.
  - If the user has a helm chart, they must provide a values file that can be templated into the helm chart. This can be in the form of a standard `values.yaml`, an ArgoCD Application with a values field, or a FluxCD HelmRelease with a values field.
  - If the user has a collection of helm charts, determine what subset (ideally a single one or a couple to make one standalone application) of helm charts will be the system under test in Antithesis. You may have to ask the user which one they want. Do not infer what the single target SUT is. 

- The user must have already pushed up images to the antithesis registry or is using public images. The images that should be pushed up are all the images that are required to run the templatized helm chart. There are instructions for this in `references/manifests.md` 

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

- This skill runs `kubectl`, `kind`, `k3s`, `kapp` to touch an active Kubernetes cluster to validate that the manifests are able to come up in a Kubernetes environment. Ask the user before running any of these commands. The skill should only touch Kubernetes resources that it has created and should clean up all resources it creates before exiting.

- This skill may have to run `helm` or `kustomize` commands to template out manifests.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Kubernetes setup guide: `https://antithesis.com/docs/getting_started/setup_guide/setup_k8s.md`
- Kubernetes best practices: `https://antithesis.com/docs/best_practices/k8s_best_practices.md`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`

## Workflow

This skill is broken out into multiple steps, each in a different reference file. Read and implement each reference file listed below one at a time to fully set up a project. After implementing each step, check whether what you learned invalidates any decisions from earlier steps - if it does, return to that step and redo it before proceeding. The horizontal-classification and vertical-classifications require a working file that will be applied to the manifests during the apply-findings stage. Keep these findings in case analysis is required of what changed when using the setup in Antithesis.

At the beginning of running the skill, ask the user if they would like to start from scratch or continue from a past iteration.

### Pipeline (run in order, but reopen an earlier pass when a later one contradicts it)

- `references/directory-init.md`: initialize the `antithesis/` directory. This will contain a collection of Kubernetes manifests that will run in Antithesis
- `references/manifests.md`: constructs `antithesis/config/manifests/` as a collection of raw kubernetes manifests generated from the customers Kubernetes templates
- `references/horizontal-classification.md`: attempts to figure out which parts of the system are necessary to test
- `references/vertical-classification.md`: drops certain manifests that do not enhance the Antithesis Kubernetes experience
- `references/apply-findings.md`: applies the findings from the classification steps to the manifests to simplify the setup
- `references/validate-snouty.md`: runs `snouty validate` on the manifests and performs a static analysis
- `references/validate-local.md`: deploys the Kubernetes manifests to a local k3s cluster to ensure SUT is functional
- `references/submit.md`: test locally and submit the first run

These stages of the pipeline are NOT one-way gates. If any parts reveal a classification decision earlier was wrong, go back and re-run the affected earlier pass and update `working.md`.

Additionally, the `validate-local.md` step may be skipped by the user. If the user skips a step, make sure to record that the step is skipped and continue with the skill. Do not exit early and say that the task is complete until all parts have been completed.

### Reference catalogs (from the steps above)

- `references/landmines.md`: identifies classes of manifests that are detrimental to the Antithesis Kubernetes experience
- `references/operator-recipes.md`: recipes for expanding operator managed custom resources into primitives - used during vertical-classification.

## Reference

**SUT**
System under test.

**snouty validate**
Use this command to quickly validate changes to the Antithesis scaffolding. See `snouty validate --help` for details.

**working file** 
Live, growing artifact across passes (`antithesis/scratchbook/k8s-minimization/working.md`)

**landmine** 
A platform-layer construct that is commonly minimized away, with a known recipe (Istio, cert-manager, external-secrets, etc.)

