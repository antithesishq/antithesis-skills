# antithesis-skills

Enable AI agents to set up Antithesis and bootstrap your first Antithesis test. Other workflows coming soon.

`antithesis-documentation` is a foundational skill that enables agents to work with [our docs](https://antithesis.com/docs/) more efficiently. It's a prereq for the other skills.

`antithesis-research`, `antithesis-setup`, and `antithesis-workload` work together to bootstrap a new system into Antithesis. Together, they will:

- Analyze your system to provide a basic catalog of relevant [reliability properties](https://antithesis.com/docs/resources/reliability_glossary/)
- Provide a suggested system topology for testing
- Handle your [initial deployment to Antithesis](https://antithesis.com/docs/getting_started/setup/)
- Create a basic [test template](https://antithesis.com/docs/test_templates/) to validate properties in the catalog

**`antithesis-research` produces planning artifacts that you should review carefully.**

`antithesis-triage` is still under development and will enable agents to parse and analyze the results of your Antithesis test runs.

> [!NOTE]
> These skills are under active development. LLMs are inherently non-deterministic, so they may not work perfectly with your AI. Please do file issues and submit PRs as you come across ways to improve them.

## Recommended workflow

We recommend that you run `antithesis-research`, `antithesis-setup`, and `antithesis-workload` in order and in separate fresh contexts. After running each skill review all of the changes made so far, and iterate on them before continuing to the next skill.

We also recommend running `docker/podman compose build` + `snouty validate` after the setup and workload skills to ensure that everything is working well.

Furthermore, don't hesitate to run short 15-30 minute Antithesis test runs as smoke tests to ensure that the harness is working as expected.

## Compatibility

**Platform**: macOS or Linux.

**AI agent**: Tested with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/). These skills work best with agents that can spawn sub-agents for self-review. Other agents that support skills may also work.

## Prerequisites

You'll need an AI agent, npm, a container runtime (Docker or Podman), and the Snouty CLI. See [PREREQUISITES.md](PREREQUISITES.md) for the full list and platform-specific installation instructions.

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

Restart any open agent sessions after installing so the new skills are discovered.

## Updating skills

Assuming you installed the skills using `npx skills add`, updating is as simple as `npx skills update`.

## Uninstalling

You can use `npx skills remove` to open up an interactive menu and then select the `antithesis` prefixed skills to remove them.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and validation commands.
