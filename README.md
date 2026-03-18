# antithesis-skills

Enable your AI agents to set up Antithesis for you. Other workflows coming soon.  

`antithesis-documentation` is a foundational skill that enables agents to work with [our docs](https://antithesis.com/docs/) more efficiently. It's a prereq for the other skills. [Snouty CLI](https://github.com/antithesishq/snouty) is also a prereq. 

`antithesis-research`, `antithesis-setup`, and `antithesis-workload` work together to bootstrap a new system into Antithesis. Together, they will: 
  - Analyze your system to provide a basic catalog of relevant [reliability properties](https://antithesis.com/docs/resources/reliability_glossary/)
  - Provide a suggested system topology for testing
  - Handle your [initial deployment to Antithesis](https://antithesis.com/docs/getting_started/setup/)
  - Create a basic [test template](https://antithesis.com/docs/test_templates/) to validate properties in the catalog

**`antithesis-research` produces planning artifacts that you should review carefully.**

`antithesis-triage` is still under development and will enable agents to parse and analyze the results of your Antithesis test runs. 

> [!NOTE]
> These skills are under active development. LLMs are inherently non-deterministic, so they may not work perfectly with your AI. Please do file issues and submit PRs as you come across ways to improve them.

## Install

```bash
npx skills add antithesishq/antithesis-skills
```

## Install for local development

To work on these skills, use `make install-dev` to symlink them into your Claude and Codex skills directory.

Restart Codex/Claude sessions after adding skills so they are re-discovered.

## Validate skills

```bash
make validate
```

Validation uses `uv` and will create a local `.venv/` on first run.

## Validate links

```bash
make validate-links
```

This uses `lychee` to check repository links, including raw URLs inside Markdown
code spans via `--include-verbatim`.
