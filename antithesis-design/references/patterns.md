# Assertion Patterns and Anti-Patterns

## Patterns

### Tiered SLO Assertions

Multiple `always` assertions with progressively looser bounds. The tightest
tier that passes tells you the actual SLO under fault injection.

```rust
assert_always!(elapsed_ms < 500,  "No mismatch > 500ms", &details);
assert_always!(elapsed_ms < 1000, "No mismatch > 1s",    &details);
assert_always!(elapsed_ms < 3000, "No mismatch > 3s",    &details);
assert_always!(elapsed_ms < 5000, "No mismatch > 5s",    &details);
```

### Coverage Companion for Always

An `always` assertion is vacuously uninformative if its triggering scenario
never occurs. Pair with `sometimes`/`reachable` to confirm the scenario happens.

```rust
// Confirms mismatches actually occur during the test.
assert_sometimes!(true, "Schema mismatch resolved within retry window", &details);
// Only meaningful if mismatches happen (above).
assert_always!(elapsed_ms < 500, "No mismatch > 500ms", &details);
```

### Operation Diversity Markers

When a workload randomly selects operations, `reachable` on each type confirms
the selection covers everything.

```rust
assert_reachable!("Executed CREATE TABLE", &json!({}));
assert_reachable!("Executed ALTER TABLE ADD COLUMN", &json!({}));
assert_reachable!("Executed DROP TABLE", &json!({}));
```

### Success + Unreachable Sentinels

`reachable` on success, `unreachable` on error states that should be impossible.

```rust
assert_reachable!("Chaos driver activated failpoint", &json!({"failpoint": name}));
assert_unreachable!("Failpoint HTTP request failed", &json!({"error": e.to_string()}));
```

### Workload Progress Markers

Confirm the workload made progress (wasn't starved by fault injection).

```rust
assert_sometimes!(iteration > 0, "Driver completed at least one iteration", &details);
```

### Correctness at Multiple Levels

Fine-grained assertions for specific failure modes, coarse reachability for
overall success. The fire-on-failure `always` assertions only fire when
violated — the message describes the invariant, and the `false` condition
makes the property fail immediately.

```rust
if upstream.len() != readyset.len() {
    assert_always!(false, "Row count matches upstream", &details);
    bail!("Row count mismatch");
}
// Overall success marker.
assert_reachable!("ReadysetQuerySuccess");
```

Note: fire-on-failure `always` assertions also fail if never reached (must_hit).
If the success case uses a different assertion (like `reachable`), use
`unreachable` on the error path instead.

## Anti-Patterns

### `assert_always!(true, ...)` for Reachability

```rust
// BAD: hardcoded true is just a reachability check with misleading semantics.
assert_always!(true, "fuzz iteration passed", &details);
// GOOD:
assert_reachable!("fuzz iteration passed", &details);
```

### Paired `always(true)` / `always(false)` for Pass/Fail

```rust
// BAD: a single fault-injection-induced failure permanently fails the property.
Ok(()) => assert_always!(true, "iteration passed", &details),
Err(e) => assert_always!(false, "iteration passed", &details),
```

Use `reachable` for "at least one passed." Put correctness assertions *inside*
the iteration for "no correctness bugs."

### `always` on Operations That Can Legitimately Fail

```rust
// BAD: network operations fail under fault injection.
assert_always!(response.status().is_success(), "HTTP request succeeds", &details);
// GOOD:
assert_sometimes!(response.status().is_success(), "HTTP request sometimes succeeds", &details);
```

### Missing Companion Assertions

```rust
// BAD: vacuously uninformative if the retry loop is never entered.
assert_always!(elapsed < timeout, "Retry resolves within timeout", &details);
// GOOD:
assert_reachable!("Entered retry loop", &json!({}));
assert_always!(elapsed < timeout, "Retry resolves within timeout", &details);
```

### Changing Assertion Messages Between Releases

Antithesis tracks properties by message across runs. Renaming loses historical
data. Treat messages as stable identifiers.

### Overly Generic Messages

```rust
// BAD: unrelated checks sharing a message collapse into one property.
assert_always!(x > 0, "invariant holds", &json!({}));
assert_always!(y > 0, "invariant holds", &json!({})); // Same property!
// GOOD:
assert_always!(x > 0, "counter x is positive", &json!({}));
assert_always!(y > 0, "counter y is positive", &json!({}));
```
