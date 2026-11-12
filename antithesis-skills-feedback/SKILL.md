---
name: antithesis-skills-feedback
description: >
  File a bug report or feedback on the Antithesis skills by opening a
  pre-filled GitHub issue URL (skill name, skill version, agent, short
  summary). Load when the user wants to report a problem with, or give
  feedback on, any Antithesis skill. Does not auto-submit — presents the
  URL for the user to review.
metadata:
  version: "2026-10-30 d5d7b3b"
---

# Antithesis Skills feedback

**Skill version:** `2026-10-30 d5d7b3b`

Help the user file a bug report against the Antithesis skills by opening a pre-filled GitHub issue.

This repository holds only the experimental skills (for example `antithesis-research`, `antithesis-mutation-testing`). If the problem is with the `/antithesis` skill from the antithesis plugin (its `triage`, `debug`, `workload`, `launch`, or `properties` modules), point the user to https://github.com/antithesishq/antithesis-plugin/issues/new instead, and do not use the template below.

## Base URL

```
https://github.com/antithesishq/antithesis-skills/issues/new?template=bug_report.yml
```

## Pre-filling fields via URL parameters

GitHub issue templates accept query parameters to pre-fill fields. Each
parameter key corresponds to the `id` of a field in the template. Append them as
`&<id>=<value>` with values **percent-encoded** (spaces → `%20`, newlines →
`%0A`, etc.).

The available fields are:

| Parameter           | Type     | What to fill                                                                                          |
| ------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `what-happened`     | textarea | Brief summary of what went wrong. Keep to 1-2 sentences — the user will elaborate.                    |
| `expected`          | textarea | Leave **blank** — only the user knows what they expected.                                             |
| `skill`             | input    | The skill that was active (e.g. `antithesis-research`, `antithesis-mutation-testing`).                 |
| `skill-version`     | input    | Run `git -C <skills-repo> rev-parse --short HEAD` to get the commit SHA.                              |
| `agent`             | input    | The agent name and version (e.g. `Claude Code 1.0.20`). Use the agent info available in your context. |
| `agent-explanation` | textarea | Your honest self-assessment: what did you do, and why did it go wrong? 2-4 sentences max.             |
| `context`           | textarea | Leave **blank** — the user can add screenshots and logs themselves.                                   |

You can also set the issue `title` via a `title=<value>` parameter.

## How to construct the URL

1. **Identify the skill** that was being used when the problem occurred.
2. **Get the skill version** by running `git rev-parse --short HEAD` in the skills repo if you know where it is.
3. **Determine agent info** from your environment context (agent name + version).
4. **Write a brief `what-happened`** summary (1-2 sentences).
5. **Write your `agent-explanation`** — a short, honest self-assessment of what went wrong (2-4 sentences).
6. **Set the `title`** to a short description of the bug (under 80 characters).
7. **Percent-encode** all parameter values.
8. **Assemble the URL** by appending only the fields you can meaningfully fill. Do NOT fill `expected` or `context` — those are for the user.

### URL length limit

**Keep the total URL under 2000 characters.** Browsers and GitHub may truncate
or reject longer URLs. If the URL would exceed this limit:

- Shorten `what-happened` and `agent-explanation` first — the user can edit these in the form.
- Drop `agent-explanation` entirely if still too long.
- As a last resort, drop `what-happened` too and only pre-fill `skill`, `skill-version`, `agent`, and `title`.

### Example URL

```
https://github.com/antithesishq/antithesis-skills/issues/new?template=bug_report.yml&title=Research%20skill%20fails%20to%20write%20property%20catalog&skill=antithesis-research&skill-version=1c45cd3&agent=Claude%20Code%201.0.20&what-happened=The%20research%20skill%20stopped%20before%20writing%20the%20property%20catalog.&agent-explanation=I%20ran%20out%20of%20context%20during%20property%20evaluation%20and%20did%20not%20checkpoint%20the%20catalog%20first.
```

## Presenting to the user

**Do NOT auto-submit the issue.** Open the URL (or print it if no browser is
available) so the user can review the pre-filled fields, add their own details
to `expected` and `context`, and submit when ready.
