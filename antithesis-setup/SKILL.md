---
name: antithesis-setup
description: >
  Scaffold the Antithesis harness with docker-compose: initialize the working directory, write
  Dockerfiles and docker-compose.yaml with build directives, and prepare
  to submit your first Antithesis test run. If the desired setup is Kubernetes, defer to the antithesis-setup-k8s skill.
compatibility: Requires docker (or podman) with compose and snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-07-07 38a11c4"
---

# Antithesis Setup

## Purpose and Goal

Scaffold the `antithesis/` harness needed to bring the system up in Antithesis
in a mostly idle, ready state.

Success means:

- `antithesis/config/docker-compose.yaml` exists and required SUT images are referenced with `build:` directives
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

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup_guide/docker_compose.md`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
- Coverage instrumentation: `https://antithesis.com/docs/reference/instrumentation/coverage_instrumentation.md`
- Assertion cataloging: `https://antithesis.com/docs/reference/sdk/assertion_cataloging.md`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Fault injection: `https://antithesis.com/docs/concepts/fault_injection.md`

## Workflow

This skill is broken out into multiple steps, each in a different reference file. Read and implement each reference file listed below one at a time to fully set up a project. After implementing each step, check whether what you learned invalidates any decisions from earlier steps. Instrumentation decisions (step 2) are the most common thing that needs revision once you start building images (step 3).

- `references/directory-init.md`: initialize or merge the `antithesis/` directory from `assets/antithesis/`
- `references/instrumentation.md`: decide how each SUT service is instrumented, how the SDK is installed, how symbols are delivered, and where the bootstrap property lives
- `references/docker-images.md`: create or adapt Dockerfiles for SUT components
- `references/docker-compose.md`: write `antithesis/config/docker-compose.yaml`
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
- Use the `antithesis-launch` skill to submit runs, do not run `snouty launch` directly. If the `antithesis-launch` skill is not present, then use `snouty launch` directly to submit runs. Run `compose build` before `snouty launch` to ensure images are up to date.
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
