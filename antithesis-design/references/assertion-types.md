# Assertion Types Reference

## The Five Assertion Types

### `assert_always!(condition, message, &details)`

Condition must be true **every time**, AND must be reached **at least once**.

| Scenario | Result |
|----------|--------|
| Reached, condition always true | Pass |
| Reached, condition ever false | **Fail** |
| Never reached | **Fail** |

Use for invariants that hold even under fault injection.

### `assert_always_or_unreachable!(condition, message, &details)`

Condition must be true **every time**, but OK if **never reached**.

| Scenario | Result |
|----------|--------|
| Reached, condition always true | Pass |
| Reached, condition ever false | **Fail** |
| Never reached | Pass |

Use for invariants on optional code paths. Closest equivalent to `assert()`.

### `assert_sometimes!(condition, message, &details)`

Condition must be true **at least once**, AND must be reached **at least once**.

| Scenario | Result |
|----------|--------|
| Reached, condition true at least once | Pass |
| Reached, condition always false | **Fail** |
| Never reached | **Fail** |

Use for coverage markers, workload progress checks, and companion assertions
for `always` (confirming the scenario actually occurs).

A failing `sometimes` means either: (1) the state is genuinely unreachable, or
(2) the workload is too weak to reach it. Both are valuable signals.

### `assert_reachable!(message, &details)`

Code must be reached **at least once**. No condition.

| Scenario | Result |
|----------|--------|
| Reached | Pass |
| Never reached | **Fail** |

Semantically identical to `assert_sometimes!(true, ...)`. Use when there's no
meaningful condition — communicates intent more clearly.

### `assert_unreachable!(message, &details)`

Code must **never** be reached.

| Scenario | Result |
|----------|--------|
| Never reached | Pass |
| Reached even once | **Fail** |

Use for error states that should be impossible in a correct system.

## Numeric Variants

Give the fuzzer visibility into actual values (not just true/false), helping it
reason about how close the system is to violating a property.

```rust
assert_always_greater_than!(x, y, message, &details);
assert_always_greater_than_or_equal_to!(x, y, message, &details);
assert_always_less_than!(x, y, message, &details);
assert_always_less_than_or_equal_to!(x, y, message, &details);
// Also: assert_sometimes_ variants of each.
```

## Compound Variants

- `assert_always_some!({a: x, b: y})` — at least one must be true every time
- `assert_sometimes_all!({a: x, b: y})` — all must be simultaneously true at least once

## Lifecycle Functions

- `antithesis_init()` — call early in `main()` in each binary to register the assertion catalog.
- `setup_complete(&details)` — signals system is ready. Triggers snapshot + fault injection. Call exactly once across entire compose config.
- `send_event(name, &details)` — structured log event for debugging (no assertion).

## Running Outside Antithesis

All SDK assertions are no-ops outside Antithesis. Leave them in production code.
Set `ANTITHESIS_SDK_LOCAL_OUTPUT=/path/to/file.jsonl` to capture events locally for debugging.
