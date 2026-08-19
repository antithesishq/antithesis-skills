#!/usr/bin/env bash
# Put the fork into one mutant's state: reset to mutation-base, apply that
# mutant's patch, and point the compose images at that mutant's tag.
#
# Run this before building the mutant AND again before launching it, so the
# tree the launch skill builds from is the tree the mutant was verified in.
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
TARGET=""

usage() {
  cat <<'USAGE'
Usage: select-mutant.sh <mutant-id|baseline> --fork DIR --patches DIR
                        --images FILE [--config REL]

  --fork      The fork to put into this mutant's state.
  --patches   Directory of <mutant-id>.patch files.
  --images    File listing the image names to retag, one per line, each the
              whole `image:` reference minus its tag.
  --config    Compose directory, relative to the fork (default: antithesis/config).
USAGE
}

die() { echo "select-mutant.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --fork) WORK="${2:?--fork needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    --images) IMAGES="${2:?--images needs a value}"; shift 2 ;;
    --config) CONFIG="${2:?--config needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1" ;;
    *) [ -z "$TARGET" ] || die "only one target may be given (got '$TARGET' and '$1')"; TARGET="$1"; shift ;;
  esac
done

[ -n "$TARGET" ] || { echo "select-mutant.sh: a target is required" >&2; usage >&2; exit 2; }
[ -n "$WORK" ] || { echo "select-mutant.sh: --fork is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "select-mutant.sh: --patches is required" >&2; usage >&2; exit 2; }
[ -n "$IMAGES" ] || { echo "select-mutant.sh: --images is required" >&2; usage >&2; exit 2; }
[ -f "$IMAGES" ] || die "missing $IMAGES; list the image names the sweep retags"

COMPOSE="$WORK/$CONFIG/docker-compose.yaml"
[ -f "$COMPOSE" ] || die "no docker-compose.yaml at $COMPOSE"
# rsync preserves symlinks, so a compose file that is a link to somewhere in the
# user's tree still points there inside the fork -- and the retag below would
# write through it, editing their real file.
COMPOSE_REAL="$COMPOSE"
hops=0
while [ -L "$COMPOSE_REAL" ]; do
  hops=$((hops + 1))
  [ "$hops" -gt 20 ] && die "symlink loop resolving $COMPOSE"
  link=$(readlink "$COMPOSE_REAL")
  case "$link" in
    /*) COMPOSE_REAL="$link" ;;
    *)  COMPOSE_REAL="$(dirname "$COMPOSE_REAL")/$link" ;;
  esac
done
COMPOSE_REAL=$(cd -P "$(dirname "$COMPOSE_REAL")" && pwd -P)/$(basename "$COMPOSE_REAL")
WORK_REAL=$(cd -P "$WORK" && pwd -P)
case "$COMPOSE_REAL" in
  "$WORK_REAL"/*) ;;
  *) die "compose file resolves outside the fork ($COMPOSE_REAL); refusing to write through it" ;;
esac

if [ "$TARGET" = "baseline" ]; then
  TAG="baseline"
  PATCH=""
else
  TAG="mut-$TARGET"
  PATCH="$PATCHES/$TARGET.patch"
  [ -f "$PATCH" ] || die "no patch for '$TARGET' at $PATCH"
fi

# Between the checkout below and the retag loop, the fork holds mutated source
# under the user's own image tags. A build landing there would push a mutated
# image to their real tag, so any failure resets the fork rather than leaving it.
SELECT_OK=0
reset_on_fail() {
  [ "$SELECT_OK" -eq 1 ] && return 0
  git -C "$WORK" checkout -q -f mutation-base 2>/dev/null || true
  git -C "$WORK" clean -qfd 2>/dev/null || true
  echo "select-mutant.sh: select failed; fork reset to mutation-base" >&2
}
trap reset_on_fail EXIT

git -C "$WORK" checkout -q -f mutation-base
git -C "$WORK" clean -qfd
if [ -n "$PATCH" ]; then
  git -C "$WORK" -c apply.whitespace=nowarn apply "$PATCH" 2>/dev/null ||
    git -C "$WORK" -c apply.whitespace=nowarn apply -3 "$PATCH" ||
    die "patch for '$TARGET' no longer applies to mutation-base; re-author it"
fi

RETAGGED=0
while IFS= read -r name || [ -n "$name" ]; do
  name="${name%%#*}"
  name="$(printf '%s' "$name" | tr -d '[:space:]')"
  [ -n "$name" ] || continue
  esc=$(printf '%s' "$name" | sed 's/[.[\*^$]/\\&/g')
  tmp=$(mktemp "${TMPDIR:-/tmp}/select-mutant.XXXXXX")
  # Anchor to a YAML `image:` key at the start of its line, so a comment, an
  # `org.opencontainers.image:` label, or a `sut_image:` env var cannot satisfy
  # the check while the real service goes un-retagged. Excluding `/` from the
  # tag stops a truncated entry ("localhost") from eating a registry port and
  # the path after it.
  sed -E "s#^([[:space:]]*image:[[:space:]]*[\"']?)${esc}:[^[:space:]\"'/]+#\1${name}:${TAG}#" "$COMPOSE" > "$tmp"
  cat "$tmp" > "$COMPOSE"
  rm -f "$tmp"
  # Anchor the check to the image: key. A bare substring test passes when one
  # listed name is a suffix of another ('app' matching inside 'myapp:baseline'),
  # reporting a retag that never happened and launching a stale image.
  grep -Eq "^[[:space:]]*image:[[:space:]]*[\"']?${esc}:${TAG}([[:space:]\"']|\$)" "$COMPOSE" ||
    die "could not retag '$name' in $COMPOSE: no service has 'image: $name:<tag>'. The entry must match the whole reference minus its tag (e.g. ghcr.io/org/app, not app), and that reference must carry an explicit tag"
  RETAGGED=$((RETAGGED + 1))
done < "$IMAGES"

[ "$RETAGGED" -gt 0 ] ||
  die "$IMAGES lists no images, so nothing was retagged; every mutant would build into the same tag"

SELECT_OK=1
echo "selected: $TARGET (tag $TAG, $RETAGGED image(s) retagged)"
