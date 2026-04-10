# Contributing

## Local development setup

To work on these skills, use `make install-dev` to symlink them into your Claude and Codex skills directory.

Restart agent sessions after adding or modifying skills so they are re-discovered.

## Validate skills

```bash
make validate
```

Validation uses `uv` and will create a local `.venv/` on first run.

## Validate links

```bash
make validate-links
```

This uses `lychee` to check repository links, including raw URLs inside Markdown code spans via `--include-verbatim`.

## Changelog

Changelog entries are managed automatically via PR labels. Do not edit
`CHANGELOG.md` directly.

Add one of these labels to PRs with notable changes:

- `changelog - breaking` — changes existing behavior in a way that requires
  users to adapt. The entry will be prefixed with `BREAKING CHANGE:`.
- `changelog - non-breaking` — new features, fixes, and other improvements.

If a PR has both labels, it gets a single entry with the `BREAKING CHANGE:`
prefix.

Not every PR needs a label. Internal CI changes, typo fixes, and similar
housekeeping generally don't.

When a labeled PR is merged, a bot adds the PR title to `CHANGELOG.md` under
the date (UTC). Write your PR title as a changelog entry.

## Validate changelog

```bash
make validate-changelog
```
