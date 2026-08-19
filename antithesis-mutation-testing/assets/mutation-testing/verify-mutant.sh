#!/usr/bin/env bash
# Prove a built mutant image actually carries its patch, before a run is spent.
#
# Brings the fork's compose up locally, waits for setup_complete, and greps the
# container output for that mutant's announcement. This is the one check between
# a silently-unpatched build and a survivor that gets misread as a catalog gap.
set -euo pipefail

# `git -C DIR` only changes directory: GIT_DIR, GIT_WORK_TREE and friends take
# precedence over repository discovery, so inheriting them points every git
# command below at whatever repo the caller was in. Hooks export
# GIT_INDEX_FILE and `git submodule foreach` exports GIT_DIR, so this is
# reachable from an ordinary invocation, and it defeats the entire fork model.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
      GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_PREFIX

WORK=""
PATCHES=""
IMAGES=""
CONFIG="antithesis/config"
TIMEOUT=""
TARGET=""

usage() {
  cat <<'USAGE'
Usage: verify-mutant.sh <mutant-id> --fork DIR --patches DIR --images FILE
                        [--config REL] [--timeout SECS]

  --fork      The fork to bring up.
  --patches   Directory of <mutant-id>.patch files.
  --images    File listing the image names to retag, one per line.
  --config    Compose directory, relative to the fork (default: antithesis/config).
  --timeout   Passed to `snouty validate`, whose own default is 60s. Derive it
              from the baseline's observed setup time: a SUT with migrations or
              a multi-node cluster exceeds 60s for reasons that have nothing to
              do with the mutant.

Selects the mutant, runs `snouty validate --keep-running`, greps the container
logs for `ANTITHESIS MUTANT ACTIVE: <mutant-id>`, and tears the containers down.
Exits non-zero if the announcement is absent -- do not launch that mutant.
USAGE
}

die() { echo "verify-mutant.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --fork) WORK="${2:?--fork needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    --images) IMAGES="${2:?--images needs a value}"; shift 2 ;;
    --config) CONFIG="${2:?--config needs a value}"; shift 2 ;;
    --timeout) TIMEOUT="${2:?--timeout needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$TARGET" ] || die "only one mutant id may be given"; TARGET="$1"; shift ;;
  esac
done

[ -n "$TARGET" ] || { usage >&2; exit 2; }
[ "$TARGET" = "baseline" ] && die "the baseline carries no announcement; it is unpatched by construction"
[ -n "$WORK" ] || { echo "verify-mutant.sh: --fork is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "verify-mutant.sh: --patches is required" >&2; usage >&2; exit 2; }
[ -n "$IMAGES" ] || { echo "verify-mutant.sh: --images is required" >&2; usage >&2; exit 2; }
command -v snouty >/dev/null || die "snouty is required"

# Peer scripts are looked up next to this one, then on PATH. That is the only
# thing this script's own location is used for.
SCRIPT_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
SELECT="$SCRIPT_DIR/select-mutant.sh"
if [ ! -x "$SELECT" ]; then
  SELECT=$(command -v select-mutant.sh 2>/dev/null) ||
    die "cannot find select-mutant.sh next to $SCRIPT_DIR or on PATH"
fi

COMPOSE="$WORK/$CONFIG/docker-compose.yaml"
[ -f "$COMPOSE" ] || die "no docker-compose.yaml at $COMPOSE"

# Compose front-end. snouty execs `docker-compose` (Docker Compose v2) and says
# so outright when it is missing, so prefer that binary: it is the front-end the
# validate and launch will use, which is what makes this build a cache hit for
# them. The `docker compose` plugin is accepted as a fallback for these local
# operations, but a host without `docker-compose` cannot run snouty at all.
# `podman compose` is not supported; podman as the runtime, via DOCKER_HOST, is.
COMPOSE_CMD=()
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
  echo "warning: using the 'docker compose' plugin; snouty itself requires the 'docker-compose' binary and will fail without it" >&2
else
  die "no compose front-end found: install Docker Compose v2 (the 'docker-compose' binary), which snouty requires"
fi


# Isolate the compose project. Without this, the project name is the basename of
# the compose file's directory -- "config" -- which is also what the user's own
# antithesis/config stack uses, so a teardown here would destroy their running
# containers and volumes. snouty passes no -p, so exporting this covers the
# stack `snouty validate` brings up as well as our own calls.
export COMPOSE_PROJECT_NAME="antimut-$(printf '%s' "$WORK" | cksum | awk '{print $1}')"

"$SELECT" "$TARGET" --fork "$WORK" --patches "$PATCHES" \
  --images "$IMAGES" --config "$CONFIG"

teardown() { "${COMPOSE_CMD[@]}" -f "$COMPOSE" down -v >/dev/null 2>&1 || true; }
trap teardown EXIT
# Containers left over from an earlier verify keep their logs, and those logs
# carry this mutant's announcement. Grepping them would pass a rebuilt image
# that no longer contains the patch, so start from nothing.
teardown

VALIDATE=(snouty validate "$WORK/$CONFIG" --keep-running)
[ -n "$TIMEOUT" ] && VALIDATE+=(--timeout "$TIMEOUT")
"${VALIDATE[@]}" || die "snouty validate failed for '$TARGET'; if it also fails for the baseline this is a harness problem, not a mutant defect"

NEEDLE="ANTITHESIS MUTANT ACTIVE: $TARGET"
# Anchored on the id's trailing edge: a plain substring test lets `m03-drop`
# verify itself against `m03-drop-ack`'s announcement, passing a mutant that was
# never built.
TESC=$(printf '%s' "$TARGET" | sed 's/[][\.*^$+?(){}|\\]/\\&/g')
# Capture to a file rather than piping: `grep -q` exits at the first match, and
# under pipefail the still-writing producer's SIGPIPE becomes the pipeline's
# status -- reporting a successful match as a failure. 2>&1 because compose
# writes container stderr to its own stderr, which is where many SUTs announce.
LOGS=$(mktemp "${TMPDIR:-/tmp}/verify-mutant.XXXXXX")
trap 'teardown; rm -f "$LOGS"' EXIT
# A failed or empty fetch is a harness fault, not evidence about the mutant.
# Reporting it as "does not carry the patch" sends the operator into rebuilding
# a sound image -- and the error text is inside $LOGS, which the trap deletes.
if ! "${COMPOSE_CMD[@]}" -f "$COMPOSE" logs > "$LOGS" 2>&1; then
  cat "$LOGS" >&2
  die "'${COMPOSE_CMD[*]} logs' failed, so '$TARGET' is unverified. Fix that first; this says nothing about the image"
fi
if [ ! -s "$LOGS" ]; then
  die "the container logs are empty, so '$TARGET' is unverified. Check '${COMPOSE_CMD[*]} -f $COMPOSE ps': snouty may have brought the stack up under a different compose project name than this command reads"
fi
if grep -qE "ANTITHESIS MUTANT ACTIVE: ${TESC}([^A-Za-z0-9._-]|\$)" "$LOGS"; then
  echo "verified: '$NEEDLE' present; $TARGET is safe to launch"
else
  die "'$NEEDLE' absent from the container logs: this image does not carry the patch. Rebuild it and re-verify; do not launch it"
fi
