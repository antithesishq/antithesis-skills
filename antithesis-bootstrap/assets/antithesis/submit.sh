#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/config/docker-compose.yaml"

usage() {
  echo "Usage: $0 [--duration minutes] [--desc <description>]" >&2
}

compose() {
  # Antithesis uses podman compose behind the scenes, so prefer it locally
  # for increased compatibility; fall back to docker compose if unavailable.
  if command -v podman >/dev/null 2>&1; then
    podman compose -f "${COMPOSE_FILE}" "$@"
  else
    docker compose -f "${COMPOSE_FILE}" "$@"
  fi
}

DURATION="60"
USER_DESCRIPTION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --duration)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --duration" >&2
        usage
        exit 2
      fi
      DURATION="$2"
      shift 2
      ;;
    --desc)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --desc" >&2
        usage
        exit 2
      fi
      USER_DESCRIPTION="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "${ANTITHESIS_REPOSITORY:-}" ]]; then
  echo "ANTITHESIS_REPOSITORY must be set in the environment." >&2
  exit 1
fi

# Docker or Podman must already be logged into ANTITHESIS_REPOSITORY.
# Antithesis-managed registries are typically configured during onboarding.
# User-managed registries must be configured by the user before running this script.

if ! command -v snouty >/dev/null 2>&1; then
  echo "snouty is required to launch Antithesis runs. Install it from https://github.com/antithesishq/snouty" >&2
  exit 1
fi

# Build local images from `build:` directives before submission. Snouty then:
# - Pushes all images tagged under ANTITHESIS_REPOSITORY
# - Interpolates environment variables in docker-compose.yaml
# - Uses the --config directory to launch the run

PROJECT_NAME="TODO: set project name"
GIT_REV="$(git rev-parse HEAD)"
RUN_DESCRIPTION="$PROJECT_NAME (rev ${GIT_REV})"
if [[ -n "$USER_DESCRIPTION" ]]; then
  RUN_DESCRIPTION="${RUN_DESCRIPTION} - ${USER_DESCRIPTION}"
fi

compose build

snouty run \
  --webhook basic_test \
  --config antithesis/config \
  --test-name "$PROJECT_NAME" \
  --description "$RUN_DESCRIPTION" \
  --duration "$DURATION"
