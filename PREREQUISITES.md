# Prerequisites

You need the following to use antithesis-skills:

- **An AI agent** that supports skills — tested with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [OpenAI Codex](https://openai.com/index/openai-codex/). Other agents that support skills may also work.
- **npm** — the installer runs via `npx`, which ships with [npm](https://www.npmjs.com/).
- **A container runtime** — [Docker](https://github.com/docker) and [Docker Compose](https://docs.docker.com/compose/install/), or [Podman](https://podman.io/).
- **[Snouty CLI](https://github.com/antithesishq/snouty)** — used by multiple skills to search docs, validate configurations, and submit test runs.

## Installation by platform

- [Debian](#debian)
- [macOS](#macos)
- [Ubuntu](#ubuntu)

## Debian

These instructions are written for Debian Trixie but should work on other Debian releases.

### npm

```bash
sudo apt update
sudo apt install -y npm
```

### Container Runtime

Install one of the following:

**Docker and Docker Compose:**

```bash
sudo apt install -y docker.io docker-compose-v2
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

## Ubuntu

### npm

```bash
sudo apt update
sudo apt install -y npm
```

### Container Runtime

Install one of the following:

**Docker and Docker Compose:**

```bash
sudo apt install -y docker.io docker-compose-v2
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
