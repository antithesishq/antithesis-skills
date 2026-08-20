---
name: antithesis-launch
description: >
  Launch an Antithesis run with snouty by discovering the harness layout,
  building the right Docker Compose config, running `snouty validate`,
  bailing on validation failure, and then submitting `snouty launch` with sane
  metadata. Use when the user wants to send, submit, or launch an Antithesis
  run. This skill takes duration in minutes as input.
compatibility: Requires Docker Compose v2, a container engine (docker or podman), and snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-08-19 d07de7b"
---

# Antithesis Launch

**Skill version:** `2026-08-19 d07de7b`

## Prerequisites

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.
- Run `snouty doctor`. It checks the container runtime and the compose CLI. Report both to the user and build with that same pair. This skill writes `docker compose`; use `docker-compose` instead when that is the CLI snouty names.

## Goal

Launch an Antithesis run in this order only:

1. `docker compose build`
2. `snouty validate`
3. if validation fails, stop and report the error
4. `snouty launch`

## Required Input

- `duration` in minutes is required. If the user did not provide it, ask before submitting the run.

## Discovery

- Start from any user-provided path, command, or Antithesis directory name.
- Otherwise, inspect the repo to understand how the harness is wired. Check nearby `AGENTS.md`, `README*`, `Makefile*`, and Antithesis-specific scripts before choosing commands.
- Find the config directory by locating the `docker-compose.yaml` intended for Antithesis. Prefer directories like `antithesis/config`, but support non-standard layouts.
- Treat these as strong Antithesis signals: nearby `scratchbook/` or `test/` directories, compose content mentioning `/opt/antithesis`, `ANTITHESIS_` env vars, `setup_complete`, or existing `snouty` examples.
- If multiple compose files look plausible, prefer the one referenced by repo docs or existing `snouty launch` examples. If the choice is still ambiguous, ask the user instead of guessing.
- Use the directory containing `docker-compose.yaml` as the `snouty validate <CONFIG>` and `snouty launch --config <CONFIG>` argument.
- Build against that exact file: `docker compose -f <CONFIG>/docker-compose.yaml build`.
- snouty never builds or pulls images, so every image must already be in the store of the engine snouty selects. snouty prefers podman when both engines are installed.
  - With a docker engine while podman is also installed, export `SNOUTY_CONTAINER_ENGINE=docker` so snouty reads docker's store.
  - With a podman engine, export `DOCKER_HOST` to podman's API socket before the build. Compose looks for a Docker daemon otherwise. Confirm `podman info --format '{{.Host.RemoteSocket.Exists}}'` prints true first — a fresh podman install reports a path but does not listen on it, and `snouty doctor` still passes. On macOS podman runs in a VM, so take the host-forwarded socket from `podman machine inspect` rather than the in-VM path `podman info` reports.

## Run Arguments

- Determine the webhook in this order: explicit user input, existing repo docs/scripts/examples, otherwise default to `basic_test` when using a docker-compose.yaml file and to `basic_k8s_test` when using a kubernetes setup.

- `snouty launch --config` requires `ANTITHESIS_REPOSITORY`. Reuse the current environment if it is already set. If not, stop and ask the user for it.
- Always set all of these explicitly:
  - `--duration`: the user-provided duration
  - `--source`: repo name
  - `--test-name`: repo name plus branch or config name
  - `--description`: short, readable description of the run, including details such as the branch name, currently goal, or what you changed since the last run.

## Execution

- These commands can take a long time. Prefer background execution or generous timeouts instead of assuming quick completion.
- Do not run `snouty launch` unless the build succeeded and `snouty validate` exited successfully.

```sh
docker compose -f "$CONFIG_DIR/docker-compose.yaml" build
snouty validate "$CONFIG_DIR"
snouty launch \
  --json \
  --webhook "$WEBHOOK" \
  --config "$CONFIG_DIR" \
  --duration "$DURATION" \
  --source "$SOURCE" \
  --test-name "$TEST_NAME" \
  --description "$DESCRIPTION"
```

## Output

- Report the config directory, compose build command, validate command, and final `snouty launch` command shape before submission.
- If validation fails, stop immediately and show the failing command plus the key error.
- The `--json` flag makes `snouty launch` emit machine-readable output containing a `run_id`. Parse and report the run_id — it's needed to triage the run when it is done.

## Self-Review

- The chosen config directory is the one that actually contains the Antithesis `docker-compose.yaml`.
- The build, validate, and run steps all point at the same config.
- `snouty validate` succeeded before `snouty launch` was invoked.
- The run set `source`, `test-name`, `description`, and `duration` explicitly.
- The build used the compose CLI and container engine `snouty doctor` reported.
- Missing blockers such as `duration`, `ANTITHESIS_REPOSITORY`, or an ambiguous config location caused a stop instead of a bad submission.
