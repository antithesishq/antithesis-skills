#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/config/docker-compose.yaml"
COMPOSE_WAIT_TIMEOUT_SECONDS="30"

compose() {
  # Antithesis uses podman compose behind the scenes, so prefer it locally
  # for increased compatibility; fall back to docker compose if unavailable.
  if command -v podman &>/dev/null; then
    podman compose -f "${COMPOSE_FILE}" "$@"
  else
    docker compose -f "${COMPOSE_FILE}" "$@"
  fi
}

# TODO: build any required docker images before testing. If the compose file uses
# `build:` directives, you can use `compose build` to build all images locally.

if ! compose up -d --wait --wait-timeout "${COMPOSE_WAIT_TIMEOUT_SECONDS}"; then
  echo "Timed out waiting for compose services to become ready." >&2
  echo "Recent logs:" >&2
  compose logs --no-color --tail=200 >&2 || true
  exit 1
fi

# TODO: once the workload exists, run the relevant test commands here.
# This script's primary responsibility is to verify the harness can start,
# become ready, and remain healthy in a mostly idle state.

compose down
