# antithesis-skills

An experimental collection of Antithesis skills for AI agents.

> [!IMPORTANT]
> The core Antithesis skills now live in the **[antithesis plugin](https://github.com/antithesishq/antithesis-plugin)**. Install it before using anything here. The skills in this repository build on its `/antithesis` skill and hand work off to its modules.
>
> The `antithesis-documentation`, `antithesis-setup`, `antithesis-setup-k8s`, `antithesis-workload`, `antithesis-launch`, `antithesis-triage`, and `antithesis-debug` skills have been removed from this repository. Use the plugin's `/antithesis [module] <prompt>` entry point instead:
>
> | Removed skill                                  | Use instead            |
> | ---------------------------------------------- | ---------------------- |
> | `antithesis-setup`, `antithesis-setup-k8s`, `antithesis-workload` | `/antithesis workload` |
> | `antithesis-launch`                            | `/antithesis launch`   |
> | `antithesis-triage`                            | `/antithesis triage`   |
> | `antithesis-debug`                             | `/antithesis debug`    |
> | `antithesis-documentation`                     | `snouty docs`          |
>
> To uninstall the removed skills, run `npx skills remove` and select them.

> Table of contents:  
> **[Skills](#skills)** · **[Starter prompts](#starter-prompts)** · **[Working with LLM agents](#working-with-llm-agents)** · **[Choosing a model](#choosing-a-model)** · **[Prerequisites](#prerequisites)** · **[Install](#install)**

## Skills

These skills are experiments. They may change shape, move into the plugin, or be removed. Each one expects the antithesis plugin to be installed, and calls its modules (`/antithesis workload`, `/antithesis properties`, `/antithesis launch`, `/antithesis triage`, `/antithesis debug`) for the work the plugin owns.

`antithesis-research` analyzes your system and produces a catalog of [reliability properties](https://antithesis.com/docs/resources/reliability_glossary/) and a suggested test topology. Its scratchbook is a source you can import into a workload with `/antithesis properties`. **Review its planning artifacts carefully.**

> [!IMPORTANT]
> `antithesis-research` is thorough by design. It fans out across sub-agents to study your system from several angles — reading source, comments, docs, commit history, and issues — then runs multiple evaluation passes over the properties it discovers. That depth is what makes the artifacts valuable, but it also means the run is not quick: on most codebases, expect it to work for > _30 minutes to an hour_ and to use a meaningful amount of tokens along the way.

`antithesis-feature-workload` is a focused entry point for testing a specific feature with Antithesis. Bring a feature — done or still in development — and this skill analyzes it, discovers testable properties, and builds a self-driving workload that runs locally and in Antithesis. For in-development features, the workload includes TDD-style stubs that go green as code lands. It uses `/antithesis launch`, `/antithesis triage`, and `/antithesis debug` once the workload moves to Antithesis.

`antithesis-mutation-testing` validates that your properties can actually catch bugs. A property that passes every run tells you nothing bad was observed — not that the property would have noticed. This skill injects one realistic bug per property, runs it, and confirms the property fires, then diagnoses each survivor as a bad mutant, a bad assertion, a workload gap, or a property that can't be falsified at all. Run it once your harness is built and a baseline run is green.

`antithesis-review-inputs` reviews a workload's input generation for state space exploration — how well it uses randomness to drive the system under test into diverse regions of behavior. Useful when a workload isn't finding bugs and you want to understand whether its input generation is limiting what Antithesis can explore, or as a periodic health check on existing workloads.

`antithesis-skills-feedback` helps you file bug reports against these skills by opening a pre-filled GitHub issue. Report problems with the `/antithesis` skill itself on the [plugin's issue tracker](https://github.com/antithesishq/antithesis-plugin/issues).

> [!NOTE]
> LLMs are inherently non-deterministic, so these skills may not work perfectly with your AI. Please do file issues and submit PRs as you come across ways to improve them.

## Starter prompts

> [!NOTE]
> There are many ways to invoke a skill. In the examples below, it's invoked with a /skill-name.

### antithesis-research

```
/antithesis-research Research my codebase at /path/to/codebase and prepare a plan to test it with Antithesis.
```

This skill outputs the following research materials, relative to the project directory:

- `antithesis/scratchbook/sut-analysis.md` captures architecture, state, concurrency, and failure-prone areas.
- `antithesis/scratchbook/existing-assertions.md` lists any Antithesis SDK assertions already present in the codebase.
- `antithesis/scratchbook/property-catalog.md` lists concrete, testable properties with priorities.
- `antithesis/scratchbook/deployment-topology.md` describes the minimal useful container topology.
- `antithesis/scratchbook/properties/{slug}.md` per-property evidence files capturing the reasoning, code paths, and key observations behind each property.
- `antithesis/scratchbook/property-relationships.md` maps suspected clusters and connections between properties.
- `antithesis/scratchbook/evaluation/synthesis.md` records categorized evaluation findings and actions taken.
- `antithesis/scratchbook/evaluation/{lens}.md` one per evaluation lens used during property evaluation.

To turn the catalog into a running workload, hand it to the plugin:

```
/antithesis workload Build a workload for this system, then import the properties in @antithesis/scratchbook/property-catalog.md.
```

### antithesis-feature-workload

```
/antithesis-feature-workload I'm building a new batch processing feature in src/batch/. Help me design an Antithesis workload to test it.
```

```
/antithesis-feature-workload We just shipped the new replication feature. Build a workload that exercises it and checks its invariants.
```

This skill analyzes the feature, discovers testable properties, and builds a self-driving workload with dual-mode assertions (SDK in Antithesis, local checks outside). Outputs go to `antithesis/feature-workloads/<feature-slug>/`.

### antithesis-mutation-testing

```
/antithesis-mutation-testing My baseline run is green. Validate the properties in @antithesis/scratchbook/property-catalog.md by mutation testing them.
```

This skill asks how autonomous you want it to be and how many runs it may spend, then works under `antithesis/scratchbook/mutation-testing/` — one patch per mutant, per-mutant evidence, a resumable `status.md`, and a `report.md` giving every property a verdict and the run that proves it. Each property's evidence file gains a `## Falsification` section recording what the sweep established. Your working tree is left unmutated.

If there is no property catalog — the scratchbook was never written, or was deleted after the harness was built — the skill reconstructs one from the Antithesis assertions in your code plus the baseline run, and says so in the report. A reconstructed catalog validates the assertions you already have; run `antithesis-research` for the properties nobody has asserted yet.

> [!IMPORTANT]
> Mutation testing requires launching and analyzing many test runs, so be prepared for the cost in compute, tokens, and time. The skill builds an image and launches an Antithesis run per property, plus a baseline run, plus a full re-sweep after each round of fixes. It confirms the maximum run budget and the maximum number of concurrent runs with you before submitting any job, and it launches every mutant run as `--ephemeral` under a dedicated `--source` so the deliberate failures never enter your real property history.

### antithesis-review-inputs

```
/antithesis-review-inputs Review the workload in this repo.
```

This skill reads the workload code and produces a report of findings — structural patterns in input generation that limit what Antithesis can explore. It does not modify the workload or suggest specific code changes.

## Working with LLM agents

These skills run inside an agent like Claude Code or Codex. Using them well means knowing how to work with the agent itself, not just the skills.

If you're new to agentic tools, or you've been using them for a while and want to dig deeper, read [Getting Started with Antithesis Skills](getting-started-documentation/). It's a companion guide covering mental model, day-to-day working patterns, context and memory, building up your harness, and recognizing failure modes.

## Compatibility

**Platform**: macOS or Linux.

**AI agent**: Tested with [Claude Code](https://code.claude.com/docs) and [OpenAI Codex](https://learn.chatgpt.com/docs/codex/cli). These skills work best with agents that can spawn sub-agents for self-review. Other agents that support skills may also work.

## Choosing a model

These skills work well with mid-tier models. They were designed and tested with Claude Opus 4.6, and models at that level — older Sonnets, or similar from other providers — are a good starting point. If you think a particular skill isn't performing well enough, try a more capable model for that skill before upgrading across the board.

Some skills are heavy on input tokens — `antithesis-research` in particular. Using a frontier model where a mid-tier one performs just as well has a real impact on spend and quota usage for minimal to no gain.

## Prerequisites

Install the [antithesis plugin](https://github.com/antithesishq/antithesis-plugin) and its prerequisites first. You'll also need an AI agent, npm, Docker Compose v2, a container engine (Docker or Podman), and the Snouty CLI. See [PREREQUISITES.md](PREREQUISITES.md) for the full list and platform-specific installation instructions.

## Permissions

These skills invoke external tools that your AI agent may prompt you to approve. The skills themselves do not configure permissions — that's up to you based on your security preferences.

Here are the tools each skill may invoke, so you can pre-approve them if you prefer fewer interruptions:

| Skill                         | Tools used                                                     |
| ----------------------------- | -------------------------------------------------------------- |
| `antithesis-research`         | `snouty docs`                                                  |
| `antithesis-feature-workload` | `docker compose`/`docker-compose`, `docker`/`podman`, `snouty` |
| `antithesis-mutation-testing` | `docker-compose`, `snouty`, `jq`, `git`, `rsync`               |
| `antithesis-review-inputs`    | No explicit external tools                                     |

## Install

First install the [antithesis plugin](https://github.com/antithesishq/antithesis-plugin#install). Then install the experimental skills you want with the `npx skills` installer:

```bash
npx skills add antithesishq/antithesis-skills
```

The installer presents an interactive menu. Choose the following options:

1. **Skills** — select the skills you want:
   - `antithesis-research`
   - `antithesis-feature-workload`
   - `antithesis-mutation-testing`
   - `antithesis-review-inputs`
   - `antithesis-skills-feedback`
2. **Pick agents** - make sure to select **Claude Code** if you want to use these skills with Claude, as it's not enabled by default.
3. **Install scope** — choose **global**, not project.
4. **Install method** — choose **symlink**.
5. **Install find-skills skill** — choose **No**.

Restart any open agent sessions after installing so the new skills are discovered.

To update: `npx skills update`. To uninstall: `npx skills remove` and select the `antithesis` prefixed skills.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and validation commands.
