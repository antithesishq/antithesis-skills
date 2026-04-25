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
`CHANGELOG.md` directly. When a labeled PR is merged, a bot adds the PR
title to `CHANGELOG.md` under the date (UTC), with a link to the PR
appended.

### When a PR needs an entry

If a skill user would notice a difference after updating, the PR needs an
entry. That includes new skills, behavior changes in existing skills, bug
fixes that affect output, and removals.

Internal changes — CI, refactors that don't change behavior, typo fixes
in non-user-facing docs, dev tooling — don't need an entry. If you're
not sure, the test is: would a skill user want to see this entry in
`CHANGELOG.md`?

### One user-facing change per PR

Split distinct user-facing changes into separate PRs. The bot produces
one entry per PR, so bundling unrelated changes forces a single title to
cover all of them, and labels become ambiguous when one change is
breaking and the others aren't.

Internal refactors and supporting changes can ride along in a user-facing
PR when they're part of the same change. The test is whether you'd
describe them separately to a user — if not, they belong together.

### Labels

Add exactly one of these labels to PRs that need an entry:

- `changelog - breaking` — changes existing behavior in a way that
  requires users to adapt. The bot prefixes the entry with
  `BREAKING CHANGE:` automatically; don't put that prefix in your title.
- `changelog - non-breaking` — new features, fixes, and other
  improvements.

If you split distinct changes into separate PRs as the previous section
recommends, picking one label is straightforward. Don't apply both — the
bot picks the first label it sees, which is not deterministic.

The PR author normally applies the label before merge. External
contributors who can't set labels should mention which label applies in
the PR description so a maintainer can apply it. If a PR is merged
without a label, follow up with a small PR that adds an entry to
`CHANGELOG.md` directly under today's date — that's the only sanctioned
case for editing `CHANGELOG.md` by hand.

### Writing the PR title

The PR title becomes the text of the changelog entry (the bot appends a
link to the PR), so write the title as an entry:

- Use the imperative mood: "Add support for X", "Fix Y when Z", "Remove
  deprecated W".
- Describe user-visible behavior, not internal structure. "Fix trailing
  newline in `pony-ref` output" beats "Fix `_format_output` bug".
- Assume the reader is scanning a list of changes between releases and
  hasn't seen the PR. They should understand what changed without
  clicking through.

For breaking changes, the title should say what breaks for the user,
not just what was renamed or removed internally. The bot prepends
`BREAKING CHANGE:`; your title needs to convey what just changed for
someone using these skills.

### Writing the PR description

The PR description is where a reader who clicked through the changelog
entry lands. Lead with the user-facing change: what's different, who it
affects, and whether action is required. Implementation notes and
internal rationale can follow, but they shouldn't be the first thing a
changelog reader sees. For example, a description for "Add support for
X" might open:

    Skills can now declare X in their frontmatter. Clients that read
    skill metadata will surface X to the user before the skill loads;
    skills without X behave as before.

Trivial changes (typo fixes, small wording tweaks) don't need a body —
the title is the description.

For breaking changes, lead the description with a migration block: what
to change, before and after. For example:

    To update: rename any references to `/test-composer` to use
    `/antithesis-test-template`, and uninstall the old skill.

    Before: `/test-composer ...`
    After:  `/antithesis-test-template ...`

## Validate changelog

```bash
make validate-changelog
```
