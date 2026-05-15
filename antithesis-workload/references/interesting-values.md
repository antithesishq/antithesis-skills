# Interesting Values

Workload randomness has two axes:

- The **shape axis** — how often each menu item is drawn (probabilities, action weights). Covered in `test-commands.md` under "Vary randomness across timelines."
- The **menu axis** — what values are on the menu in the first place. Covered here.

Both axes apply, and they compose: the menu axis decides what values can be drawn; the shape axis decides how often each is drawn.

All draws in test commands must go through the SDK's random module so they replay deterministically. See `assertions.md`.

## Why the menu axis matters

If random draws come from arbitrary ranges — say, `randint(0, 1000)` — most draws land in the bulk of the range, far from any boundary. The corners where bugs hide get sampled rarely. A well-chosen menu replaces the arbitrary range with values that are interesting for the property under test: the boundaries of the input type plus property-specific values from the SUT.

What counts as interesting depends on the property. The same value (a queue size of 100) matters intensely for a backpressure property and not at all for a serialization property. Don't try to enumerate interesting values system-wide. Find them per property, at implementation time.

## Boundary values

Every type has values where behavior changes — zero or empty, type minimums and maximums, off-by-one neighborhoods of those, type-specific edge cases (NaN for floats, encoding boundaries for strings, single-element collections, and so on). The property under test usually narrows or expands this set: a backpressure property cares about empty and capacity; an overflow property cares about MAX and MAX-1; a parser property cares about empty input and inputs at length-encoding boundaries. Include the boundaries that matter for the property's inputs and types, then add the property-specific values from discovery below.

## Property-specific discovery

For each property you're implementing, build the menu in this order:

1. **Check the property's evidence file** at `antithesis/scratchbook/properties/{slug}.md`. Research may have already noted relevant configured limits and the code paths the property touches; if it has, use those as your starting point instead of re-scanning the SUT.

2. **Scan SUT code paths the property touches**. The evidence file's "Relevant code paths" notes are the natural anchor; widen the scan only if those don't surface the limits. Look for configured limits (queue capacities, batch sizes, replica counts, retry counts), default values (timeouts, intervals, sizes), and threshold constants — the literal values that decide what happens.

3. **Cross-reference config files and env vars**. Values in code are often parameterized; the runtime value depends on what the topology supplies. Check both.

4. **Opportunistically scan recent bug fixes** in the touched paths. Fixes for boundary or off-by-one bugs often expose specific values worth including. If a quick scan surfaces something, include it; otherwise move on. No deep git archaeology.

If discovery surfaces no configured limits — small or pure-logic properties — fall back to boundary values alone. That's still a valid menu. If limits are computed at runtime (e.g., `capacity = num_cores * 4`), build the family around the runtime value at the start of the timeline, the same pattern as swarmed configs (below).

## Structure: families with neighborhoods

Interesting values come in families, not flat lists. A configured value `N` parameterizes a family of values around it: `{N-1, N, N+1, ...}`. The family is named by the config it parameterizes. When the parameterizing value is a configured limit, this is a **configured-limit family** — the term used in the workload skill's self-review criterion.

When the parameterizing config is itself on the shape axis (swarmed across timelines), the family rebuilds around whatever `N` is drawn for that timeline. The menu is a function of the swarmed parameters, not a static list.

### Worked example 1: a timeout

A property exercises a connection that times out after `CONNECT_TIMEOUT_MS = 5000`.

- Boundaries: zero, one, max-of-i32
- Family around N=5000: `{4999, 5000, 5001}` — just-under, at, just-over
- Combined menu for connection-attempt durations: `{0, 1, 4999, 5000, 5001, 30000, MAX_I32}` — adding 30000 as a "well over" value, MAX_I32 as the upper boundary

If `CONNECT_TIMEOUT_MS` itself is swarmed across `{100, 5000, 60000}`, the family rebuilds per timeline. A timeline that drew `CONNECT_TIMEOUT_MS = 100` uses the menu `{0, 1, 99, 100, 101, 600, MAX_I32}`.

### Worked example 2: a queue capacity

The property checks that a bounded queue rejects writes beyond its capacity `QUEUE_CAPACITY = 64`.

- Boundaries: zero, one, max-of-usize
- Family around N=64: `{63, 64, 65}` — just-under, at, just-over
- Combined menu for number of writes to attempt: `{0, 1, 63, 64, 65, 128, MAX_USIZE}` — 128 as a "well over" value, MAX_USIZE as the upper boundary

If the test swarms `QUEUE_CAPACITY` across `{1, 64, 4096}`, the family rebuilds per timeline. A timeline that drew `QUEUE_CAPACITY = 4096` uses the menu `{0, 1, 4095, 4096, 4097, 8192, MAX_USIZE}`.

The same discovery process and family structure work for strings, collections, and other input types — the worked examples here are numeric for clarity.

## Bridging to the shape axis

Once the menu is built, the shape axis decides how often each menu item is drawn. See `test-commands.md`, "Vary randomness across timelines."

A typical pattern:

```
# At the start of the timeline:
queue_capacity = random_choice([1, 64, 4096])     # shape axis: vary the config
menu = [0, 1, queue_capacity - 1, queue_capacity, queue_capacity + 1, 2 * queue_capacity]

# Within the timeline:
n_writes = random_choice(menu)                    # menu axis: draw from the menu
```

Both `random_choice` calls go through the SDK's random module (see `assertions.md`) so the timeline replays deterministically.

## When the menu axis doesn't apply

Some properties don't have bounded inputs worth thinking about — small fixed action vocabularies like `{create, drop}`, or properties without bounded inputs at all (pure reachability, fault-driven scenarios). For those, the menu axis is a no-op. Leave a brief comment in the test command, using the project's comment syntax, that says something like:

```
menu axis not applicable: action vocabulary is fixed at {create, drop}
```

Don't fabricate inputs to fill the section. "We considered the menu axis and it doesn't apply here" is exactly the signal self-review is looking for.
