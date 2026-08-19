#!/usr/bin/env bash
# Build the baseline and one image set per mutant, each under its own tag.
#
# INTENT
#   Leave one locally-built image set per mutant, tagged mut-<id>, plus the
#   baseline, so a launch can select any of them without rebuilding.
#
# ASSUMES
#   - --fork was made by fork.sh, and select-mutant.sh sits beside this script.
#   - A Compose v2 front-end is on PATH; `docker-compose` is the one snouty
#     itself execs.
#   - --images is non-empty and every entry is retaggable (see select-mutant.sh).
#
# GUARANTEES
#   - Every build runs in its own compose project, never the user's.
#   - The fork is left on the baseline.
#   - Exits non-zero, naming them, if any mutant failed to build.
#
# Does not push: snouty pushes the images the compose references at launch.
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
ONLY=""
BASELINE=1

usage() {
  cat <<'USAGE'
Usage: build-mutants.sh --fork DIR --patches DIR --images FILE
                        [--config REL] [--only ID[,ID...]] [--no-baseline]

  --fork      The fork to build from.
  --patches   Directory of <mutant-id>.patch files; the patch set is the mutant list.
  --images    File listing the image names to retag, one per line.
  --config    Compose directory, relative to the fork (default: antithesis/config).
  --only      Build just these mutant ids.
  --no-baseline  Skip the baseline build.

Builds the baseline from mutation-base, then one image set per patch, tagging
each `baseline` or `mut-<id>`. A mutant whose patch no longer applies is
reported and skipped; the rest still build. Slow: run it in the background or
with a generous timeout.
USAGE
}

die() { echo "build-mutants.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --fork) WORK="${2:?--fork needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    --images) IMAGES="${2:?--images needs a value}"; shift 2 ;;
    --config) CONFIG="${2:?--config needs a value}"; shift 2 ;;
    --only) ONLY="${2:?--only needs a value}"; shift 2 ;;
    --no-baseline) BASELINE=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$WORK" ] || { echo "build-mutants.sh: --fork is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "build-mutants.sh: --patches is required" >&2; usage >&2; exit 2; }
[ -n "$IMAGES" ] || { echo "build-mutants.sh: --images is required" >&2; usage >&2; exit 2; }

# ASSUMES: --fork was made by fork.sh. Check it here rather than relying on a
# later call to notice, so a wrong --fork stops before anything acts on it.
[ -d "$WORK" ] || die "--fork is not a directory: $WORK"
[ -e "$WORK/.git/antithesis-mutation-fork" ] ||
  die "$WORK is not a mutation fork (no .git/antithesis-mutation-fork marker); run fork.sh first"
git -C "$WORK" rev-parse -q --verify refs/tags/mutation-base >/dev/null 2>&1 ||
  die "$WORK has no mutation-base tag; run fork.sh first"

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
# Hash the canonical path, so "$FORK" and "$FORK/" name the same project and a
# teardown cannot miss the stack an earlier call brought up.
WORK_CANON=$(cd -P "$WORK" && pwd) || die "--fork is not a usable directory: $WORK"
export COMPOSE_PROJECT_NAME="antimut-$(printf '%s' "$WORK_CANON" | cksum | awk '{print $1}')"

# A typo in --only must not look like a successful rebuild: the launch that
# follows would use whatever stale image the previous round left under that tag.
# Checked before anything is built, so it costs no build time and leaves the
# fork untouched.
if [ -n "$ONLY" ]; then
  IFS=',' read -r -a WANTED <<< "$ONLY"
  for w in ${WANTED[@]+"${WANTED[@]}"}; do
    [ -n "$w" ] || continue
    [ "$w" = "baseline" ] && continue   # not a patch; --only baseline is legal
    [ -f "$PATCHES/$w.patch" ] || die "--only names '$w', which has no patch in $PATCHES"
  done
fi

# Newline-delimited rather than an array: bash 3.2 (macOS) errors on
# ${#arr[@]} for an empty array under set -u.
FAILED=""
build_one() {
  target="$1"
  if ! "$SELECT" "$target" --fork "$WORK" --patches "$PATCHES" \
       --images "$IMAGES" --config "$CONFIG"; then
    FAILED="$FAILED  $target (could not select)
"
    return 1
  fi
  echo "building $target ..."
  if ! "${COMPOSE_CMD[@]}" -f "$COMPOSE" build; then
    FAILED="$FAILED  $target (build failed)
"
    return 1
  fi
  return 0
}

# `|| true`: a bare call here is the last command of the if-body, so set -e
# would exit before the FAILED summary below ever prints.
if [ "$BASELINE" -eq 1 ]; then
  build_one baseline || true
fi

BUILT=0
NOPATCHES=0
for p in "$PATCHES"/*.patch; do
  [ -e "$p" ] || { NOPATCHES=1; break; }
  id=$(basename "$p" .patch)
  if [ -n "$ONLY" ]; then
    case ",$ONLY," in *",$id,"*) ;; *) continue ;; esac
  fi
  if build_one "$id"; then BUILT=$((BUILT + 1)); fi
done

# An empty patch set is correct at the baseline gate and a mistake afterwards:
# exiting 0 having built nothing but the baseline reads as a successful rebuild.
if [ "${NOPATCHES:-0}" -eq 1 ]; then
  if [ "$BASELINE" -eq 1 ]; then
    echo "no patches in $PATCHES yet; built the baseline only" >&2
  else
    die "no patches in $PATCHES and --no-baseline given; nothing to build"
  fi
fi

# Leave the fork pristine so a stray build cannot pick up a mutant by accident.
# Not fatal on its own: under `set -e` a failure here would kill the script
# before the FAILED summary below, hiding which mutants must not be launched.
"$SELECT" baseline --fork "$WORK" --patches "$PATCHES" \
  --images "$IMAGES" --config "$CONFIG" >/dev/null ||
  echo "warning: could not reset the fork to baseline; do not build or launch from it as-is" >&2

echo "built $BUILT mutant image set(s)."
if [ -n "$FAILED" ]; then
  echo "FAILED:" >&2
  printf '%s' "$FAILED" >&2
  echo "do not launch these; fix them first" >&2
  exit 1
fi
echo "select a target with select-mutant.sh before launching."
