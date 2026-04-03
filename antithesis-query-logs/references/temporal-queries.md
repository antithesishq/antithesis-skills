# Temporal Queries

## Overview

Temporal queries filter results based on whether another event occurs before
or after the matched event in the same timeline. Uses include:

- **Cascade elimination**: Are these failures independent, or are they
  downstream consequences of an earlier failure?
- **Correlation with earlier state**: Are all failures preceded by a
  particular random selection or configuration choice made earlier in the
  timeline (e.g., a software version, a feature flag, a startup mode)?
- **Root cause hypothesis testing**: A component starts in a particular
  state and much later something fails. Are all the failures in timelines
  where that initial state was set? Use "preceded by" to confirm or
  "not preceded by" to find counterexamples that disprove the hypothesis.
- **Fault injection correlation**: Are failures preceded by a specific fault
  event (network partition, disk error, thread pause)? If all failures
  require a fault, the bug is less severe than one that happens without
  injection. Use "NOT preceded by" any fault to find bugs that occur under
  normal operation — those are the scariest.
- **Container kill/restart correlation**: Container kills and restarts are
  a common trigger for bugs. Check whether failures are preceded by a
  container kill or restart event to determine if the bug is
  crash-recovery-related.
- **Error-handling path correlation**: Timeouts, retries, fallbacks, and
  failovers are all candidates to check as precursors to a bug. These
  error-handling paths are exercised rarely in production but frequently
  under Antithesis fault injection, and bugs often hide in or just after
  them.
- **Recovery verification** (using "followed by"): After a failure or
  disruption, was there a recovery event? Failures NOT followed by a
  reconnection or healing event indicate liveness problems.
- **Ordering violations**: Some operations are safe in one order but buggy
  in another (A then B is fine, but B then A is a bug). Search for failures
  of B that are "preceded by" A (should be safe) vs "not preceded by" A
  (the dangerous ordering) to confirm the ordering dependency.
- **Partitioning failures by root cause**: You have many failures of the
  same property but suspect multiple distinct causes. Use "preceded by"
  queries with different candidate precursors to split failures into subsets
  and count each — this reveals how many distinct mechanisms produce the
  same symptom.

## Temporal Types

| Type                | `y` value           | Meaning                                        |
| ------------------- | ------------------- | ---------------------------------------------- |
| None                | `"none"`            | Simple query, no temporal filter               |
| Preceded by         | `"preceded_by"`     | Match events that ARE preceded by the condition |
| Not preceded by     | `"not_preceded_by"` | Match events NOT preceded by the condition      |
| Followed by         | `"followed_by"`     | Match events that ARE followed by the condition |
| Not followed by     | `"not_followed_by"` | Match events NOT followed by the condition      |

## URL Construction (Preferred)

Build temporal queries by modifying the query JSON before encoding it into
the search URL. See `query-builder.md` for the base JSON format.

### JSON Format for Temporal Queries

Set the `y` field on the main query block (`q.n`) to the temporal type, and
add a `p` sibling key containing the temporal condition:

```json
{
  "q": {
    "n": {
      "r": {
        "h": [
          {
            "h": [
              {
                "c": false,
                "f": "assertion.message",
                "o": "contains",
                "v": "data-integrity-after-restart"
              }
            ],
            "o": "or"
          },
          {
            "h": [
              {
                "c": false,
                "f": "assertion.status",
                "o": "matches",
                "v": "failing"
              }
            ],
            "o": "or"
          }
        ],
        "o": "and"
      },
      "t": {
        "g": false,
        "m": ""
      },
      "y": "not_preceded_by"
    },
    "p": {
      "r": {
        "h": [
          {
            "h": [
              {
                "c": false,
                "f": "general.output_text",
                "o": "contains",
                "v": "connection refused"
              }
            ],
            "o": "or"
          }
        ],
        "o": "and"
      }
    }
  },
  "s": "{session_id}"
}
```

### Key Differences from Simple Query

| Field    | Simple query | Temporal query            |
| -------- | ------------ | ------------------------- |
| `q.n.y`  | `"none"`     | `"not_preceded_by"`, etc. |
| `q.p`    | absent       | temporal condition block   |

The `q.p` block uses the same `r.h` structure as the main `q.n.r` block —
it is a full query with its own field/operator/value conditions.

### Temporal Window

The `t` field controls the look-back or look-ahead window:

- `t.g = false`, `t.m = ""` — any event in the timeline (no window limit)
- `t.g = true`, `t.m = "30"` — within 30 seconds

## Building a Cascade Elimination Query

### Workflow

1. **First query (baseline)**: Build a simple query for the target failures.
   Count the results.

2. **Second query (with temporal filter)**: Build the same query but with
   `y: "not_preceded_by"` and a `p` block matching the suspected cascade
   source. Count the results.

3. **Compare counts**:
   - Same count → failures are independent, not cascades
   - Count drops → the difference is cascade failures
   - Count drops to zero → all failures are cascades

### Example: Ruling out cascades from an upstream failure

**Hypothesis**: `data-integrity-after-restart` failures might be cascades
from an earlier `connection-pool-exhausted` failure in the same timeline.

**Query 1** (baseline):
- `assertion.message` contains `data-integrity-after-restart`
- AND `assertion.status` matches `failing`
- Result: 53 matching events

**Query 2** (temporal filter):
- Same WHERE clause
- NOT PRECEDED BY: `assertion.message` contains `connection-pool-exhausted`
- Result: 53 matching events (same count)

**Conclusion**: All 53 failures are independent — none were preceded by the
upstream failure. The two properties fail for different reasons.

### Example: Confirming a root cause correlation

**Query 1**: `assertion.message` contains `order-total-never-negative`
AND `assertion.status` matches `failing` → 8 results

**Query 2**: Same, but PRECEDED BY `general.output_text` contains
`failover to secondary` → 8 results (all match)

**Conclusion**: All 8 failures were preceded by a failover event. The
bug is in the failover path, not in normal operation.

## UI Interaction (Fallback)

### Temporal Connectors

Below the main query block, two buttons appear:

- **Preceded by** — adds a temporal clause above the WHERE block
- **Followed by** — adds a temporal clause below the WHERE block

Clicking either adds a new query block with its own field/operator/value rows.

### Preceded By / Not Preceded By

After clicking "Preceded by", a new block appears above WHERE with:

1. A **dropdown** that allows switching between:
   - `Preceded by` — match events that ARE preceded by the condition
   - `Not preceded by` — match events that are NOT preceded by the condition

2. A **time window**: `any event within` `Look-back` `seconds`
   - Default is "any event within" which means anywhere earlier in the timeline
   - Can be narrowed to a specific time window

3. **Query rows** — same field/operator/value format as the main WHERE block

### Building via UI

1. Click "Preceded by" to add the temporal block
2. In the temporal block's dropdown, select "Not preceded by"
3. Field: `assertion.message` contains the cascade source property name
4. AND: `assertion.status` matches `failing`
5. In the WHERE block:
   - Field: `assertion.message` contains the target property name
   - AND: `assertion.status` matches `failing`
6. Click Search

### DOM Selectors for Temporal Controls

The "Preceded by" and "Followed by" are clickable labels:
```
label elements with text "Preceded by" and "Followed by"
```

The dropdown to switch between "Preceded by" and "Not preceded by":
```
After clicking Preceded by, a dropdown appears with options:
- "Preceded by"
- "Not preceded by"
```

The time window controls:
```
"any event within" dropdown + "Look-back" input + "seconds" label
```
