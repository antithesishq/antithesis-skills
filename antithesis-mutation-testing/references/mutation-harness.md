# Mutation Harness

## Goal

Get a mutated build of the SUT into Antithesis without leaving anything mutated
behind. Mutants live as patches; a throwaway fork turns a patch into an image;
the user's tree is never the thing being mutated.

## Initialize

Copy this skill's `assets/mutation-testing/` into
`antithesis/scratchbook/mutation-testing/`, then `chmod +x` the scripts. Every
later step executes them directly, so an agent that recreates the files instead
of copying them loses the executable bit and the whole harness fails at the
first call. If the directory already exists, merge rather than overwrite — the
patches and evidence there are what a resumed sweep reads.

```
antithesis/scratchbook/mutation-testing/
  patches/             one patch per mutant
  mutants/{id}.md      per-mutant evidence
  images.txt           image names the sweep retags
  interview.md         agreed paths, answers, and scope; resumed from
  status.md            sweep state; resumable
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
CONFIG=antithesis/config                           # --config: compose dir, relative to $FORK
```

`--config` is the compose directory *relative to the fork*, so it is the one
value here that is not an absolute path. It defaults to `antithesis/config`;
pass it only when the SUT puts the compose file elsewhere. Where a step needs
the compose directory as a real path — `snouty validate`, and the `--config`
`antithesis-launch` takes — that path is `"$FORK/$CONFIG"`.

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
`git describe` or reads git metadata will not find it. If the build hard-fails
on that, pass the version in another way rather than restoring `.git`.

`--exclude PATTERN` (repeatable) skips large directories the image does not
need, and it is **the** mechanism for keeping build output out of the fork.
`.gitignore` is not: the fork commits ignored files too. It has to, or a mutant
whose bug lands in an ignored file (`.env`, a generated source) would export a
patch without the bug — shipping an unmutated image that still passes
verification — and the edit would survive into the baseline, since a checkout
cannot restore a file git is not tracking. Pass `--exclude` for anything large
or volatile, or it lands in `base_tree` and churns it.

`fork.sh` refuses a destination inside the source tree, and refuses an existing
non-empty directory it did not create.

Each run re-creates the fork from scratch rather than updating one in place —
which is what makes `--exclude` worth setting on a large repo.

The cost is that **un-exported work in the fork is destroyed**. Always run
`sync-patches.sh` before re-forking. `fork.sh` refuses to start when a `mut/*`
branch has no patch at all, and equally when a branch's commits differ from its
exported patch — it names the branches and exits non-zero rather than reverting
them. `--force` overrides both, and on the second it **discards the revision**,
so treat that message as "run `sync-patches.sh`", never as "pass `--force`".
Note also
that a patch which no longer applies is reported as `STALE:` on stderr while the
exit status stays 0 — read the output, do not just check the status.

### `base_tree`

`git rev-parse mutation-base^{tree}` in the fork is the fingerprint that decides
whether a recorded baseline still applies. It changes when the SUT, workload, or
assertions change, and does not change when only mutant patches change — which
is what makes the two-branch iteration rule in `sweep-and-verdicts.md`
mechanical rather than a judgment call.

For that to hold, **the fork excludes `--patches` and the scratchbook** whenever
they sit inside `--source`. Neither is ever built and both are written to
throughout a sweep, so a fork containing them would move `base_tree` every time
a mutant is added or a `## Falsification` note is appended. `fork.sh` does this
automatically from the paths it is given; a scratchbook somewhere other than
`antithesis/scratchbook` needs an explicit `--exclude`, or note-writing will
move `base_tree` and cost a re-baseline.

## Authoring mutants

Write mutants in the fork as ordinary edits, then export them. Do not hand-write
unified diffs.

**Each mutant lives on its own branch off `mutation-base`** — mutants are
siblings, never a stack. That is what lets every patch apply independently to
`mutation-base`, so two mutants touching the same file don't collide at build
time.

1. `git checkout -f -B mut/<mutant-id> mutation-base && git clean -qfd` in the fork
2. Make the change (see `mutant-design.md` for what the patch contains)
3. `git add -A && git commit -m "<mutant-id>"` — `-am` stages only *tracked* files, so a mutant that adds a file (a helper, a marker shim) would be exported as a partial patch that still carries its announcement and therefore still passes verification
4. Repeat for each mutant, each on its own `mut/<id>` branch off `mutation-base`
5. `sync-patches.sh --fork "$FORK" --patches "$PATCHES"` exports each branch to `{id}.patch`

**Step 1 must discard the working tree, not just move the branch.** A plain
`git checkout -B` keeps local modifications, and the fork is rarely clean: every
`select-mutant.sh` leaves the selected mutant applied as uncommitted changes
plus a rewritten `image:` tag. `git add -A` then sweeps the previous mutant's
bug into this one's patch, `verify-mutant.sh` still passes because it only greps
for the new mutant's own announcement, and the run's verdict gets credited to
the wrong property. `-f` handles tracked files and `git clean -qfd` the
untracked ones a patch may have added.

The branch name supplies the mutant id and the patch filename, so the id
survives verbatim — it is not derived from the commit subject and cannot be
truncated or sanitized into something that no longer matches
`mutants/{id}.md`.

`sync-patches.sh` regenerates the whole directory from the fork's branches, so a
mutant whose branch is deleted disappears from `patches/`. It refuses to run
when there are no `mut/*` branches, and refuses to *shrink* the patch set unless
you pass `--force`.

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
off is rebuilt under its existing tag on every mutant build, so whichever mutant
built last is what every later launch runs. `select-mutant.sh` fails hard when
that file retags nothing, which catches the empty-file case; it cannot catch
a list that is merely incomplete.

