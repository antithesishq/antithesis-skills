---
name: antithesis-setup
description: >
  Scaffold the Antithesis harness: initialize the working directory, write
  Dockerfiles and docker-compose.yaml with build directives, and prepare
  to submit your first Antithesis test run.
keywords:
  - antithesis
  - setup
  - docker
  - docker-compose
  - infrastructure
  - scaffold
  - bootstrap
---

# Antithesis Setup

## Purpose and Goal

Scaffold the `antithesis/` harness needed to bring the system up in Antithesis
in a mostly idle, ready state.

Success means:

- `antithesis/config/docker-compose.yaml` exists and required SUT images are referenced with `build:` directives
- `snouty validate antithesis/config/` succeeds
- the SUT dependency graph includes the relevant Antithesis SDK where assertions or lifecycle hooks will run
- at least one minimal bootstrap property exists in a simple SUT path and is expected to show up in the first Antithesis run
- The harness is ready for the `antithesis-workload` skill to add or iterate on test templates, assertions, and workload code

## Prerequisites

Expect a deployment topology and property catalog, usually in the Antithesis notebook at `antithesis/notebook/`. If they do not exist, use the `antithesis-research` skill first.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup/`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices/`
- Coverage instrumentation: `https://antithesis.com/docs/instrumentation/coverage_instrumentation/`
- Assertion cataloging: `https://antithesis.com/docs/instrumentation/assertion_cataloging/`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies/`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection/`

## Workflow

This skill is broken out into multiple steps, each in a different reference file. Read and implement each reference file listed below one at a time to fully set up a project.

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
- Focus this skill on infrastructure and readiness, not on defining the workload itself.
- Installing the relevant Antithesis SDK into the SUT and adding one minimal bootstrap assertion is part of setup, not deferred workload work.
- If `antithesis/test/` does not exist yet, create the directory structure needed for later workload work, but leave real test templates and assertions to `antithesis-workload`.
- Treat instrumentation and symbolization as bootstrap work. The setup is not complete until the relevant images expose `/opt/antithesis/catalog/` or `/symbols/` correctly for their language.
- Resolve `ANTITHESIS_REPOSITORY` before writing `${ANTITHESIS_REPOSITORY}/...` image tags. If it is not readable from the current environment, ask the user for the registry value and tell them it must be exported in the environment before running `snouty run`.
- Treat local testing as required before the first submission.
- Prefer a checked-in submission wrapper such as `antithesis/submit.sh` over telling agents to run raw `snouty run`. The wrapper should own the required `compose build` step.
- Do not add a separate Dockerfile under `antithesis/config/` unless the deployment explicitly requires it.
