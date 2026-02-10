---
name: antithesis-documentation
description: Use Antithesis documentation efficiently for product, workflow, and integration questions. Prefer the Antithesis docs MCP when available, and use llms.txt as a direct plaintext doc index fallback.
---

# Antithesis Documentation

## Antithesis Overview
Antithesis is a testing platform that works like a specialized staging environment. You ensure your software is reliable by deploying it to Antithesis and running it there before you deploy it to production. It supplements your existing testing tools and lives alongside your normal CI workflow.

When you deploy to Antithesis, multiple copies of your software run in a simulation environment that is much more hostile than production. This quickly exposes bugs, including complicated, unlikely, and severe failures. In effect, Antithesis tests your software for you.

Because Antithesis simulation is perfectly deterministic, problems are reproducible with minimal effort. Unlike typical shared staging, you do not need to compete for deployment locks or worry about environmental drift since your last deployment.

## Documentation Access Rules
1. Prefer the Antithesis documentation MCP when available.
2. If the MCP is not installed, you may install it or instruct the user to install it: https://antithesis.com/docs/mcp
3. You can directly access the plaintext documentation index at: https://antithesis.com/docs/llms.txt
4. Use the MCP and/or `llms.txt` to locate authoritative documentation pages before giving detailed product guidance.

## Workflow
1. Determine whether the Antithesis docs MCP is already available in the current environment.
2. If not available, either:
   - Install/configure it directly when appropriate, or
   - Provide the user a short install path using https://antithesis.com/docs/mcp
3. Use MCP resources first for doc lookup; use https://antithesis.com/docs/llms.txt as a direct index/fallback.
4. Ground answers in documentation findings and include links to relevant doc pages.
5. If documentation cannot be reached, state that clearly and provide best-effort guidance with explicit uncertainty.

## Output
- Clear, doc-grounded answers about Antithesis behavior and workflows.
- MCP install/configuration guidance when docs MCP is not present.
- Relevant links, including the MCP setup docs and source doc pages discovered via MCP/`llms.txt`.
