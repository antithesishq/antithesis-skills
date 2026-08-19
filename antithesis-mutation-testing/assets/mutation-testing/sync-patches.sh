#!/usr/bin/env bash
# Regenerate the patch directory from the fork's mut/* branches.
#
# Each patch is a diff against mutation-base, so every patch applies
# independently. Mutants are siblings, never a stack.
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
FORCE=0

usage() {
  cat <<'USAGE'
Usage: sync-patches.sh --fork DIR --patches DIR [--force]

  --fork      The fork holding the mut/* branches to export.
  --patches   Directory the patches are written to. Created if absent.
  --force     Allow the patch count to shrink (a mutant was retired).
USAGE
}

die() { echo "sync-patches.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --fork) WORK="${2:?--fork needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$WORK" ] || { echo "sync-patches.sh: --fork is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "sync-patches.sh: --patches is required" >&2; usage >&2; exit 2; }

git -C "$WORK" rev-parse mutation-base >/dev/null 2>&1 ||
  die "$WORK has no mutation-base tag; is it a fork?"

BRANCHES=$(git -C "$WORK" for-each-ref --format='%(refname:short)' 'refs/heads/mut/*')
[ -n "$BRANCHES" ] || die "no mut/* branches in $WORK; author each mutant on its own branch off mutation-base"

NEW=0
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/sync-patches.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT

while IFS= read -r b; do
  [ -n "$b" ] || continue
  id="${b#mut/}"
  case "$id" in
    */*|"") die "bad branch name '$b'; expected mut/<mutant-id>" ;;
  esac
  if git -C "$WORK" diff --quiet mutation-base "$b"; then
    echo "warning: branch $b is empty; skipping" >&2
    continue
  fi
  # Pin the diff format: a user's diff.external or diff.noprefix would otherwise
  # produce patches git cannot apply, and the old ones are deleted below first.
  git -C "$WORK" -c diff.external= -c diff.noprefix=false \
    diff --no-ext-diff --binary --src-prefix=a/ --dst-prefix=b/ \
    mutation-base "$b" > "$STAGE/$id.patch"
  NEW=$((NEW + 1))
  case "$id" in
    m[0-9][0-9]-*) ;;
    *) echo "warning: '$id' is not a mNN-<slug> mutant id" >&2 ;;
  esac
done <<EOF
$BRANCHES
EOF

[ "$NEW" -gt 0 ] || die "nothing to export; refusing to wipe $PATCHES"

mkdir -p "$PATCHES"
OLD=0
for f in "$PATCHES"/*.patch; do
  [ -e "$f" ] && OLD=$((OLD + 1))
done
if [ "$NEW" -lt "$OLD" ] && [ "$FORCE" -eq 0 ]; then
  die "would go from $OLD patch(es) to $NEW; re-run with --force if that is intended"
fi

# Stage the whole new set alongside the old one first, then retire what it
# replaces, then rename into place. Deleting first means any failure part-way --
# a stray directory, ENOSPC, a SIGINT -- leaves the patch set gone and nothing
# written. The rename also keeps a concurrent select from reading a half-written
# patch, which could still apply and yield an image with the announcement but
# not the bug.
for f in "$STAGE"/*.patch; do
  cp "$f" "$PATCHES/.tmp-$(basename "$f")"
done
for f in "$PATCHES"/*.patch; do
  [ -f "$f" ] || continue
  [ -f "$STAGE/$(basename "$f")" ] || rm -f "$f"
done
for f in "$STAGE"/*.patch; do
  mv "$PATCHES/.tmp-$(basename "$f")" "$PATCHES/$(basename "$f")"
done
echo "wrote $NEW patch(es) to $PATCHES"
