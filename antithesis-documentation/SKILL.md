---
name: antithesis-documentation
description: Use Antithesis documentation efficiently for product, workflow, and integration questions. Prefer the Antithesis docs MCP when available, and use llms.txt as a direct plaintext doc index fallback.
---

# Antithesis Documentation

## Antithesis Overview

Antithesis is a testing platform that works like a specialized staging environment. You ensure your software is reliable by deploying it to Antithesis and running it there before you deploy it to production. It supplements your existing testing tools and lives alongside your normal CI/CD workflow.

When you deploy to Antithesis, your software runs in a simulation environment that is much more hostile than production. This quickly exposes bugs, including complicated, unlikely, and severe failures.

Because Antithesis's environment is perfectly deterministic, problems are reproducible with minimal effort. Unlike typical shared staging, you do not need to compete for deployment locks or worry about environmental drift since every deployment is completely isolated from one another.

## Accessing Documentation

1. Prefer the Antithesis documentation MCP when available.
2. If the MCP is not installed, you may install it or instruct the user to install it: https://antithesis.com/docs/mcp
3. You can directly access the plaintext documentation index at:
   https://antithesis.com/docs/llms.txt
4. Use the MCP and/or `llms.txt` to locate authoritative documentation pages before giving detailed product guidance.

## Installing the Antithesis Documentation MCP Server

The Antithesis Documentation MCP server is a public web service available without requiring any authentication at: https://antithesis.com/docs/mcp

You can install it as a streaming-http MCP with no auth using one of the following methods:

```
# If NPX is available (preferred)
npx add-mcp https://antithesis.com/docs/mcp -g -y --name "antithesis-documentation"

# Claude Code
claude mcp add --transport http antithesis-documentation https://antithesis.com/docs/mcp

# OpenAI Codex
codex mcp add antithesis-documentation --url https://antithesis.com/docs/mcp
```

## IMPORTANT: PAY ATTENTION TO ANTITHESIS URLS AND PATHS

Always add the `.md` extension before requesting any files from `https://antithesis.com/docs/`.

Absolute paths on documentation pages are relative to `https://antithesis.com/docs/`.

Examples:

- `https://antithesis.com/docs/using_antithesis/sdk/go/` becomes `https://antithesis.com/docs/using_antithesis/sdk/go.md`
- `/using_antithesis/sdk/go/` becomes `https://antithesis.com/docs/using_antithesis/sdk/go.md`

Exceptions to this rule:

- `llms.txt` -> https://antithesis.com/docs/llms.txt
- Urls with explicit extensions: `.txt`, `.js`, `.so`, etc.
- `docs/generated/...` -> request as is

When presenting URLs to the user, reverse this transformation. This way you (the LLM Agent) consumes markdown while the user sees pretty HTML pages in their browser.

If you want to link a user directly to a header, all headers are addressable via a fragment containing the slugified header. I.e. `#### Eventually Command` would become `https://.../docs/...#eventually-command`. Slugification strips url-unsafe characters and uses kebab-case. If you aren't sure just link directly to the page and tell the user which header to scroll to.

## Output

- Clear, grounded answers about Antithesis behavior, sdk, setup, and best practices.
- MCP install/configuration guidance when docs MCP is not present and you can't install it yourself.
- Relevant links, including the source doc pages discovered via MCP or `llms.txt`.
