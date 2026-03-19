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
