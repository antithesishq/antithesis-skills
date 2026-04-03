---
name: antithesis-launch
description: >
  Launch an Antithesis run with snouty by discovering the harness layout,
  building the right Docker Compose config, running `snouty validate`,
  bailing on validation failure, and then submitting `snouty run` with sane
  metadata. Use when the user wants to send, submit, or launch an Antithesis
  run. This skill takes duration in minutes as input.
compatibility: Requires docker (or podman) with compose and snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-04-20 bc08fb6"
---

# Antithesis Launch

## Prerequisites

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

## Goal

Launch an Antithesis run in this order only:

1. `docker compose build`
2. `snouty validate`
3. if validation fails, stop and report the error
4. `snouty run`

## Required Input

- `duration` in minutes is required. If the user did not provide it, ask before submitting the run.

## Discovery

- Start from any user-provided path, command, or Antithesis directory name.
- Otherwise, inspect the repo to understand how the harness is wired. Check nearby `AGENTS.md`, `README*`, `Makefile*`, and Antithesis-specific scripts before choosing commands.
- Find the config directory by locating the `docker-compose.yaml` intended for Antithesis. Prefer directories like `antithesis/config`, but support non-standard layouts.
- Treat these as strong Antithesis signals: nearby `scratchbook/` or `test/` directories, compose content mentioning `/opt/antithesis`, `ANTITHESIS_` env vars, `setup_complete`, or existing `snouty` examples.
- If multiple compose files look plausible, prefer the one referenced by repo docs or existing `snouty run` examples. If the choice is still ambiguous, ask the user instead of guessing.
- Use the directory containing `docker-compose.yaml` as the `snouty validate <CONFIG>` and `snouty run --config <CONFIG>` argument.
- Build against that exact file with `docker compose -f <CONFIG>/docker-compose.yaml build`. If `docker compose` is unavailable, fall back to `docker-compose -f ... build`.

## Run Log

Maintain a run log at `antithesis/scratchbook/run-log.md`. Each run gets a
sequential integer ID (Run 1, Run 2, …). Before launching, read the run log
to determine the next ID. **Immediately** after a successful `snouty run`,
append an entry in the same response — do not defer or batch run log updates,
because context compaction can cause deferred updates to be lost:

```markdown
## Run <N>

- **Date**: <ISO 8601 date>
- **Duration**: <minutes> minutes
- **Description**: <what changed or what this run is testing>
- **Branch**: <git branch>
- **Config**: <config directory>
- **snouty output**: <paste the run URL or submission ID from snouty>
```

If the run log does not exist yet, create it with a heading and the first
entry. Include the run ID in both `--test-name` and `--description` so it
appears in the triage report and runs browser (e.g., `--description "Run 14: fixed clone isolation in atomic push driver"`).

If `antithesis/scratchbook/known-issues.md` exists, read it before launching.
Note in the run log entry which known issues this run is expected to address
(fixes deployed) and which are still outstanding.

## Run Arguments

- Determine the webhook in this order: explicit user input, existing repo docs/scripts/examples, otherwise default to `basic_test`.
- `snouty run --config` requires `ANTITHESIS_REPOSITORY`. Reuse the current environment if it is already set. If not, stop and ask the user for it.
- Always set all of these explicitly:
  - `--duration`: the user-provided duration
  - `--source`: repo name
  - `--test-name`: repo name plus branch or config name, prefixed with the run ID (e.g., `"Run 14 — myrepo/main"`)
  - `--description`: short, readable description including the run ID, branch name, current goal, or what changed since the last run.

## Execution

- These commands can take a long time. Prefer background execution or generous timeouts instead of assuming quick completion.
- Do not run `snouty run` unless the build succeeded and `snouty validate` exited successfully.

```sh
docker compose -f "$CONFIG_DIR/docker-compose.yaml" build
snouty validate "$CONFIG_DIR"
snouty run \
  --webhook "$WEBHOOK" \
  --config "$CONFIG_DIR" \
  --duration "$DURATION" \
  --source "$SOURCE" \
  --test-name "$TEST_NAME" \
  --description "$DESCRIPTION"
```

## Output

- Report the config directory, compose build command, validate command, and final `snouty run` command shape before submission.
- If validation fails, stop immediately and show the failing command plus the key error.
- Update `antithesis/scratchbook/run-log.md` with the new run entry.

## Self-Review

- The chosen config directory is the one that actually contains the Antithesis `docker-compose.yaml`.
- The build, validate, and run steps all point at the same config.
- `snouty validate` succeeded before `snouty run` was invoked.
- The run set `source`, `test-name`, `description`, and `duration` explicitly.
- The run ID is sequential and appears in both `--test-name` and `--description`.
- `antithesis/scratchbook/run-log.md` has been updated with the new run entry.
- Missing blockers such as `duration`, `ANTITHESIS_REPOSITORY`, or an ambiguous config location caused a stop instead of a bad submission.
