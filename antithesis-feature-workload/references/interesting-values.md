# Interesting Values

## Goal

Choose values that exercise the feature's boundaries and edge cases. Don't
draw from arbitrary ranges — use a menu of values that target the boundaries
and configured limits relevant to the feature's properties.

## Two Axes of Randomness

Workload randomness has two axes:

- The **menu axis** — what values are available to draw from. Covered here.
- The **shape axis** — how often each value is drawn (probabilities, action
  weights). Covered in `references/self-driving-workload.md` under "Randomness
  and swarm testing."

Both compose: the menu decides what values exist; the shape decides how often
each is drawn. All draws must go through the SDK's random module for
deterministic replay (see `references/assertions.md`).

## Why the Menu Matters

If random draws come from arbitrary ranges — `randint(0, 1000)` — most draws
land in the bulk, far from any boundary. The corners where bugs hide get
sampled rarely. A well-chosen menu targets the interesting values: boundaries
of the input type plus values specific to the feature's code paths.

What counts as interesting depends on the feature. The same value (a queue
size of 100) matters intensely for a feature that manages backpressure and not
at all for a feature that serializes messages. Find interesting values per
feature property, at implementation time.

## Boundary Values

Every type has values where behavior changes — zero or empty, type minimums
and maximums, off-by-one neighborhoods of those, type-specific edge cases (NaN
for floats, encoding boundaries for strings, single-element collections). The
feature's code paths narrow or expand this set:

- A backpressure feature cares about empty and capacity
- A pagination feature cares about zero, one, page size, and just-over
- A parser feature cares about empty input and length-encoding boundaries
- A timeout feature cares about zero, the timeout value, and just-over

Include the boundaries that matter for the feature's inputs and types, then
add the feature-specific values from discovery below.

## Feature-Specific Discovery

Build the value menu for the feature you're testing:

1. **Start from the feature's properties.** What invariants did you identify?
   What boundaries matter for each? These are the anchor.

2. **Scan the SUT code paths the feature touches.** Look for configured limits
   (queue capacities, batch sizes, replica counts, retry counts), default
   values (timeouts, intervals, sizes), and threshold constants — the literal
   values that decide what happens on those paths.

3. **Cross-reference config files and env vars.** Values in code are often
   parameterized; the runtime value depends on what the topology supplies.
   Check both.

4. **Check recent bug fixes in the touched paths.** Fixes for boundary or
   off-by-one bugs often expose specific values worth including. If a quick
   scan surfaces something, include it.

## Structure: Families with Neighborhoods

Interesting values come in families, not flat lists. A configured value `N`
parameterizes a family: `{N-1, N, N+1, ...}`. The family is named by the
config it parameterizes.

When the parameterizing config is itself varied across runs (swarmed), the
family rebuilds around whatever `N` is drawn for that run. The menu is a
function of the parameters, not a static list.

### Worked example: a timeout

The feature uses a connection timeout of `CONNECT_TIMEOUT_MS = 5000`.

- Boundaries: zero, one, max-of-i32
- Family around N=5000: `{4999, 5000, 5001}` — just-under, at, just-over
- Combined menu: `{0, 1, 4999, 5000, 5001, 30000, MAX_I32}`

If `CONNECT_TIMEOUT_MS` is swarmed across `{100, 5000, 60000}`, the family
rebuilds per run. A run with `CONNECT_TIMEOUT_MS = 100` uses
`{0, 1, 99, 100, 101, 600, MAX_I32}`.

### Worked example: a queue capacity

The feature uses a bounded queue with capacity `QUEUE_CAPACITY = 64`.

- Boundaries: zero, one, max-of-usize
- Family around N=64: `{63, 64, 65}` — just-under, at, just-over
- Combined menu: `{0, 1, 63, 64, 65, 128, MAX_USIZE}`

If `QUEUE_CAPACITY` is swarmed across `{1, 64, 4096}`, the family rebuilds
per run.

## When the Menu Axis Doesn't Apply

Some features don't have bounded inputs worth targeting — small fixed action
vocabularies like `{create, drop}`, or pure reachability / fault-driven
scenarios. For those, the menu axis is a no-op. Note this in the workload
code:

```
# menu axis not applicable: action vocabulary is fixed at {create, drop}
```

Don't fabricate values to fill a gap. "We considered the menu axis and it
doesn't apply" is a valid outcome.
