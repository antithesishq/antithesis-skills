# antithesis-skills

AI skills for Antithesis workflows.

## Add These Skills To Codex And Claude

From this repository root:

```bash
./scripts/install.sh
```

`scripts/install.sh` only installs into tools it detects:
- Codex: `${CODEX_HOME:-$HOME/.codex}`
- Claude: `$HOME/.claude`

Verify links:

```bash
ls -la "${CODEX_HOME:-$HOME/.codex}/skills"
ls -la "$HOME/.claude/skills"
```

Restart Codex/Claude sessions after adding skills so they are re-discovered.

## Validate

```bash
make validate
```
