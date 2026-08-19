# Prerequisites

You need the following to use antithesis-skills:

- **An AI agent** that supports skills — tested with [Claude Code](https://code.claude.com/docs) and [OpenAI Codex](https://learn.chatgpt.com/docs/codex/cli). Other agents that support skills may also work.
- **npm** — the installer runs via `npx`, which ships with [npm](https://www.npmjs.com/).
- **Docker Compose v2** — snouty drives either the standalone [`docker-compose` binary](https://docs.docker.com/compose/install/standalone/) or the [`docker compose` CLI plugin](https://docs.docker.com/compose/install/). `podman compose` and `podman-compose` are not supported. snouty 0.6.1 and earlier accept the standalone binary only, so install the standalone binary if you are unsure which snouty version you run.
- **A container engine** — [Docker](https://github.com/docker) or [Podman](https://podman.io/), used to build and push images.
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

### Container Engine and Docker Compose v2

The compose CLI and the container engine are two separate choices. Antithesis
runs the standalone `docker-compose` binary against podman, and snouty drives
Docker Compose v2 the same way. Neither uses `podman compose` or
`podman-compose`. Install one of the two combinations below.

snouty 0.6.1 and earlier accept the standalone `docker-compose` binary only. Add
the standalone binary to the Docker combination as well if you run one of those
versions.

**Docker with the `docker compose` CLI plugin:**

```bash
sudo apt install -y docker.io docker-compose-v2 docker-buildx
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect.

**Podman with the standalone `docker-compose` binary:**

```bash
sudo apt install -y podman
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

The `docker-compose-v2` package ships the plugin only, at
`/usr/libexec/docker/cli-plugins/docker-compose`, so it puts no `docker-compose`
on `PATH`. Podman needs the standalone binary. See the
[standalone install docs](https://docs.docker.com/compose/install/standalone/)
for other architectures.

Run `snouty doctor` after installing to confirm which compose CLI and container
engine snouty selects.

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

### Container Engine and Docker Compose v2

The compose CLI and the container engine are two separate choices. Antithesis
runs the standalone `docker-compose` binary against podman, and snouty drives
Docker Compose v2 the same way. Neither uses `podman compose` or
`podman-compose`. Install one of the two combinations below.

snouty 0.6.1 and earlier accept the standalone `docker-compose` binary only. Add
the standalone binary to the Docker combination as well if you run one of those
versions.

**Docker with Docker Compose:**

[Docker Desktop](https://www.docker.com/products/docker-desktop/) includes Docker Engine, Docker Compose, and multi-platform build support:

```bash
brew install --cask docker
```

After installing, open Docker Desktop at least once to complete setup.

Antithesis runs on x86-64, so all images must target `linux/amd64`. On Apple Silicon (ARM) Macs, Docker Desktop handles this through its bundled buildx support — no extra configuration is needed, but builds will be slower due to emulation.

**Podman with the standalone `docker-compose` binary:**

```bash
brew install podman docker-compose
podman machine init
podman machine start
```

Run `snouty doctor` after installing to confirm which compose CLI and container
engine snouty selects.

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

