#!/usr/bin/env bash
# Remove the fork and confirm the user's source tree carries no mutation.
#
# INTENT
#   End a sweep with no fork on disk and positive evidence that no mutation was
#   left behind in --source.
#
# ASSUMES
#   - --fork, if it exists, was created by fork.sh (it carries the marker).
#   - Mutations are identifiable by the string `ANTITHESIS MUTANT ACTIVE`.
#
# GUARANTEES
#   - Refuses to remove anything fork.sh did not create.
#   - Searches tracked, untracked, gitignored, and submodule files.
#   - Exits non-zero if a marker is found, or if the search could not run.
set -euo pipefail

# `git -C DIR` only changes directory: GIT_DIR, GIT_WORK_TREE and friends take
# precedence over repository discovery, so inheriting them points every git
# command below at whatever repo the caller was in. Hooks export
# GIT_INDEX_FILE and `git submodule foreach` exports GIT_DIR, so this is
# reachable from an ordinary invocation, and it defeats the entire fork model.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
      GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_PREFIX

MARKER=".git/antithesis-mutation-fork"

SOURCE=""
WORK=""
PATCHES=""

usage() {
  cat <<'USAGE'
Usage: clean.sh --source DIR --fork DIR --patches DIR

  --source    Root of the source tree to check for stray mutations.
  --fork      The fork to remove. A path fork.sh did not create is refused.
  --patches   Directory of <mutant-id>.patch files, skipped by the check:
              the patches contain the marker string by construction.

Run this even when a sweep fails.
USAGE
}

die() { echo "clean.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="${2:?--source needs a value}"; shift 2 ;;
    --fork) WORK="${2:?--fork needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$SOURCE" ] || { echo "clean.sh: --source is required" >&2; usage >&2; exit 2; }
[ -n "$WORK" ] || { echo "clean.sh: --fork is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "clean.sh: --patches is required" >&2; usage >&2; exit 2; }

[ -d "$SOURCE" ] || die "--source is not a directory: $SOURCE"
SOURCE=$(cd -P "$SOURCE" && pwd -P)

case "$WORK" in
  /*) ;;
  *) die "--fork must be an absolute path, refusing to remove: $WORK" ;;
esac
# Resolve before the guards below: rm -rf on a symlink removes the link and
# leaves the fork on disk while reporting success, and an unresolved path makes
# the inside-the-source-tree check a string comparison against a resolved
# $SOURCE.
if [ -d "$WORK" ]; then
  WORK=$(cd -P "$WORK" && pwd -P)
fi
[ "$WORK" = "/" ] && die "--fork is /, refusing to remove"
case "$WORK" in
  "$SOURCE"|"$SOURCE"/*) die "--fork is inside the source tree, refusing to remove: $WORK" ;;
esac
if [ -d "$WORK" ]; then
  [ -e "$WORK/$MARKER" ] || die "$WORK is missing the $MARKER file; refusing to remove a directory fork.sh did not create"
  rm -rf "$WORK"
  echo "removed fork at $WORK"
else
  echo "no fork at $WORK; nothing to remove"
fi

# Skip what legitimately contains the marker string: the patches themselves, and
# the scratchbook, where per-mutant evidence quotes the announcement.
if PP=$(cd -P "$(dirname "$PATCHES")" 2>/dev/null && pwd -P); then
  PATCHES_ABS="$PP/$(basename "$PATCHES")"
else
  PATCHES_ABS=""
fi
SKIP=()
SKIP_DIRS=()
case "$PATCHES_ABS" in
  "$SOURCE"/*)
    rel="${PATCHES_ABS#"$SOURCE"/}"
    SKIP+=(":(exclude)$rel/*")
    SKIP_DIRS+=(--exclude-dir="$(basename "$rel")") ;;
esac
if [ -d "$SOURCE/antithesis/scratchbook" ]; then
  SKIP+=(":(exclude)antithesis/scratchbook/*")
  SKIP_DIRS+=(--exclude-dir=scratchbook)
fi
# These scripts contain the marker string themselves. Skip wherever they live,
# or a harness kept outside the scratchbook reports itself as a stray mutation.
HARNESS_DIR=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
case "$HARNESS_DIR" in
  "$SOURCE"/*)
    hrel="${HARNESS_DIR#"$SOURCE"/}"
    SKIP+=(":(exclude)$hrel/*")
    SKIP_DIRS+=(--exclude-dir="$(basename "$hrel")") ;;
esac

# The fork is a separate copy, so the real tree should never have been touched.
# Verify rather than assume, and treat a failed search as a failed check.
# Prefer git grep: it searches tracked files only, so it skips node_modules,
# target/, and root-owned bind-mount data directories -- which are minutes of
# I/O on a monorepo and make a plain grep exit 2 on the first unreadable file.
set +e
if git -C "$SOURCE" rev-parse --git-dir >/dev/null 2>&1; then
  # --no-exclude-standard so ignored files are searched too: a mutation landing
  # in .env, a generated source, or a bind-mounted config is still a mutation in
  # the user's tree.
  hits=$(git -C "$SOURCE" grep -l --untracked --no-exclude-standard -F "ANTITHESIS MUTANT ACTIVE" \
    -- ${SKIP[@]+"${SKIP[@]}"} 2>/dev/null)
  status=$?
  # git grep refuses --untracked with --recurse-submodules, and a submodule is
  # a separate repo the parent's search never enters -- so a mutation there
  # would report as "carries no mutation". Search each one on its own.
  while IFS= read -r sub; do
    [ -n "$sub" ] && [ -d "$SOURCE/$sub" ] || continue
    subhits=$(git -C "$SOURCE/$sub" grep -l --untracked --no-exclude-standard \
      -F "ANTITHESIS MUTANT ACTIVE" 2>/dev/null)
    substatus=$?
    [ "$substatus" -gt 1 ] && status=$substatus
    [ -n "$subhits" ] && hits=$(printf '%s\n%s' "$hits" "$(printf '%s\n' "$subhits" | sed "s#^#$sub/#")")
  done <<EOF
$(git -C "$SOURCE" config -f "$SOURCE/.gitmodules" --get-regexp '^submodule\..*\.path$' 2>/dev/null | awk '{print $2}')
EOF
else
  hits=$(grep -rls "ANTITHESIS MUTANT ACTIVE" "$SOURCE" \
    --exclude-dir=.git ${SKIP_DIRS[@]+"${SKIP_DIRS[@]}"} 2>/dev/null)
  status=$?
fi
set -e
if [ "$status" -gt 1 ]; then
  die "could not verify the source tree (search exited $status); check it by hand"
fi
if [ -n "$hits" ]; then
  echo "WARNING: mutation markers are present in $SOURCE:" >&2
  echo "$hits" >&2
  exit 1
fi

echo "source tree carries no mutation"
