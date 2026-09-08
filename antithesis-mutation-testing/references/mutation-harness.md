# Mutation Harness

## Goal

Get a mutated build of the SUT into Antithesis without leaving anything mutated
behind. Mutants live as patches; a throwaway fork turns a patch into an image;
the user's tree is never the thing being mutated.

## Initialize

Copy this skill's `assets/mutation-testing/` into
`antithesis/scratchbook/mutation-testing/`, then `chmod +x` the scripts —
recreating the files instead of copying loses the executable bit. If the
directory already exists, merge rather than overwrite — the patches and
evidence there are what a resumed sweep reads.

```
antithesis/scratchbook/mutation-testing/
  patches/             one patch per mutant
  mutants/{id}.md      per-mutant evidence
  images.txt           image names the sweep retags
  interview.md         agreed paths, answers, and scope; resumed from
  status.md            sweep state; resumable
  history.md           append-only log of completed runs
  report.md            the final report
  AGENTS.md            what each file here is for
  fork.sh sync-patches.sh build-mutants.sh select-mutant.sh verify-mutant.sh clean.sh
```

There is no id-list file. The patch set *is* the list of mutants, so nothing can
drift out of lockstep with it.

### Paths

Every script takes its paths as arguments and derives nothing about the repo
from where it sits, so the harness can live anywhere — including outside the
source tree. Keep the scripts together: `build-mutants.sh` and
`verify-mutant.sh` look for `select-mutant.sh` beside themselves, then on `PATH`.
Resolve these four once and pass them to every call; the examples below use
them as shell variables:

```sh
SRC=/path/to/repo                                  # --source: root of the source tree
PATCHES=$SRC/antithesis/scratchbook/mutation-testing/patches   # --patches
IMAGES=$SRC/antithesis/scratchbook/mutation-testing/images.txt # --images
FORK=/path/to/scratch/mutation-fork                # --fork: outside $SRC
MT=$SRC/antithesis/scratchbook/mutation-testing    # where the scripts live
CONFIG=antithesis/config                           # --config: compose dir, relative to $FORK
```

The scripts are not on `PATH` — they sit in `$MT` alongside the patches — so
invoke them as `"$MT/fork.sh"`, `"$MT/select-mutant.sh"`, and so on. The
examples below drop the `$MT/` prefix for readability only.

`--config` is the compose directory *relative to the fork* (default
`antithesis/config`). Where a step needs it as a real path — `snouty validate`,
`antithesis-launch`'s `--config` — that is `"$FORK/$CONFIG"`.

## The fork

```sh
fork.sh --source "$SRC" --patches "$PATCHES" --fork "$FORK"
```

**Give each project its own `$FORK`.** The fork records which source tree owns
it and refuses to be reused by another, but a distinct path per project avoids
the collision entirely — two worktrees of one repo included.

`fork.sh` copies the source tree — uncommitted and untracked work included —
**excluding `.git`**, and runs a fresh `git init` in the copy, committing it as
the tag `mutation-base`. Every git command the harness runs afterwards is
therefore confined to the fork.

That exclusion is a safety property: where `.git` is a *file* (a `git worktree`,
or a submodule SUT) a copied pointer would still resolve to the real repository,
and the fork's commits, checkouts, and tags would execute against it.

The trade-off: the fork has no history, so a build that stamps a version with
`git describe` will not find it. Pass the version another way rather than
restoring `.git`.

`--exclude PATTERN` (repeatable) is **the** mechanism for keeping build output
out of the fork — `.gitignore` is not: the fork commits ignored files too, or a
mutant whose bug lands in one (`.env`, a generated source) would export a patch
without the bug. Pass `--exclude` for anything large or volatile, or it lands
in `base_tree` and churns it.

Each run re-creates the fork from scratch rather than updating one in place —
which is what makes `--exclude` worth setting on a large repo.

## Bringing the fork's stack up beside the user's own

`antithesis-setup` requires every service to set `container_name:`, and
container names are global rather than project-scoped. So while
`COMPOSE_PROJECT_NAME` keeps the fork's volumes, networks, and teardown away
from the user's stack, it cannot separate container names: `verify-mutant.sh`
and any `snouty validate` against the fork will collide with the user's own
stack if that stack is running. Bring theirs down first. This is a local
concern only — it says nothing about runs on the platform.

