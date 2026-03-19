# antithesis-skills

AI skills for Antithesis workflows.

> [!NOTE]
> This repository is under active development. Also, due to the inherent nature of LLMs, some skills may not work perfectly. Please feel free to file issues and submit PRs if you discover ways to improve the skills.

## Prerequisites

These skills work with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [OpenAI Codex](https://openai.com/index/openai-codex/) on macOS or Linux. Install at least one of these before proceeding.

The installer runs via `npx`, which ships with [Node.js](https://nodejs.org/). Install Node.js if you don't already have it.

## Install

Run the installer:

```bash
npx skills add antithesishq/antithesis-skills
```

The installer presents an interactive menu. Choose the following options:

1. **Skills** — select all five skills:
   - `antithesis-documentation`
   - `antithesis-research`
   - `antithesis-setup`
   - `antithesis-triage`
   - `antithesis-workload`
2. **Install scope** — choose **global**, not project.
3. **Install method** — choose **symlink**.
4. **Agents** — only select agents you have installed (Claude Code, Codex, or both). Do not install the `find-skills` skill.

Restart any open agent sessions after installing so the new skills are discovered.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and validation commands.
