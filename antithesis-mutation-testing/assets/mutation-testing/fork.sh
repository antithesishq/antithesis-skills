#!/usr/bin/env bash
# Materialize an ephemeral copy of the source tree for mutation testing.
#
# The copy excludes .git and gets a fresh `git init`, so every git command the
# harness runs is confined to the fork. Nothing here can reach the user's real
# repository, whatever shape it is in (worktree, submodule, or not git at all).
set -euo pipefail

# `git -C DIR` only changes directory: GIT_DIR, GIT_WORK_TREE and friends take
# precedence over repository discovery, so inheriting them points every git
# command below at whatever repo the caller was in. Hooks export
# GIT_INDEX_FILE and `git submodule foreach` exports GIT_DIR, so this is
# reachable from an ordinary invocation, and it defeats the entire fork model.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY \
      GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE \
      GIT_CEILING_DIRECTORIES GIT_PREFIX

MARKER=".antithesis-mutation-fork"

SOURCE=""
PATCHES=""
DEST=""
APPLY=1
FORCE=0
EXCLUDES=()

usage() {
  cat <<'USAGE'
Usage: fork.sh --source DIR --patches DIR --fork DIR
               [--exclude PATTERN]... [--no-apply] [--force]

  --source    Root of the source tree to copy.
  --patches   Directory of <mutant-id>.patch files. Need not exist yet.
  --fork      Where the fork goes. Must be outside --source. An existing
              directory is reused only if a previous fork.sh created it.
  --exclude   Extra rsync exclude pattern, relative to --source; repeatable.
              For large build directories the image does not need, and for a
              scratchbook somewhere other than antithesis/scratchbook.
  --no-apply  Leave the fork at mutation-base without replaying existing patches.
  --force     Re-fork even though mut/* branches would be lost (see sync-patches.sh).

The patch directory and antithesis/scratchbook are excluded automatically when
they sit inside --source. Both are written to during a sweep and neither is
built, so copying them in would move base_tree and invalidate the baseline.

Each run re-creates the fork from scratch. Un-exported branches are destroyed by
that, which is what --force overrides. STALE patches are reported on stderr; the
exit status stays 0, so check the output rather than just the status.

Copies the source tree (excluding .git), runs `git init` in the copy, commits it
as the tag `mutation-base`, and replays <patches>/*.patch onto one `mut/<id>`
branch each. Leaves the fork checked out at mutation-base. Prints the fork path
and the base_tree fingerprint.
USAGE
}

die() { echo "fork.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="${2:?--source needs a value}"; shift 2 ;;
    --patches) PATCHES="${2:?--patches needs a value}"; shift 2 ;;
    --fork) DEST="${2:?--fork needs a value}"; shift 2 ;;
    --exclude) EXCLUDES+=(--exclude "${2:?--exclude needs a value}"); shift 2 ;;
    --no-apply) APPLY=0; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[ -n "$SOURCE" ] || { echo "fork.sh: --source is required" >&2; usage >&2; exit 2; }
[ -n "$PATCHES" ] || { echo "fork.sh: --patches is required" >&2; usage >&2; exit 2; }
[ -n "$DEST" ] || { echo "fork.sh: --fork is required" >&2; usage >&2; exit 2; }

command -v rsync >/dev/null || die "rsync is required"
command -v git >/dev/null || die "git is required"

# -P throughout: a symlinked path would otherwise compare as outside the source
# tree and let the fork materialize inside the user's working tree.
[ -d "$SOURCE" ] || die "--source is not a directory: $SOURCE"
SOURCE=$(cd -P "$SOURCE" && pwd -P)

# Absolutize without creating anything yet, so validation happens first.
abspath() {
  if [ -d "$1" ]; then
    (cd -P "$1" && pwd -P)
  else
    parent=$(dirname "$1")
    [ -d "$parent" ] || die "parent directory does not exist: $parent"
    echo "$(cd -P "$parent" && pwd -P)/$(basename "$1")"
  fi
}
PATCHES=$(abspath "$PATCHES")
DEST=$(abspath "$DEST")

[ "$DEST" = "/" ] && die "refusing to use / as the fork destination"
[ -e "$DEST" ] && [ ! -d "$DEST" ] && die "--fork exists and is not a directory: $DEST"
# The fork is wiped on every run, so anything kept inside it is destroyed. The
# patch set is the one thing that cannot be rebuilt from the fork.
case "$PATCHES" in
  "$DEST"|"$DEST"/*) die "--patches is inside --fork ($PATCHES); re-forking would delete the patch set" ;;
esac
[ -n "${HOME:-}" ] && [ "$DEST" = "$HOME" ] && die "refusing to use \$HOME as the fork destination"
case "$DEST" in
  "$SOURCE"|"$SOURCE"/*) die "fork destination must be outside the source tree ($DEST)" ;;
esac
if [ -d "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ] && [ ! -e "$DEST/$MARKER" ]; then
  die "destination is not empty and was not created by fork.sh: $DEST"
fi
# A fork path reused across projects silently wipes the first project's fork and
# then builds mutants from the wrong tree under the right tag.
if [ -f "$DEST/$MARKER" ] && [ -s "$DEST/$MARKER" ]; then
  owner=$(sed -n 's/^source=//p' "$DEST/$MARKER")
  if [ -n "$owner" ] && [ "$owner" != "$SOURCE" ]; then
    die "$DEST is the fork of another source tree ($owner); pass a different --fork"
  fi
fi

# Exclude what a sweep writes to but never builds, so base_tree stays a
# fingerprint of the SUT: adding a patch or appending a note mid-sweep must not
# invalidate the recorded baseline.
AUTO=()
PATCHES_REL=""
case "$PATCHES" in
  "$SOURCE"/*) PATCHES_REL="${PATCHES#"$SOURCE"/}"; AUTO+=(--exclude "/$PATCHES_REL") ;;
esac
SB_REL=""
if [ -d "$SOURCE/antithesis/scratchbook" ]; then
  SB_REL="antithesis/scratchbook"
  AUTO+=(--exclude "/$SB_REL")
fi

# Un-exported work is destroyed by the wipe below, so refuse to proceed while
# any mut/* branch has no patch to replay it from.
if [ -d "$DEST/.git" ] && [ "$FORCE" -eq 0 ]; then
  ORPHANS=""
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    [ -f "$PATCHES/${ref#mut/}.patch" ] || ORPHANS="$ORPHANS$ref
"
  done <<EOF
$(git -C "$DEST" for-each-ref --format='%(refname:short)' 'refs/heads/mut/*' 2>/dev/null)
EOF
  if [ -n "$ORPHANS" ]; then
    die "these fork branches have no patch and would be lost:
${ORPHANS}run sync-patches.sh first, or pass --force to discard them"
  fi
  # A branch whose content no longer matches its exported patch has been revised
  # since the last export. Replaying would silently restore the old revision --
  # the announcement still matches, so verify passes and nothing downstream can
  # tell that the run tested the mutant the evidence file says was replaced.
  REVISED=""
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    pf="$PATCHES/${ref#mut/}.patch"
    [ -f "$pf" ] || continue
    if ! git -C "$DEST" -c diff.external= -c diff.noprefix=false \
           diff --no-ext-diff --binary --src-prefix=a/ --dst-prefix=b/ \
           mutation-base "$ref" 2>/dev/null | diff -q - "$pf" >/dev/null 2>&1; then
      REVISED="$REVISED$ref
"
    fi
  done <<EOF
$(git -C "$DEST" for-each-ref --format='%(refname:short)' 'refs/heads/mut/*' 2>/dev/null)
EOF
  if [ -n "$REVISED" ]; then
    die "these fork branches differ from their exported patch and would be reverted:
${REVISED}run sync-patches.sh first, or pass --force to discard the revisions"
  fi
fi

# Step out of the fork before removing it: the caller's shell may well be
# sitting inside it after authoring mutants, and rsync dies on a missing cwd.
cd "$SOURCE"

# Copy into an empty destination rather than updating one in place. rsync's
# size+mtime quick check misses an edit made in the same second as the previous
# fork at the same size -- a flipped comparator, say -- and a surviving .git
# would keep mut/* branches for mutants whose patches are gone.
rm -rf "${DEST:?}"
mkdir -p "$DEST"
printf 'source=%s\n' "$SOURCE" > "$DEST/$MARKER"

rsync -a --delete \
  --exclude ".git" \
  --exclude "$MARKER" \
  ${AUTO[@]+"${AUTO[@]}"} \
  ${EXCLUDES[@]+"${EXCLUDES[@]}"} \
  "$SOURCE"/ "$DEST"/

# Belt and braces: the exclusions above are patterns, these are paths.
[ -n "$PATCHES_REL" ] && rm -rf "${DEST:?}/$PATCHES_REL"
[ -n "$SB_REL" ] && rm -rf "${DEST:?}/$SB_REL"

# `add -A -f` tracks gitignored files too. Without it a mutant that edits an
# ignored file (.env, a generated source) exports a patch that omits the bug --
# the image ships unmutated and still passes verification -- and `git clean -fd`
# in select-mutant.sh cannot restore it, so the edit leaks into the baseline.
# Use --exclude for large build directories; that is the mechanism for keeping
# them out, not .gitignore.
# Neutralize global git config that would otherwise fail or rewrite the commit.
git -C "$DEST" init -q --template=''
# Keep the marker out of the commit: it records --source, so committing it would
# make base_tree depend on where the source tree is mounted and invalidate a
# sound baseline on any move. info/exclude rather than merely untracked, because
# select-mutant.sh runs `git clean -qfd` and would otherwise delete it.
mkdir -p "$DEST/.git/info"   # --template='' leaves no info/ directory
printf '/%s\n' "$MARKER" >> "$DEST/.git/info/exclude"
git -C "$DEST" config user.email "mutation-testing@antithesis.invalid"
git -C "$DEST" config user.name "Antithesis Mutation Testing"
git -C "$DEST" config commit.gpgsign false
git -C "$DEST" add -A -f
git -C "$DEST" -c core.hooksPath=/dev/null commit -q --no-verify --allow-empty -m "mutation-base"
git -C "$DEST" tag -f mutation-base >/dev/null

REPLAYED=0
STALE=""
if [ "$APPLY" -eq 1 ] && ls "$PATCHES"/*.patch >/dev/null 2>&1; then
  for p in "$PATCHES"/*.patch; do
    id=$(basename "$p" .patch)
    git -C "$DEST" checkout -q -B "mut/$id" mutation-base
    # apply.whitespace=error would reject a sound patch as STALE; =fix would
    # silently strip the mutant's own whitespace out of the built image.
    if git -C "$DEST" -c apply.whitespace=nowarn apply "$p" 2>/dev/null ||
       git -C "$DEST" -c apply.whitespace=nowarn apply -3 "$p" 2>/dev/null; then
      git -C "$DEST" add -A -f
      git -C "$DEST" -c core.hooksPath=/dev/null commit -q --no-verify -m "$id"
      REPLAYED=$((REPLAYED + 1))
    else
      git -C "$DEST" checkout -q -f mutation-base
      git -C "$DEST" branch -q -D "mut/$id"
      STALE="$STALE$id
"
    fi
  done
  git -C "$DEST" checkout -q -f mutation-base
fi

echo "fork: $DEST"
echo "base_tree: $(git -C "$DEST" rev-parse mutation-base^{tree})"
[ "$REPLAYED" -gt 0 ] && echo "replayed $REPLAYED patch(es) onto mut/* branches"
if [ -n "$STALE" ]; then
  echo "STALE: these patches no longer apply and need re-authoring:" >&2
  printf '%s' "$STALE" >&2
fi
exit 0