## When a script stops on an assumption

Each script opens with `INTENT` / `ASSUMES` / `GUARANTEES` and stops, naming
the assumption, when the repo differs from the conventional layout it expects.
That is intended, and the fix is usually to edit the script — the harness
`AGENTS.md` says how, and what must not change. Note any edit in `status.md`.

**Re-forking destroys un-exported work**, so always run `sync-patches.sh`
first. `fork.sh` refuses when a `mut/*` branch has no patch or differs from its
exported patch — treat that message as "run `sync-patches.sh`", never as "pass
`--force`", which discards the revision. A patch that no longer applies is
reported as `STALE:` on stderr while the exit status stays 0 — read the output.

### `base_tree`

`git rev-parse mutation-base^{tree}` in the fork is the fingerprint that decides
whether a recorded baseline still applies. It changes when the SUT, workload, or
assertions change, and does not change when only mutant patches change — which
is what makes the two-branch iteration rule in `sweep-and-verdicts.md`
mechanical rather than a judgment call.

For that to hold, **the fork excludes `--patches` and the scratchbook** — both
are written to throughout a sweep and neither is built. `fork.sh` does this
automatically from its paths; a scratchbook elsewhere than
`antithesis/scratchbook` needs an explicit `--exclude`, or note-writing moves
`base_tree` and costs a re-baseline.

## Authoring mutants

Write mutants in the fork as ordinary edits, then export them. Do not hand-write
unified diffs.

**Each mutant lives on its own branch off `mutation-base`** — mutants are
siblings, never a stack. That is what lets every patch apply independently to
`mutation-base`, so two mutants touching the same file don't collide at build
time.

1. `git checkout -f -B mut/<mutant-id> mutation-base && git clean -qfdx` in the fork
2. Make the change (see `mutant-design.md` for what the patch contains)
3. `git add -A -f && git commit -m "<mutant-id>"` — `-am` stages only *tracked* files and plain `add -A` skips gitignored ones; either exports a partial patch that still carries its announcement and passes verification
4. Repeat for each mutant, each on its own `mut/<id>` branch off `mutation-base`
5. `sync-patches.sh --fork "$FORK" --patches "$PATCHES"` exports each branch to `{id}.patch`

**Step 1 must discard the working tree, not just move the branch** — the fork
is rarely clean: every `select-mutant.sh` leaves a mutant applied as
uncommitted changes, and a plain `checkout -B` would sweep the previous
mutant's bug into this one's patch while verification still passes. `-f` plus
`clean -qfdx` (`-x` included — a file the previous mutant created under a
`.gitignore` rule survives plain `clean -fd`) resets everything; the fork
marker lives inside `.git`, out of reach of both.

The branch name supplies the mutant id and patch filename verbatim.

`sync-patches.sh` regenerates the whole directory from the fork's branches; a
deleted branch disappears from `patches/`, and shrinking the set needs
`--force`.

## Tags

Each mutant is built as its own image. Selection happens at build time — there
is no runtime gate, no selector environment variable, and no dead mutant code in
the baseline image.

`snouty` requires an explicit `image:` reference on every compose service, and
it pins each image **by digest** into the config it stages at launch, so two runs
launched minutes apart cannot collide on a mutable tag. Distinct tags still let
every image be built up front and make a run legible in the registry.

Write the image names the sweep should retag into the file passed as
`--images`, one per line. **Each entry must be the
whole `image:` reference minus its tag**, exactly as the compose file spells it —
`select-mutant.sh` anchors on `image: <entry>:<tag>` and dies if that does not
match:

```
ghcr.io/org/myapp-node
myapp-client
```

**Getting this list right is load-bearing.** List every service built from this
repo — including the workload or client image, if it is built from a tree the
mutant can affect (a shared module, generated protobuf clients). A service left
off keeps whichever mutant built last on every later launch — `select-mutant.sh`
catches an empty list, not an incomplete one.

Do not list public images (`docker.io/library/postgres:17.2`). Each listed
service's compose `image:` must carry an explicit tag. An interpolated
reference (`image: myapp:${TAG}`) must be resolved to a literal first — in the
user's real compose, since a re-fork regenerates the fork's copy. That is a
real-tree change (interview question 4) and it moves `base_tree`, so make it
before the baseline is established.

## Build

`build-mutants.sh` builds everything before anything launches, so a build
failure costs no run budget.

