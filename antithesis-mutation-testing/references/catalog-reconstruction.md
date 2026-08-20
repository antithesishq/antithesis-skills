# Catalog Reconstruction

## Goal

Produce a property catalog good enough to mutate against when the scratchbook is
missing or has fallen behind the code. The output is a real
`antithesis/scratchbook/property-catalog.md` in `antithesis-research`'s format,
plus an evidence file per property, derived from what the code asserts and what a
baseline run confirms Antithesis cataloged.

## When to reconstruct

- No scratchbook at all — the notes were deleted after the harness was built, or the harness was inherited from someone else
- A catalog exists but the code has assertions it never mentions

Reconstruction never overwrites. Existing catalog entries and evidence files are
inputs; extend them, as `antithesis-research`'s `references/scratchbook-setup.md`
requires. Reconstruct only the missing entries.

## What reconstruction cannot recover

A catalog rebuilt from assertions describes what the code already checks — and so
does a sweep against it. It answers *does each assertion catch a bug that breaks
its own condition?* It cannot answer *is anything important unasserted?*, because
there is nothing to mutate for a property nobody wrote.

That limit belongs in the report, and it is the reason to route the user to
`antithesis-research` for a real discovery pass afterwards. It does not block this
skill: validating the assertions that exist is worth doing on its own.

## Two sources, neither sufficient alone

| Source | Authoritative for | Blind to |
| --- | --- | --- |
| A scan of SDK assertion callsites | The assertion class, its callsite, and what its condition compares | Whether the assertion was ever cataloged or ever ran |
| The baseline run's property list | Which properties exist to Antithesis, and which the workload exercised | The assertion class, and where the code is |

### 1. Scan the source

Follow `antithesis-research`'s SKILL.md workflow item 4, and search for the
spelling each SDK actually uses. They differ enough that a single-language
pattern misses whole codebases:

| SDK | What to search for |
| --- | --- |
| Rust | `assert_always!`, `assert_always_or_unreachable!`, `assert_sometimes!`, `assert_reachable!`, `assert_unreachable!`, and the rich `assert_always_greater_than!`-style macros |
| C++ | **All-caps macros**: `ALWAYS`, `ALWAYS_OR_UNREACHABLE`, `SOMETIMES`, `REACHABLE`, `UNREACHABLE`, `ALWAYS_GREATER_THAN`, … |
| Go | `assert.Always`, `assert.Sometimes`, `assert.Reachable`, `assert.Unreachable`, and the rich forms |
| Java / C# | `Assert.always`, `Assert.sometimes`, `Assert.reachable`, `Assert.unreachable` (casing follows the language) |
| Python | `always`, `sometimes`, `reachable`, `unreachable` from `antithesis.assertions` |
| JavaScript | **There is no Antithesis JS SDK** (`antithesis-setup`, `references/language/javascript.md`). Use the fallback row below |
| Fallback (no SDK) | hand-written JSONL `antithesis_assert` records written to the output file. Grep the JSON shape to find the **emitter**, which is usually one helper — then find that helper's callers, which are the actual assertions. Counting the emitter as one assertion yields one property for the whole SUT and under-counts the budget |

Record the file, line, class, and message literal for each. Write the result to
`antithesis/scratchbook/existing-assertions.md` with provenance frontmatter,
**extending an existing file rather than skipping the write** — refresh its
`commit` and `updated` fields and add the entries it lacks, per
`antithesis-research`'s `references/scratchbook-setup.md`. The sweep reads
classes and callsites from this file, and `SKILL.md` requires the class to come
from a scan that runs on every sweep, so leaving a stale one in place is how an
`Unreachable` gets read as something else.

**Rich variants take their base class.** `assert_always_greater_than!`,
`ALWAYS_GREATER_THAN`, and the numeric and boolean forms in every SDK follow the
pass/fail semantics of the base class they are named after (`antithesis-triage`,
`references/properties.md`), so an `always_*` variant is `Always` for scoping and
mutation. `antithesis-workload` actively prescribes these forms for bounds, so a
real harness is full of them; a scan that only counts the five base spellings
under-counts the mutant budget quoted to the user.

