## Installing the Antithesis Documentation MCP Server

The Antithesis Documentation MCP server is a public web service available without requiring any authentication at: `https://antithesis.com/docs/mcp`

You can install it as a streaming-http MCP with no auth using one of the following methods:

```
# If NPX is available (preferred)
npx add-mcp https://antithesis.com/docs/mcp -g -y --name "antithesis-documentation"

# Claude Code
claude mcp add --transport http antithesis-documentation https://antithesis.com/docs/mcp

# OpenAI Codex
codex mcp add antithesis-documentation --url https://antithesis.com/docs/mcp
```