```sh
build-mutants.sh --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"
build-mutants.sh --fork "$FORK" --patches "$PATCHES" --images "$IMAGES" --only m04-duplicate-term-ge
```

A mutant whose patch no longer applies is reported and skipped rather than
aborting the whole set; the script exits non-zero if anything failed, and those
mutants must not be launched.

The baseline is built from the same `mutation-base` as every mutant, so the
control cannot be stale relative to what it is controlling for.

It does not push. `snouty` pushes the images the compose references when the run
is launched, so only the tag actually launched reaches the registry. Every image
must exist locally at launch time, which is why the whole set is built up front.

**snouty requires the `docker-compose` binary** (Docker Compose v2) and execs
it directly. `build-mutants.sh` and `verify-mutant.sh` prefer the same binary
so the images they build are the ones validate and launch find; they accept the
`docker compose` plugin as a warned fallback for their own local operations,
but a host without `docker-compose` cannot run snouty at all. `podman compose`
is not an option; podman as the *runtime*, reached through `DOCKER_HOST`, is
fine — the same front-end drives the sweep, the validate, and the launch.

**Builds are usually the larger half of a sweep's cost.** `antithesis-setup`
prescribes `context: ../..`, so the build context is the whole repo; if
`.dockerignore` does not exclude `.git` and large build directories, every
mutant busts the layer cache for every service. Time the baseline build, quote
`N × T` to the user as part of the budget (see `SKILL.md`, interview question
2), and run builds in the background or with generous timeouts.

## Select before building and before launching

The compose file names one tag at a time, and the fork holds one mutant's source
at a time. `select-mutant.sh` sets both:

```sh
select-mutant.sh m04-duplicate-term-ge --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"
select-mutant.sh baseline --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"
```

`build-mutants.sh` calls it before each build.

**Call it again immediately before each launch.** `antithesis-launch` rebuilds
before submitting, so the fork at launch time must be the tree the mutant was
verified in — otherwise the rebuild quietly replaces the verified image. Even
then the rebuild is only *normally* a cache hit; the announcement check at the
top of the verdict ladder is what closes that gap, so treat it as mandatory.

## Verify before launching

**Every mutant image is verified locally before it is launched.** This is the
one check standing between a silently-unpatched build and a survivor that gets
misread as a catalog gap — the most expensive mistake available here.

```sh
verify-mutant.sh m04-duplicate-term-ge --fork "$FORK" --patches "$PATCHES" \
  --images "$IMAGES" --timeout 180
```

It exits non-zero when the announcement is absent: rebuild and re-verify rather
than launching.

**Pass `--timeout` derived from the baseline's observed setup time** — the
60-second default is exceeded by migrations or multi-node clusters for reasons
that have nothing to do with any mutant. If validate also times out on the
baseline, it is a harness fact.

This is one verify cycle per mutant, not one for the whole set. The baseline
needs no announcement — it is unpatched by construction.

## Teardown

```sh
clean.sh --source "$SRC" --fork "$FORK" --patches "$PATCHES"
```

Removes the fork — refusing a path that is not absolute, is inside the source
tree, or lacks the marker file `fork.sh` writes — and then verifies the source
tree carries no mutant announcement, treating a failed search as a failed check
rather than a pass. Run it even when the sweep failed — but not when the sweep
will be resumed: the fork holds unexported work and the `base_tree` a resume
diffs against, so run `sync-patches.sh` first if you must clean (`SKILL.md`).
`--patches` is skipped by that search: the patches contain the marker string by
construction.

The harness directory is working state, not a deliverable. What the sweep
establishes goes into the `## Falsification` sections of the property evidence
files and into `report.md`; leave the rest wherever the user wants it. Mention
that the `mut-*` tags accumulate in their registry and can be pruned.

## Limitations

- **Kubernetes harnesses** are not supported. Tag selection is wired through `docker-compose.yaml`.
- **Services not built from source in this repo** cannot carry a mutant. Their properties are scoped out as *not mutatable*, never withdrawn.
- **Builds that read git metadata** (`git describe` version stamping) will not find it in the fork, which has no history.
- **Compose must be the build path.** `build-mutants.sh` runs `compose build`; a service built by Bazel, jib, ko, or buildpacks outside compose will not be rebuilt, and the tag rewrite would point at an image that was never produced.
