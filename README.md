# antithesis-skills

AI skills for Antithesis workflows.

> [!NOTE]
> This repository is under active development. Also, due to the inherent nature of LLMs, some skills may not work perfectly. Please feel free to file issues and submit PRs if you discover ways to improve the skills.

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
