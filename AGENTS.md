# Repository Guidelines

## Project Structure & Module Organization

This repository is organized as a set of AI skills plus validation tooling.

Add new skills as `<skill-name>/SKILL.md` at the repository root. Keep each skill self-contained in its own directory.

All skills must align with the specification available here:
https://agentskills.io/specification.md

## Build, Test, and Development Commands

- `make validate`: validates all SKILLS align with the specification.
- `make validate-changelog`: validates CHANGELOG.md format.

## Coding Style & Naming Conventions

- Shell scripts use Bash with strict mode (`set -euo pipefail`); keep new scripts consistent.
- Use 2-space indentation in shell blocks to match existing files.
- Skill directories should use lowercase kebab-case (example: `my-new-skill/`).
- `SKILL.md` must include YAML frontmatter with:
  - `name`: must exactly match the directory name.
  - `description`: non-empty, not `TODO`.
- Every `SKILL.md` must include a top-level Markdown heading (`# ...`).

## Testing Guidelines

Testing is validation-driven:

- Primary check: `make validate`.
- Scope: verifies presence and correctness of frontmatter, heading requirements, and skill discovery via `*/SKILL.md`.
- For validator updates, test both pass and fail paths (for example, a missing `description` should fail).

## Commit & Pull Request Guidelines

Use clear, conventional commit messages such as:

- `feat: add antithesis-xyz skill`
- `fix: enforce SKILL.md name/dir match in validator`

PRs should include:

- What changed and why.
- Validation evidence (`make validate` output).
- Any follow-up work or limitations.

For notable changes (new skills, breaking changes, significant fixes), add a
`changelog - breaking` or `changelog - non-breaking` label to the PR. A bot
updates `CHANGELOG.md` automatically on merge using the PR title. Do not edit
`CHANGELOG.md` directly.
