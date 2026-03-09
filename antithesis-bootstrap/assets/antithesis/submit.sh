#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--duration minutes] [--desc <description>]" >&2
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

# TODO: Build the SUT docker images.
# Make sure any private images referenced by antithesis/config/docker-compose.yaml
# are tagged under ANTITHESIS_REPOSITORY so snouty can discover and push them.

if [[ -z "${ANTITHESIS_REPOSITORY:-}" ]]; then
  echo "ANTITHESIS_REPOSITORY must be set in the environment." >&2
  exit 1
fi

# Docker or Podman must already be logged into ANTITHESIS_REPOSITORY.
# Antithesis-managed registries are typically configured during onboarding.
# User-managed registries must be configured by the user before running this script.

if ! command -v snouty >/dev/null 2>&1; then
  echo "snouty is required to launch Antithesis runs. Install it from https://github.com/orbitinghail/snouty" >&2
  exit 1
fi

# Snouty automatically discovers image: references in docker-compose.yaml and
# pushes the ones already tagged under ANTITHESIS_REPOSITORY before uploading
# the config image. antithesis.images does not need to be passed explicitly.

PROJECT_NAME="TODO: set project name"
GIT_REV="$(git rev-parse HEAD)"
RUN_DESCRIPTION="$PROJECT_NAME (rev ${GIT_REV})"
if [[ -n "$USER_DESCRIPTION" ]]; then
  RUN_DESCRIPTION="${RUN_DESCRIPTION} - ${USER_DESCRIPTION}"
fi

snouty run \
  --webhook basic_test \
  --config antithesis/config \
  --test-name "$PROJECT_NAME" \
  --description "$RUN_DESCRIPTION" \
  --duration "$DURATION"
