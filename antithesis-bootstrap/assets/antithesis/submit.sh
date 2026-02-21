#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [--duration seconds] [--registry <registry>] [--desc <description>]" >&2
}

DURATION="60"
REGISTRY=""
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
    --registry)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --registry" >&2
        usage
        exit 2
      fi
      REGISTRY="$2"
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

if [[ -n "$REGISTRY" ]]; then
  CONFIG_IMAGE="${REGISTRY}/config:latest"
else
  CONFIG_IMAGE="config"
fi

# TODO: Build SUT docker images.
# Making sure to tag them with the provided registry if specified.

SUT_IMAGES="image1:tag,image2:tag" # TODO: set the actual images built, comma-separated

# Build the config image
docker build -f antithesis/config/Dockerfile -t $CONFIG_IMAGE antithesis/config

if [[ -z "$REGISTRY" ]]; then
  echo "Build complete: no --registry provided, skipped push and test run."
  exit 0
fi

# TODO: Push all docker images to the registry
docker push $CONFIG_IMAGE

PROJECT_NAME="TODO: set project name"
GIT_REV="$(git rev-parse HEAD)"
RUN_DESCRIPTION="$PROJECT_NAME (rev ${GIT_REV})"
if [[ -n "$USER_DESCRIPTION" ]]; then
  RUN_DESCRIPTION="${RUN_DESCRIPTION} - ${USER_DESCRIPTION}"
fi

# Build test run params (JSON)
DATA=json=$(
  jq -n \
    --arg test_name "$PROJECT_NAME" \
    --arg description "$RUN_DESCRIPTION" \
    --arg config_image "$CONFIG_IMAGE" \
    --arg images "$SUT_IMAGES" \
    --arg duration "$DURATION" \
    '{ params: {
      antithesis.test_name: $test_name,
      antithesis.description: $description,
      antithesis.config_image: $config_image,
      antithesis.images: $images,
      antithesis.duration: $duration
    }}'
)

curl --fail \
  -X POST \
  -u "${ANTITHESIS_USERNAME}:${ANTITHESIS_PASSWORD}" \
  "https://${ANTITHESIS_TENANT}.antithesis.com/api/v1/launch/basic_test" \
  -d "$DATA"