**Before treating a zero as real, cross-check it against a run that already
exists.** The hard stop in `SKILL.md` — no assertions, therefore no oracle — must
never be reached because the scan looked for the wrong spelling. This scan runs
before the interview and long before the baseline is launched, so the baseline
cannot be the check: use a previous run instead, `snouty runs list` and then its
property list via `antithesis-triage`. In the scenario this path exists for the
harness has been run before, so one is normally there. A run whose property list
contains SUT assertions is proof that the oracle exists, whatever the scan
found — widen the search rather than stopping.

Do this **before the interview's budget question** — the safety-class count is
the mutant count (`SKILL.md`, opening interview).

A scan that finds no assertions **and no prior run showing any** is the hard stop
in `SKILL.md`'s prerequisites, not a case for reconstruction. There is no oracle
to validate. Where no prior run exists to check against, say that the zero is
unconfirmed when reporting the stop.

### 2. Read the baseline run

Once the baseline is green, pull its property list with the `antithesis-triage`
skill (`references/properties.md`). Four fields matter: `name` — the assertion's
message — plus `status`, `example_count`, and `counterexample_count`. **The last
is not optional**: the baseline gate is applied to this list, and it separates a
property that was violated (`counterexample_count` above zero — a real failure
that stops the sweep) from one that was never evaluated (no counterexamples and
no examples — a coverage gap that must not be reported as a safety failure). Pull
only the first three and a never-reached safety property reads as `Failing` and
stops the skill for nothing.

### 3. Join on the message string

The run's `name` is the assertion's message literal, which is why
`antithesis-workload` requires those messages to be unique project-wide. Match on
it exactly. Record the run's `name` verbatim as the key everything downstream
looks properties up by — the run side is authoritative, and quoting or escaping
in the source literal can make the two render differently even when they match.
There is no near-match rule: a callsite that does not match exactly is a
join failure, and the rows below say what each kind means.

| Join outcome | Meaning | Action |
| --- | --- | --- |
| Callsite **and** run property | A live, cataloged property | Catalog it |
| Callsite, no run property, **cataloging SDK** | Never cataloged — not instrumented, not loaded, or in an artifact outside `/opt/antithesis/catalog/` | Record it and do not mutate it. A mutant there produces an absent marker, not a verdict. Investigate the instrumentation first |
| Callsite, no run property, **fallback or JavaScript** | Normal, not a defect. These emit only when the assertion is evaluated, so they have no never-reached state to report (`mutant-design.md`) and absence means "not hit in this run" | Catalog it and mutate it like any other. Its marker is read from the run's events, not the property list (`sweep-and-verdicts.md`, the uncataloged-marker row). Do not scope it out, and do not investigate the instrumentation |
| Run property, no callsite, **name is known platform telemetry** | `Software was instrumented`, `Symbols were uploaded`, `Thread pausing was enabled`, `Assertions are present in customer code`, `Hypervisor utilization`, `Customer output volume`, `Fault injector total packets`, `Fuzzing has branches`, `Unique Edges`, `The Test Composer was used`, `No Antithesis session errors`, and similar | Not a SUT property. Exclude it. The list is a sample of what the platform emits, not a closed set — but resolve a name you do not recognize with the row below rather than assuming it is telemetry |
| Run property, no callsite, **name not on that list** | Most likely a first-party assertion the scan could not see: a vendored internal library, a fetched module, generated code | **Record it as unattributed and show it to the user.** Never fold it into the telemetry row — that silently shrinks the catalog, and the report then presents the smaller set as the scope that was validated |
| **Two callsites share one message** | Antithesis collapses them into a single catalog entry (`antithesis-workload`, `references/assertions.md`) | Affects those callsites only, not the sweep. Record the collapsed entry as *outstanding — not cataloged*, since a verdict on it cannot be attributed to either site, and report the duplicate as a defect to fix in the code. Continue with the rest of the catalog |
| **No callsite matches any run property** | Either the join key is wrong or nothing is cataloged | Re-derive the key **once** — check whether the platform prefixes or groups names — and re-join. If it still matches nothing, **stop and report**, per `SKILL.md`'s "only if none of them appear is the harness broken". Note that the baseline gate certified nothing here: it asks whether every safety property is green, and with no property matched it passed vacuously. For an inherited harness the likeliest cause is that the SDK is not linked into the shipped artifact or `/opt/antithesis/catalog/` was never populated, so report that as the thing to check |

