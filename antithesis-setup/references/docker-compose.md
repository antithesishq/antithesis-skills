# Docker Compose

How to write the docker-compose.yaml.

## Goal

Create a working Docker Compose config at `antithesis/config/docker-compose.yaml`.

## Project Name

Set the top-level `name:` field to the SUT's project name. This controls the Compose project name and auto-prefixes service containers, networks, and volumes. For example, for a project called `foobar`:

```yaml
name: foobar
```

## Container Name and Hostname

Every service must set both `container_name:` and `hostname:` to the same value. Antithesis sometimes uses `hostname` rather than `container_name` in it's log messages, so making sure they are the same will eliminate ambiguity during log analysis.

Do not use underscores in `hostname` or `container_name` — underscores are not valid DNS label characters and can break name resolution. Use hyphens (e.g. `foobar-server`, not `foobar_server`).

## Image References

Services use one of two patterns:

- **Local images** use `build:` with a context path and `image:` with `name:tag`. Build these before invoking `snouty launch`.
- **Public images** use `image:` directly (e.g. `docker.io/library/postgres:17.2`).

Every service must include `platform: linux/amd64` because Antithesis runs on x86-64. This applies to both local and public images — without it, builds and pulls on ARM hosts (e.g. macOS Apple Silicon) will produce the wrong architecture.

Example:

```yaml
name: foobar

services:
  server:
    container_name: foobar-server
    hostname: foobar-server
    platform: linux/amd64
    init: true
    build:
      context: ../..
      dockerfile: Dockerfile
    image: foobar-server:latest

  postgres:
    container_name: foobar-postgres
    hostname: foobar-postgres
    platform: linux/amd64
    init: true
    image: docker.io/library/postgres:17.2
```

## Podman Compose Compatibility

Antithesis uses `podman compose` behind the scenes. For compatibility, prefer `podman compose` over `docker compose` when testing locally. Use `podman compose` if available; otherwise fall back to `docker compose`.

## Hermetic Execution

The compose config must run without internet access. All images must be pre-built or available in the Antithesis registry.

## setup_complete Signal

Ensure at least one entrypoint emits the `setup_complete` event. Use `antithesis/setup-complete.sh` or call the SDK's setup complete method. Only emit once the system is healthy and ready for testing. Do not emit `setup_complete` from `antithesis/test/` or from any `first_` command; those commands do not start until after Antithesis has already observed `setup_complete`.

## Runtime Compose Rules

### Set `init: true` on every service

Without it, the service's own entrypoint becomes pid 1 — and Antithesis cannot collect core dumps from a pid 1 process. `init: true` inserts a tiny init process so the real service runs under it and crashes remain diagnosable.

### Order services with healthchecks, not plain `depends_on`

Plain `depends_on` waits only for the container to start — not for the service inside it to be ready. Give each dependency a `healthcheck` and reference it with `condition: service_healthy`:

```yaml
services:
  postgres:
    image: docker.io/library/postgres:17.2
    init: true
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 2s
      retries: 30

  server:
    image: foobar-server:latest
    init: true
    depends_on:
      postgres:
        condition: service_healthy
```

### Things NOT to set

- **`logging:` driver** — do NOT override. Antithesis collects stdout/stderr directly; a custom driver will still generate logs, but they will not appear in the debugging artifacts.
- **`internal: true` on any network** — do NOT configure. It isolates the service from the Antithesis network and breaks connectivity.
- **`pull_policy:`** — do NOT set. The Antithesis environment has no internet access, so anything that tries to pull at runtime will fail. Antithesis pulls all required images automatically before running `docker compose`.

## Named Volumes

If you need reliable communication between containers, mount a named volume to every container. Useful for sharing configuration files.

## Test Template Mounting

Ensure the test directory path will be available at `/opt/antithesis/test/v1/` in the appropriate container(s) once workload code is added. This skill only needs to wire the environment so later workload templates can run there; defining those templates belongs to `antithesis-workload`.
