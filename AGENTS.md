# Repository Guidelines

## Project Structure & Module Organization

This repository is organized as a set of AI skills plus validation tooling.

Add new skills as `<skill-name>/SKILL.md` at the repository root. Keep each skill self-contained in its own directory.

All skills must align with the specification available here:
https://agentskills.io/specification.md

## Build, Test, and Development Commands

- `make validate`: checks each `*/SKILL.md` for YAML frontmatter, a `name`
  that matches its directory, a non-`TODO` `description`, and at least one
  top-level `# ` heading. This is the canonical structural check.
- `make validate-changelog`: validates `CHANGELOG.md` format.
- `make validate-links`: runs the `lychee` link checker (config in
  `lychee.toml`).
- `make test`: runs unit tests for skill helper scripts (`process-logs.py`
  in debug; `build-url.py` in query-logs).
- `make install-dev`: bootstraps the dev environment via
  `scripts/install.sh`.

## Coding Style & Naming Conventions

- Shell scripts use Bash with strict mode (`set -euo pipefail`); keep new scripts consistent.
- Use 2-space indentation in shell blocks to match existing files.
- Skill directories should use lowercase kebab-case (example: `my-new-skill/`).
- `SKILL.md` must include YAML frontmatter with:
  - `name`: must exactly match the directory name.
  - `description`: non-empty, not `TODO`.
- Every `SKILL.md` must include a top-level Markdown heading (`# ...`).

### Python in skill assets must support Python 3.9+

Scripts under `*/assets/` ship to customers and run against whatever `python3`
is on their machine (often macOS system Python 3.9). Keep them compatible
with Python 3.9.

- Add `from __future__ import annotations` at the top so PEP 604 unions
  (`X | None`, `list[int] | None`) and other annotation-only syntax don't
  evaluate at import time.
- Do **not** use Python 3.10+ runtime features: `match`/`case`, `tomllib`,
  `typing.Self`, `ExceptionGroup` / `except*`, parenthesized `with` groups.
- Stick to the standard library — asset scripts must not require `pip
  install` on a customer's machine.

The `python-compat` CI job (in `.github/workflows/ci.yml`) runs each asset
script's `--test` mode under Python 3.9. Tooling under `.ci-scripts/` and
`scripts/` is *not* subject to this floor — those run under the project's
`uv`-managed interpreter (`>=3.11`, see `pyproject.toml`).

## Testing Guidelines

Testing is validation-driven:

- Primary check: `make validate`.
- Scope: verifies presence and correctness of frontmatter, heading requirements, and skill discovery via `*/SKILL.md`.
- For validator updates, test both pass and fail paths (for example, a missing `description` should fail).

Some skills also ship a live integration harness as a sibling directory
(`<skill>-test/`, e.g. `antithesis-debug-test/`, `antithesis-query-logs-test/`).
These exercise the skill end-to-end against a real Antithesis tenant via
`agent-browser` and are invoked manually with `<skill>-test/run.sh ...`. They
are not wired into `make validate` or `make test` — see each harness's
`README.md` for prerequisites.

## Commit & Pull Request Guidelines

Use clear, conventional commit messages such as:

- `feat: add antithesis-xyz skill`
- `fix: enforce SKILL.md name/dir match in validator`

PRs should include:

- What changed and why.
- Validation evidence (`make validate` output).
- Any follow-up work for future PRs or limitations. Omit if irrelevant.

## Automation: do not bump versions or edit the changelog by hand

Scripts in `.ci-scripts/` run on merge and handle these chores for you. Do not
propose or perform them as part of a PR.

- `update_skill_versions.py` manages `metadata.version` in every `SKILL.md`.
- `changelog.py` appends an entry to `CHANGELOG.md` from the PR title (and the
  `changelog - breaking` / `changelog - non-breaking` label, if present). For
  notable changes (new skills, breaking changes, significant fixes), add the
  appropriate label; breaking entries are prefixed with `BREAKING CHANGE:`.

Edit `SKILL.md` content freely, but leave the `metadata.version` field alone,
and do not edit `CHANGELOG.md` directly unless directly requested by the user.
