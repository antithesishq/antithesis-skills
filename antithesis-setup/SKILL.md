---
name: antithesis-setup
description: >
  Scaffold the Antithesis harness: initialize the working directory, write
  Dockerfiles and docker-compose.yaml with build directives, and prepare
  to submit your first Antithesis test run.
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
- If the user asks to submit or launch a run, use the `antithesis-launch` skill — do not run `snouty run` directly

## Prerequisites

- DO NOT PROCEED if the Antithesis scratchbook (usually at `antithesis/scratchbook/`) doesn't exist. Use the `antithesis-research` skill to create it.
- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup/`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices/`
- Coverage instrumentation: `https://antithesis.com/docs/instrumentation/coverage_instrumentation/`
- Assertion cataloging: `https://antithesis.com/docs/instrumentation/assertion_cataloging/`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies/`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection/`

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
- Use `snouty run` directly to submit runs. Run `compose build` before `snouty run` to ensure images are up to date.
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
- Every service has `hostname:` set to match its `container_name:`
- The instrumentation inventory from `references/instrumentation.md` is fully implemented: each service is instrumented, cataloged-only, or explicitly documented as uninstrumented
- The relevant Antithesis SDK is installed in the SUT dependency graph
- A bootstrap property exists in a simple, guaranteed-to-run code path (not behind rare behavior)
- `/opt/antithesis/catalog/` or `/symbols/` is exposed correctly for each service's language
- The `setup_complete` signal is wired in at least one entrypoint
- `snouty validate` on `antithesis/config/` succeeds
- All built images target `amd64` (verified via `podman image inspect` or `docker image inspect`)
- Every service has `NO_COLOR=1` set in its environment (via docker-compose.yaml and/or Dockerfile) to prevent ANSI escape codes in container output
- The harness is ready for the `antithesis-workload` skill — test template directories exist or are wired for later use
- If the user asks to launch a run, the `antithesis-launch` skill is used instead of running `snouty run` directly
