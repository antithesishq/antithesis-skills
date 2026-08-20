# Resume

## Goal

Pick up a stopped sweep — budget exhausted, checkpoint declined, session died —
from the recorded state rather than by re-deriving it. `interview.md` is what
the user authorized; `status.md` is what has been spent and where every mutant
stands. **If `interview.md` is absent this is a first sweep**: run the opening
interview in `SKILL.md` instead.

The path variables below (`$SRC`, `$PATCHES`, `$FORK`, `$MT`) are the ones
`interview.md` records — see `mutation-harness.md`, "Paths".

## The steps, in order

1. Read `interview.md` for the paths, limits, permissions, and scope; `status.md` for the baseline record, run ids, per-mutant state, verdicts, attempts, and runs spent
2. **Re-run the assertion scan and re-check `images.txt`.** Neither is carried over: the scan supplies every property's class and must run on every sweep, so assertions added since the last session are otherwise silently out of scope while the report claims to cover every in-scope property. A service added to the compose since then and missing from `images.txt` is worse — it keeps whichever mutant built last, and the resulting verdicts are credited to the wrong mutant
3. **Reconcile against the platform before trusting `status.md`.** For a run whose id `status.md` already has, `snouty runs --json show "$RUN_ID"` is authoritative and does not depend on paging. Only for mutants with *no* recorded id do you search: `snouty runs list --json -n 500` filtered on the `mutation-testing:` source, and confirm the match with `--test-name`, which carries the repo name — `--source mutation-testing:baseline` is byte-identical for every project mutation-tested on this tenant, and adopting another project's baseline poisons everything downstream. A run launched just before the session died was never recorded, and relaunching it spends the budget twice. Where a mutant has been swept in more than one round, take the most recent by creation time; earlier rounds were measured against a superseded oracle. Poll anything still in flight rather than relaunching it. **Classify each landed run through the ladder in `sweep-and-verdicts.md`** — the announcement check, then marker-and-target, then same-history attribution. A verdict is not a field on the run, and a run reconciled here is exactly the kind most likely to get recorded as *falsified* off two run-wide counts
4. **Export anything the old fork holds that the patch set does not.** If it still exists and carries `mut/*` branches, run `sync-patches.sh --fork "$FORK" --patches "$PATCHES"` — a branch revised in the last session and never exported is lost the moment that fork is discarded. It exits non-zero in several cases, and only two are benign: the fork is gone, or it holds no `mut/*` branches (nothing to export, carry on). The one to read carefully is **it would shrink the patch set**, which means the fork has fewer mutants than `patches/` — usually a patch that went `STALE` and lost its branch. That one is not "nothing to export": read what it names before deciding, and do not reach for `--force` to clear it

5. **Settle whether the recorded baseline still applies.** Re-materialize the fork — a surviving fork is a snapshot of the tree as it was, so its `base_tree` cannot have changed and comparing it would always agree. Fork to a **second path**, keeping the old one, so the two can be compared:

   ```sh
   "$MT/fork.sh" --source "$SRC" --patches "$PATCHES" --fork "$FORK.resume"
   git -C "$FORK.resume" rev-parse 'mutation-base^{tree}'
   ```

   **Same as `status.md`:** the recorded baseline and verdicts stand.

   **Different:** find out *what* changed before spending anything, because `base_tree` covers gitignored and untracked files too — it is a fingerprint of the whole working directory, not of the SUT, and a build artifact, a coverage file, or a stray log left between sessions moves it without a line of source changing:

   ```sh
   # with blob hashes, not --name-only: an edit to a tracked file changes the
   # content, not the path list
   git -C "$FORK"        ls-tree -r mutation-base > /tmp/mt-old
   git -C "$FORK.resume" ls-tree -r mutation-base > /tmp/mt-new
   diff /tmp/mt-old /tmp/mt-new
   ```

   If every differing path is build output or scratch, add it to `--exclude`, record that in `interview.md`, re-fork, and the baseline stands. If any of it is source, workload, or assertions, the baseline and every verdict are stale: re-baseline and re-sweep under the two-branch rule (`sweep-and-verdicts.md`). Where the old fork is gone there is nothing to diff — say so, and treat the difference as real. Then discard `$FORK.resume` or adopt it as the fork for this session, and keep only one

6. **Establish a baseline if there is no valid one.** `status.md` may record none — the first sweep died before it landed, or it landed red. The gate is unconditional: no mutant is designed or launched without a green baseline at the current code state. Run the baseline gate (`SKILL.md`) before anything else, exactly as a first sweep does
7. **Now restate the configuration and confirm it** — the paths, permissions, and scope; what has already been spent, *including the runs reconciliation just discovered*; and what the steps above imply this resume will cost, which is a full re-baseline and re-sweep if step 5 found real changes. One confirmation before anything launches, not a re-interview. A ceiling already reached needs a new one; a ceiling with room left carries over; if the user declines to raise a spent ceiling, write the report with everything outstanding and stop. Record any change back to `interview.md`, and update the spend tally in `status.md`
8. **Rebuild and re-verify every mutant still to be launched.** Tags are stable across forks and local images may have been pruned, so an absent or stale image would otherwise be launched silently
9. Then resume where the sweep stopped — **re-entering the first-sweep workflow in `SKILL.md` at step 6** if any mutant is still unlaunched or unmutated, **Iterate after a sweep** (`SKILL.md`) if every mutant has a verdict and survivors remain, and straight to the report if every mutant has a verdict and none survived. Run `clean.sh` when it finishes

**Do not redo what already has a verdict.** The first-sweep steps the re-entry lands in are written over the whole in-scope set — design a mutant per property, author them, build every mutant, launch the sweep. On a resume they apply only to mutants whose `status.md` state is not yet `landed` at the current `base_tree`. Re-authoring a mutant that already has a verdict also rewrites its patch, so the run id recorded against it stops describing the patch on disk.