The join also produces the slug-to-assertion-name mapping that `status.md` needs
(see `sweep-and-verdicts.md`, "Map slugs to property names first"). Record it as
you go; reconstruction gets it for free.

Create `antithesis/scratchbook/property-relationships.md` if it is absent —
`antithesis-research`'s `references/scratchbook-setup.md` requires it, and the
sweep records domination arguments there (`sweep-and-verdicts.md`). An empty file
with the provenance frontmatter is enough; the sweep fills it.

### 4. Write the catalog

Use the entry format in `antithesis-research`'s `references/property-catalog.md`
and the provenance frontmatter from its `references/scratchbook-setup.md`.

| Field | Fill it from |
| --- | --- |
| slug | A short kebab-case id derived from the message. It becomes a filename and a heading, so pick one a later research pass will keep |
| **Type** | The assertion class. `Always`, `AlwaysOrUnreachable`, `Unreachable` → Safety; `Sometimes` → Liveness; `Reachable` → Reachability |
| **Property** | The guarantee, read off the code around the callsite — not the message paraphrased back at itself |
| **Invariant** | The class, the `file:line`, and what the condition actually compares. Mutant design leans on this field harder than any other; make it concrete |
| **Antithesis Angle** | The faults or interleavings that could break it, where the surrounding code supports a claim |
| **Why It Matters** | What the code supports. Do not invent business impact — "unknown; reconstructed from the assertion" is more useful than a plausible story |
| **Open Questions** | What the reconstruction could not answer, following the research skill's Open Questions conventions. Every reconstructed property has at least one |

**Mark the catalog as reconstructed** — in the summary and in the frontmatter,
with the baseline run recorded under `external_references` as
`path: <run id>` plus a `why` naming it as the run the catalog was reconstructed
from. Record the id, never the triage URL — those are signed and expire
(`evidence-and-report.md`). A later
`antithesis-research` pass should know to deepen this file rather than trust it,
and a reader should not mistake an assertion-derived catalog for a research one.

Write an evidence file for **every catalog entry** — including the `Sometimes`
and `Reachable` ones the sweep will not mutate — at
`antithesis/scratchbook/properties/{slug}.md`: the callsite, the condition, the
baseline's `status`, `example_count`, and `counterexample_count`, and what is
unknown. `antithesis-research` requires one per entry and its self-review checks
for it, so writing them only for in-scope properties hands back a catalog with
dangling entries. Thin compared to a
research evidence file, and still the right home for the `## Falsification`
section a sweep will append later.

## Ordering

The baseline run comes **before** the catalog exists, which inverts the usual
order and changes nothing else:

1. Scan the source, before the interview
2. In the interview, say the catalog will be reconstructed, show the assertions you found, and quote the budget from the safety-class count. Slugs do not exist yet, so key `interview.md`'s Scope table by **assertion message** here, and re-key it to slugs in step 4 once the catalog assigns them
3. Fork, build, validate, launch the baseline, triage it. The scan already supplies each assertion's class, so "is every safety-class property green?" is answerable here, before any catalog exists — that is the gate, not a later step
4. Baseline green → finish the join, write the catalog and the evidence files, and report what the run added, filtered, or left unattributed
5. Continue the first sweep from "Select in-scope properties"

The human review happens in step 2, not step 4. By step 4 the sweep may be hours
old and the user long gone; what the run contributes there is a mechanical filter,
not a judgment call.
