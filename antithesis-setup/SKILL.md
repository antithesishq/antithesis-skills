---
name: antithesis-setup
description: >
  Scaffold the Antithesis harness: initialize the working directory, write
  Dockerfiles and docker-compose.yaml with build directives, and prepare
  to submit your first Antithesis test run.
compatibility: Requires docker (or podman) with compose and snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-06-12 74424f4"
---

# Antithesis Setup

## Purpose and Goal

Scaffold the `antithesis/` harness needed to bring the system up in Antithesis
in a mostly idle, ready state.

Success means:

- The deployment definition exists in `antithesis/config/` and references the required SUT images. For the Compose path this is `docker-compose.yaml` with `build:` directives; for the Kubernetes path it is strict k8s manifests packaged in a config image (see `references/kubernetes.md`)
- `snouty validate` on `antithesis/config/` succeeds
- the SUT dependency graph includes the relevant Antithesis SDK where assertions or lifecycle hooks will run
- at least one minimal bootstrap property exists in a simple SUT path and is expected to show up in the first Antithesis run
- The harness is ready for the `antithesis-workload` skill to add or iterate on test templates, assertions, and workload code
- If the user asks to submit or launch a run, use the `antithesis-launch` skill — do not run `snouty launch` directly

## Prerequisites

- **Research artifacts required.** Before proceeding, check whether `antithesis/scratchbook/` exists and contains research output (at minimum `sut-analysis.md` and `deployment-topology.md`). If the scratchbook is missing or empty, **stop and warn the user**:

  > The `antithesis-research` skill has not been run yet (no scratchbook found at `antithesis/scratchbook/`). Setup depends on research artifacts — especially the SUT analysis and deployment topology — to make informed decisions about instrumentation, image structure, and service composition. Please run `antithesis-research` first, review its output, then return to setup.

  Do not attempt to proceed without research artifacts. The setup skill will make significantly worse decisions without the context that research provides.

- **Verify research provenance.** Setup runs once per project and produces durable, expensive output (Dockerfiles, compose, instrumentation), so misalignment is costly. Read whatever provenance frontmatter is present in `antithesis/scratchbook/sut-analysis.md` and `antithesis/scratchbook/deployment-topology.md`. Use whatever fields you find — the schema may evolve over time, so don't treat partial or older frontmatter as broken. Describe what you found in plain language. Examples:

  - Full schema: "this scratchbook is for SUT at `/path/X` at commit `abc12345abcd` (2026-05-05), external refs: A, B."
  - Partial: "the catalog records `commit` and `updated` but no `sut_path` or `external_references`."
  - Absent: "no provenance recorded; the scratchbook predates this convention."
  - Disagreement across files: "sut-analysis is for `/path/A` at commit `abc`; deployment-topology is for `/path/B` at commit `def` — these disagree."

  Then ask the user:

  > Is this still the system you're targeting?

  If the user says no, **do not proceed**. Stop and tell the user to re-run `antithesis-research`. Setup against confirmed-stale research will produce mismatched scaffolding.

  The user-facing commit display uses the short hash (first 12 characters) for readability; the frontmatter still stores the full SHA.

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup/`
- Kubernetes setup guide (for the Kubernetes deployment path): `https://antithesis.com/docs/getting_started/setup_k8s/`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices/`
- Coverage instrumentation: `https://antithesis.com/docs/instrumentation/coverage_instrumentation/`
- Assertion cataloging: `https://antithesis.com/docs/instrumentation/assertion_cataloging/`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies/`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection/`

## Workflow

This skill is broken out into multiple steps, each in a different reference file. Read and implement each reference file listed below one at a time to fully set up a project. After implementing each step, check whether what you learned invalidates any decisions from earlier steps. Instrumentation decisions (step 2) are the most common thing that needs revision once you start building images (step 3).

**Determine the deployment type first.** This decision picks the deployment-definition step (`references/docker-compose.md` vs `references/kubernetes.md`); every other reference applies to both deployment types unchanged. Do not default silently — work through this explicitly:

1. **Is `antithesis/scratchbook/k8s-minimization.md` present?** If yes, this is the **Kubernetes path** — that report is the `antithesis-k8s-onboarding-assistance` skill's output and is the input to `references/kubernetes.md`. Proceed on the k8s path.
2. **If it is absent, check whether the SUT is actually Kubernetes-based before assuming Compose.** Scan the repo for Kubernetes tells: `Chart.yaml` / a `charts/` or `templates/` tree (Helm), `kustomization.yaml` (Kustomize), raw manifests (files with `apiVersion:` + `kind:` Deployment/StatefulSet/Service/etc.), ArgoCD/Flux `Application` resources, or a `k8s/`/`deploy/`/`manifests/` directory.
   - **If you find k8s tells but there is no `k8s-minimization.md`:** the user likely ran setup without first running onboarding. **Stop and tell them.** A Kubernetes SUT must go through `antithesis-k8s-onboarding-assistance` first — it minimizes the production manifests into the report this skill consumes. Setting up a k8s system as Compose, or building k8s manifests without the minimization report, produces broken or grossly oversized scaffolding. Do not proceed on either path until the report exists or the user explicitly confirms the system is not Kubernetes.
   - **If you find no k8s tells:** this is the **Compose path** (the common case). Use `references/docker-compose.md`.
3. **If it is still ambiguous, ask the user** which deployment type applies rather than guessing.

