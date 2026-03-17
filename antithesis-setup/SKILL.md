---
name: antithesis-setup
description: >
  Scaffold the Antithesis harness: initialize the working directory, write
  Dockerfiles and docker-compose.yaml with build directives, and prepare
  submission scripts for local testing and Antithesis runs via snouty.
keywords:
  - antithesis
  - setup
  - docker
  - docker-compose
  - infrastructure
  - scaffold
---

# Antithesis Setup

## Purpose and Goal

Scaffold the `antithesis/` harness needed to bring the system up in Antithesis
in a mostly idle, ready state.

Success means:

- `antithesis/config/docker-compose.yaml` exists and required SUT images are referenced with `build:` directives
- `snouty validate antithesis/config/` succeeds
- The harness is ready for the `antithesis-workload` skill to add or iterate on test templates, assertions, and workload code

## Prerequisites

Expect a deployment topology and property catalog, usually in the Antithesis notebook at `antithesis/notebook/`. If they do not exist, use the `antithesis-research` skill first.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup.md`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`

## Workflow

This skill is broken out into multiple steps, each in a different reference file. Read and implement each reference file listed below one at a time to fully set up a project.

- `references/directory-init.md`: initialize or merge the `antithesis/` directory from `assets/antithesis/`
- `references/docker-images.md`: create or adapt Dockerfiles for SUT components
- `references/docker-compose.md`: write `antithesis/config/docker-compose.yaml`
- `references/config-dir.md`: understand what belongs in `antithesis/config/`
- `references/submit-and-test.md`: test locally and submit the first run

## General Guidance

- Merge with existing `antithesis/` content instead of overwriting it.
- Prefer `podman compose` for local testing; fall back to `docker compose`.
- Keep Antithesis-only scaffolding under `antithesis/` when practical.
- Focus this skill on infrastructure and readiness, not on defining the workload itself.
- If `antithesis/test/` does not exist yet, create the directory structure needed for later workload work, but leave real test templates and assertions to `antithesis-workload`.
- Resolve `ANTITHESIS_REPOSITORY` before writing `${ANTITHESIS_REPOSITORY}/...` image tags. If it is not readable from the current environment, ask the user for the registry value and tell them it must be exported in the environment before running `snouty run`.
- Treat local testing as required before the first submission.
- Do not add a separate Dockerfile under `antithesis/config/` unless the deployment explicitly requires it.
