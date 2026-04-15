# Prerequisites

You need the following to use antithesis-skills:

- **An AI agent** that supports skills — tested with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/). Other agents that support skills may also work.
- **npm** — the installer runs via `npx`, which ships with [npm](https://www.npmjs.com/).
- **A container runtime** — [Docker](https://github.com/docker) and [Docker Compose](https://docs.docker.com/compose/install/), or [Podman](https://podman.io/).
- **[Snouty CLI](https://github.com/antithesishq/snouty)** — used by multiple skills to search docs, validate configurations, and submit test runs.
- **[agent-browser](https://github.com/vercel-labs/agent-browser)** — optional, used by the triage, debug, and query-logs skills to interact with the Antithesis web UI.

## Installation by platform

- [Debian-based Linux](#debian-based-linux)
- [macOS](#macos)

## Debian-based Linux

These instructions use `apt` and work on Debian, Ubuntu, and other Debian-based distributions.

### Base Tools

```bash
sudo apt update
sudo apt install -y curl
```

### npm

```bash
sudo apt install -y npm
```

### Container Runtime

Install one of the following:

**Docker and Docker Compose:**

```bash
sudo apt install -y docker.io docker-compose-v2 docker-buildx
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect.

**Podman:**

```bash
sudo apt install -y podman podman-compose
```

### Snouty CLI

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/antithesishq/snouty/releases/latest/download/snouty-installer.sh | sh
```

### agent-browser (optional)

```bash
npm install -g agent-browser
agent-browser install --with-deps
```

The `install --with-deps` flag installs required system dependencies and downloads Chrome for Testing.

### AI Agent

Install one (or both) of the following:

**Claude Code:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

**OpenAI Codex:**

```bash
npm install -g @openai/codex
```

## macOS

### Base Tools

Install [Homebrew](https://brew.sh) if you don't already have it:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### npm

```bash
brew install npm
```

### Container Runtime

Install one of the following:

**Docker and Docker Compose:**

[Docker Desktop](https://www.docker.com/products/docker-desktop/) includes Docker Engine, Docker Compose, and multi-platform build support:

```bash
brew install --cask docker
```

After installing, open Docker Desktop at least once to complete setup.

Antithesis runs on x86-64, so all images must target `linux/amd64`. On Apple Silicon (ARM) Macs, Docker Desktop handles this through its bundled buildx support — no extra configuration is needed, but builds will be slower due to emulation.

**Podman:**

```bash
brew install podman podman-compose
podman machine init
podman machine start
```

### Snouty CLI

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/antithesishq/snouty/releases/latest/download/snouty-installer.sh | sh
```

### agent-browser (optional)

```bash
brew install agent-browser
agent-browser install
```

The `install` step downloads Chrome for Testing on first use.

### AI Agent

Install one (or both) of the following:

**Claude Code:**

```bash
brew install --cask claude-code
```

**OpenAI Codex:**

```bash
brew install --cask codex
```

