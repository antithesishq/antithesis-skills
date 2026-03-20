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

## Compatibility

**Platform**: macOS or Linux.

**AI agent**: Tested with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/). Other agents that support skills may also work.

## Prerequisites

Install an AI agent that supports skills (see above).

The installer runs via `npx`, which ships with [npm](https://www.npmjs.com/). Install npm if you don't already have it.

[Snouty CLI](https://github.com/antithesishq/snouty) is used by the documentation skill to search and retrieve docs. Install it before proceeding. You will also need either [Docker](https://github.com/docker) and [Docker Compose](https://docs.docker.com/compose/install/), or [Podman](https://podman.io/), please install those too!

If building on macOS ARM (Apple Silicon), ensure your container runtime can build `linux/amd64` images. Antithesis runs on x86-64, so all images must target that architecture.

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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and validation commands.