Do not list public images (`docker.io/library/postgres:17.2`). Each listed
service's compose `image:` must carry an explicit tag — `select-mutant.sh`
rewrites the tag portion and fails loudly if there is none to rewrite. An
interpolated reference (`image: myapp:${TAG}`) must be resolved to a literal
first.

## Build

`build-mutants.sh` builds everything before anything launches, so a build
failure costs no run budget.

```sh
build-mutants.sh --fork "$FORK" --patches "$PATCHES" --images "$IMAGES"
build-mutants.sh --fork "$FORK" --patches "$PATCHES" --images "$IMAGES" --only m04-duplicate-term-ge
```

Per target it resets the fork to `mutation-base`, applies that mutant's patch
(none for the baseline), rewrites the `--images` tags to `mut-{id}` (or
`baseline`), and runs `compose build`. A mutant whose patch no longer applies is
reported and skipped rather than aborting the whole set; the script exits
non-zero if anything failed, and those mutants must not be launched.

The baseline is built from the same `mutation-base` as every mutant, so the
control cannot be stale relative to what it is controlling for.

It does not push. `snouty` pushes the images the compose references when the run
is launched, so only the tag actually launched reaches the registry. Every image
must exist locally at launch time, which is why the whole set is built up front.

**snouty requires the `docker-compose` binary** (Docker Compose v2) and execs
it directly — `docker-compose config`, `up --detach`, `ps` — refusing to start
without it. `build-mutants.sh` and `verify-mutant.sh` therefore prefer the same
binary, so the images this builds are the images the validate and launch find.
Both Compose v2 front-ends talk to the same daemon and the same image store, so
the launch skill's pre-submit rebuild is normally a cache hit either way; using
the binary snouty itself execs is what removes the doubt. They accept the `docker compose` plugin as a fallback for their own
local operations and warn when they use it, but a host without `docker-compose`
cannot run snouty at all. `podman compose` is not an option.

podman can still be the *runtime* underneath, reached through `DOCKER_HOST`.
Nothing here needs to know which runtime is in use: the same compose front-end
drives the sweep, the local validate, and the launch, so all three land in
whichever image store that front-end is pointed at.

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

It resets the fork to `mutation-base`, applies that mutant's patch, and rewrites
the tags. `build-mutants.sh` calls it before each build.

**Call it again immediately before each launch.** `antithesis-launch` runs
`docker compose build` before submitting, so the fork's working tree at launch
time must be the tree the mutant was verified in — otherwise that rebuild
quietly replaces the verified image with whatever the fork happens to contain.
With the fork in the right state, the launch skill's rebuild is normally a cache
hit — but "normally" is not "by construction". A Dockerfile that fetches at build
time, a pruned cache, or a different compose front-end each produce a different
image from the one `verify-mutant.sh` approved. That is what the announcement
check at the top of the verdict ladder is for; treat it as mandatory.

## Verify before launching

**Every mutant image is verified locally before it is launched.** This is the
one check standing between a silently-unpatched build and a survivor that gets
misread as a catalog gap — the most expensive mistake available here, and the
only one that wastes a run without producing any information.

```sh
verify-mutant.sh m04-duplicate-term-ge --fork "$FORK" --patches "$PATCHES" \
  --images "$IMAGES" --timeout 180
```

`verify-mutant.sh` selects the mutant, runs `snouty validate --keep-running`,
greps the container logs for `ANTITHESIS MUTANT ACTIVE: {id}`, and tears the
containers down. It exits non-zero when the announcement is absent — that build
does not carry the patch, so rebuild and re-verify rather than launching it.

`--keep-running` is what leaves the containers up to read the announcement from;
without it `snouty validate` tears them down and the check has no command behind
it.

**Pass `--timeout` derived from the baseline's observed setup time.** `snouty
validate` defaults to 60 seconds; a SUT with database migrations or a multi-node
cluster exceeds that for reasons that have nothing to do with any mutant, and a
timeout misread as "the mutant broke the system" gets a batch of sound mutants
rewritten. If validate also times out on the baseline, it is a harness fact.

This is one verify cycle per mutant, not one for the whole set.

The baseline needs no announcement — it is unpatched by construction, and it is
rebuilt from `mutation-base` in the same pass, so it cannot be stale.

## Teardown

```sh
clean.sh --source "$SRC" --fork "$FORK" --patches "$PATCHES"
```

Removes the fork — refusing a path that is not absolute, is inside the source
tree, or lacks the marker file `fork.sh` writes — and then verifies the source
tree carries no mutant announcement, treating a failed search as a failed check
rather than a pass. Run it even when the sweep failed. `--patches` is skipped by that search:
the patches contain the marker string by construction.

The harness directory is working state, not a deliverable. What the sweep
establishes goes into the `## Falsification` sections of the property evidence
files and into `report.md`; leave the rest wherever the user wants it. Mention
that the `mut-*` tags accumulate in their registry and can be pruned.

## Limitations

- **Kubernetes harnesses** are not supported. Tag selection is wired through `docker-compose.yaml`.
- **Services not built from source in this repo** cannot carry a mutant. Their properties are scoped out as *not mutatable*, never withdrawn.
- **Builds that read git metadata** (`git describe` version stamping) will not find it in the fork, which has no history.
- **Compose must be the build path.** `build-mutants.sh` runs `compose build`; a service built by Bazel, jib, ko, or buildpacks outside compose will not be rebuilt, and the tag rewrite would point at an image that was never produced.