- `references/directory-init.md`: initialize or merge the `antithesis/` directory from `assets/antithesis/`
- `references/instrumentation.md`: decide how each SUT service is instrumented, how the SDK is installed, how symbols are delivered, and where the bootstrap property lives
- `references/docker-images.md`: create or adapt Dockerfiles for SUT components
- `references/docker-compose.md`: **(Compose path)** write `antithesis/config/docker-compose.yaml`
- `references/kubernetes.md`: **(Kubernetes path)** write strict k8s manifests and the config image, using `antithesis/scratchbook/k8s-minimization.md` as input
- `references/config-dir.md`: understand what belongs in `antithesis/config/`
- `references/submit-and-test.md`: test locally and submit the first run

## General Guidance

- Merge with existing `antithesis/` content instead of overwriting it.
- Prefer `podman compose` for local testing; fall back to `docker compose`.
- Keep Antithesis-only scaffolding under `antithesis/` when practical.
- Focus this skill on infrastructure and readiness, not on defining the workload
  itself.
- Installing the relevant Antithesis SDK into the SUT and adding one minimal
  bootstrap assertion is part of setup, not deferred workload work.
- If `antithesis/test/` does not exist yet, create the directory structure
  needed for later workload work, but leave real test templates and assertions
  to `antithesis-workload`.
- Treat instrumentation and symbolization as bootstrap work. The setup is not
  complete until the relevant images expose `/opt/antithesis/catalog/` or
  `/symbols/` correctly for their language.
- Treat local testing as required before the first submission.
- Use `snouty launch` directly to submit runs. Run `compose build` before `snouty launch` to ensure images are up to date.
- Do not add a separate Dockerfile under `antithesis/config/` unless the
  deployment explicitly requires it.
- Disable color/ANSI output in every container. Antithesis stores raw bytes and
  does not render escape codes — color output is garbage in logs and triage. Set
  `NO_COLOR=1` on all services via docker-compose.yaml environment blocks or
  Dockerfile `ENV` directives. Add tool-specific flags (e.g. `FORCE_COLOR=0`)
  where needed.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then systematically check each item below against your actual output.

Review criteria:

The criteria from `antithesis/config/docker-compose.yaml` through the `logging:`/`internal:`/`pull_policy:` rule are **Docker Compose-specific** — apply them only on the Compose path. On the **Kubernetes path**, replace them with the Kubernetes criteria block at the end of this list. The remaining criteria (instrumentation, SDK, bootstrap property, symbols, `setup_complete`, `NO_COLOR`, amd64, workload readiness, research provenance) apply to both.

- `antithesis/config/docker-compose.yaml` exists and every service has `build:` (for local images) or `image:` (for public images) configured correctly
- Every service in docker-compose.yaml includes `platform: linux/amd64`
- Every service has `hostname:` set to match its `container_name:`, and neither contains an underscore (use hyphens — underscores are not valid DNS label characters)
- Every service sets `init: true` so the service process does not run as pid 1
- Cross-service dependencies use `depends_on` with `condition: service_healthy` against a defined `healthcheck`, not plain `depends_on`
- The runtime compose does NOT set a custom `logging:` driver, does not configure any `internal: true` network, and does not set `pull_policy:`
- The instrumentation inventory from `references/instrumentation.md` is fully implemented: each service is instrumented, cataloged-only, or explicitly documented as uninstrumented
- The relevant Antithesis SDK is installed in the SUT dependency graph
- A bootstrap property exists in a simple, guaranteed-to-run code path (not behind rare behavior)
- `/opt/antithesis/catalog/` or `/symbols/` is exposed correctly for each service's language
- The `setup_complete` signal is wired in at least one entrypoint
- `snouty validate` on `antithesis/config/` succeeds
- All built images target `amd64` (verified via `podman image inspect` or `docker image inspect`)
- Every service has `NO_COLOR=1` set in its environment (via docker-compose.yaml and/or Dockerfile) to prevent ANSI escape codes in container output
- The harness is ready for the `antithesis-workload` skill — test template directories exist or are wired for later use
- If the user asks to launch a run, the `antithesis-launch` skill is used instead of running `snouty launch` directly
- Whatever research provenance was present in `sut-analysis.md` and `deployment-topology.md` was described to the user and confirmed before scaffolding began (provenance frontmatter format is defined in the `antithesis-research` skill, `references/scratchbook-setup.md`)

Kubernetes path only (replace the Compose-specific criteria above with these):

- A config image is defined (`FROM scratch` + `COPY manifests/ /manifests/`) and `antithesis/config/manifests/` contains the deployment YAML
- The manifests are strict Kubernetes manifests — not Helm charts or Kustomize overlays (any chart/overlay source was rendered to static YAML, consistent with the inventory in `antithesis/scratchbook/k8s-minimization.md`)
- Every resource sets `namespace` explicitly, and every required resource (Namespace, ServiceAccount, RoleBinding, etc.) is included
- Every container sets `imagePullPolicy: Never` explicitly; images are referenced by digest or a specific tag (prefer a stable tag over `latest`)
- Workloads are Deployments/StatefulSets (not bare Pods), with readiness probes and conservatively-tuned liveness probes so `kapp` can determine when the deployment is up
- `resources.requests` are set on all containers and stay within the aggregate limits (under 1 CPU and 10 GiB total); PVCs use `local-path` (or blank) and `ReadWriteOnce`
- No multi-node-only constructs (pod anti-affinity, topology spread), `LoadBalancer` Services, `hostPath`/RWX volumes, privileged containers, hardcoded IPs/CIDRs, or duplicate resource names — see `references/kubernetes.md` for the full Do/Don't list
- If the deployment includes operators that spawn pods from custom resources, the user was told those images are not image-inferred and must be provisioned explicitly
- If `setup_complete` relies on `kapp` success, any depended-on custom resources expose ready status conditions; otherwise `setup_complete` is emitted from the SDK
- If the minimization report classified any dependencies as *dependency-stub*, the user was told those stub services are not generated by this skill (out of scope for now) and the SUT may not reach `setup_complete` without them — they were not silently dropped
