This directory holds everything for validating the property catalog with mutation testing.

Use the `antithesis-mutation-testing` skill to work in here. Use the `antithesis-launch` skill to submit runs — do not run `snouty launch` directly.

**Paths**
Every script takes its paths as arguments and derives nothing from where it sits, so this directory can be moved or renamed as long as the scripts stay together. Resolve four values once and pass them to every call: `--source` (root of the source tree), `--patches` (the `patches/` directory below), `--images` (`images.txt` below), and `--fork` (a scratch directory outside the source tree). `--config` is the compose directory relative to the fork, defaulting to `antithesis/config`.

**patches**
One patch per mutant, named `mNN-<slug>.patch`. The patch set is the list of wired mutants — there is no separate id list to drift out of sync. Each patch is a diff against `mutation-base`, so every patch applies independently of the others. Each carries a startup announcement, a marker at the point of divergence, and the buggy change itself. Mutations exist only here — never in the working tree.

**mutants**
Per-mutant evidence, one file per mutant id: the target property, the mistake, why it is subtle, the kill chain, the predicted verdict, and what the run actually showed.

**images.txt**
The image names the sweep retags, one per line without a tag. List every service built from this repo, including the workload image if it shares code with the SUT; omitting one means it keeps its previous mutant's build. Never list public images. Each entry must match the whole `image:` reference minus its tag — `ghcr.io/org/app`, not `app` — and that reference must carry an explicit tag.

**interview.md**
What the user agreed to: the four paths, the five interview answers, and the property scope. Written before any run is spent and updated whenever an answer changes. A later session reads this plus `status.md` to resume without re-asking, and it is the only record of what the user authorized.

**status.md**
Sweep state — the baseline record, the catalog-slug-to-assertion-name mapping, run ids, and verdicts, each stamped with the `base_tree` it was obtained at. Written continuously so an interrupted sweep can be resumed by polling rather than relaunching.

**report.md**
The outcome for every in-scope property, with the run that proves it. What the sweep establishes about each property also goes into that property's `## Falsification` section in the scratchbook.

**fork.sh** `--source DIR --patches DIR --fork DIR [--exclude PATTERN]... [--no-apply] [--force]`
Copies the source tree — excluding `.git`, the patch directory, and the scratchbook — into a throwaway directory, committing gitignored files too so a mutant can touch them and the baseline stays clean (use `--exclude` for large build directories), runs a fresh `git init` there, tags the base commit `mutation-base`, and replays each patch onto its own `mut/<id>` branch. Every git command the harness runs is confined to that copy, so nothing here can reach your real repository. Give each project its own `--fork` path. Each run re-creates the fork from scratch, which destroys whatever is in the old one. It refuses to start when a `mut/*` branch has no patch at all (override with `--force`), but it cannot tell that a branch has newer commits than its exported patch — so **always run `sync-patches.sh` before re-forking**, or that revision is silently replaced by the stale patch.

**sync-patches.sh** `--fork DIR --patches DIR [--force]`
Regenerates the patch directory from the fork's `mut/*` branches. Author each mutant on its own branch off `mutation-base`, then run this.

**select-mutant.sh** `<mutant-id|baseline> --fork DIR --patches DIR --images FILE [--config REL]`
Puts the fork into one mutant's state: resets to `mutation-base`, applies that patch, and points the compose images at that mutant's tag. Run it before building a mutant and again immediately before launching it. Because it mutates the one shared fork in place, select-and-launch is a critical section: never overlap it with another mutant's.

**verify-mutant.sh** `<mutant-id> --fork DIR --patches DIR --images FILE [--config REL] [--timeout SECS]`
Proves a built image actually carries its patch, before a run is spent on it. Brings the compose up with `snouty validate --keep-running`, greps the container logs for that mutant's announcement, and tears it down. Pass `--timeout` derived from the baseline's setup time; the default is 60s. A mutant that fails this must not be launched.

**build-mutants.sh** `--fork DIR --patches DIR --images FILE [--config REL] [--only ID,...] [--no-baseline]`
Builds the baseline and one image set per mutant, tagging each `baseline` or `mut-<id>`. Does not push — snouty pushes the images the compose references when the run is launched. Compose runs through the `docker-compose` binary — the one snouty itself execs, so the images this builds are the ones the validate and launch find, and the launch's pre-submit rebuild is a cache hit rather than a second full build. The `docker compose` plugin is a fallback for local operations only; snouty needs `docker-compose`. `podman compose` is not supported; podman as the runtime, via `DOCKER_HOST`, is fine.

**clean.sh** `--source DIR --fork DIR --patches DIR`
Removes the fork and searches your source tree for a mutant announcement, so a patch applied there by mistake is caught. Run it even when a sweep fails.
