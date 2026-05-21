# Property queries

Use `snouty runs --json properties` to retrieve properties and `assets/download-logs.sh`to download a log of a specific history. The `properties` return data will give you what you need to get the logs.


## Getting all properties

Use `snouty runs --json properties "$(OPTION)" "$(RUN_ID)"` to download all the properties for a run. 
OPTION can be `--passing` or `--failing` to retrieve just passing or just failing properties.

Example return:

```json
{
  "counterexample_count": 11,
  "counterexamples": [
    {
      "moment": {
        "input_hash": "1953917995480797787",
        "vtime": "182.42924608523026"
      }
    },
    {
      "moment": {
        "input_hash": "4038006772091147322",
        "vtime": "181.52766803186387"
      }
    },
    {
      "moment": {
        "input_hash": "7249623954355301396",
        "vtime": "181.67649806430563"
      }
    }
  ],
  "description": "Property description goes here.",
  "example_count": 1731,
  "examples": [
    {
      "moment": {
        "input_hash": "6247583012788407497",
        "vtime": "231.3688659959007"
      }
    }
  ],
  "is_event": true,
  "is_group": true,
  "name": "Invariant: expected record exists in FDB",
  "status": "Failing"
}
```
A "counterexample" is a case where a property FAILED to hold.
An "example" is a case where a property DID hold.

* `example_count` gives the number of times the property PASSED 
* `counterexample_count` gives the number of times the property FAILED. 

These are from across all the histories in the run (not just the 3-4 example rows returned for the property in the property list.

* `name` is the name of the property as it appears in the triage report and as it is known to the user.

* `counterexamples`:  This field contains an array of a *select* number of counterexamples from the run. 

* `examples`: This field contains array of a *select* number of passing examples of the property from the run. 

* `moment` (in the `example` and `counterexample` items): This information allows you to retrieve the logs from the history
  leading up the the property pass or failure.

Each property may expose multiple example rows (typically 3-4), mixing failing
and passing examples. When triaging, start with the **first failing example**
(usually index 0) by default. Cross-referencing a passing example can help
narrow down root cause by showing what's different in a healthy execution. If you want more
examples you may obtain more log files for failures that match the property. You will need to 
retrieve the log file to get the details of the failure in order to perform the search,
first using `snouty runs events` and then using the `antithesis-query-logs` skill 
if more examples are needed.

### Filtering properties

If you want to filter the properties based on passing or failing, this is supported 
directly by `snouty runs --json properties` with an option.

Otherwise use `jq` to filter the output of `snouty runs --json properties`.


### Using pass/fail ratios for triage prioritization

For a given property, you can example the pass/fail counts to help invetigate the property. (Remember these are communicated in the `example_count` and `counterexample_count` fields in the property information.) 

- **All failing (0 passing)** — Likely a setup or workload bug. The property is being violated in every execution history.
- **Mostly failing with rare passes** — Most likely a setup or workload bug, or for some reason the system under test is not setup for
antithesis. Don't forget to read the antithesis documentation when analysing this.
- **Mostly passing with rare failures** — Strong candidate for a real SUT bug. Pay attention to rare event orderings or fault patterns in the logs.
- **Roughly even split** — The property may be sensitive to configuration or timing. Check whether passing vs failing correlates with fault intensity or a choice made at the beginning of the history (such as what test to run or parameters to use for a given history).

## Assertion types and what they mean for triage

Each property is backed by an assertion of a specific type. The type determines what a failure actually tells you:

- **`Always`**: Must be true every evaluation. Fails if the condition is false at least once.
- **`AlwaysOrUnreachable`**: Either never reached, or true every time reached. Fails if reached at least once AND false at least once. A rare or optional path was exercised and the invariant didn't hold. The path being reached is itself informative.
- **`Sometimes`**: Must be true at least once across the entire run. Fails if the condition is never true.
- **`Reachable`**: The assertion point must be reached at least once. Fails if never reached. Could be a test coverage gap, a workload that never triggers the state, or a SUT bug that prevents the path.
- **`Unreachable`**: The assertion point must never be reached. Fails if reached at least once. A forbidden or impossible path was entered.

`Always` and `Sometimes` assertions imply `Reachable`. If any `Reachable` assertion fails but has no examples, this means that it was never reached. This might simply be due to the test not running long enough, or it may be that the workload is not triggering the state. It may also mean that a SUT bug is preventing the assertion from being reached, although ideally you can discern that via another property that catches the bug.

Numeric/boolean variants (e.g., `AlwaysGreaterThan`, `SometimesAll`) follow the same pass/fail semantics as their base type but attach the compared operands to assertion details automatically.

## Download a log

To further analyze a property failure, download the log leading up to the failure (or to a passing example, for comparison) and examine it. `references/logs.md` covers the log format and useful jq queries. What follows here are the mechanics of obtaining the log.

Use the `assets/download-logs.sh` script:

```bash
assets/download-logs.sh \
  -o /tmp/triage/${PROPERTY_NAME}_${INPUT_HASH}.json \
  "$RUN_ID" "$INPUT_HASH" "$VTIME"
```

The script wraps `snouty runs --json logs RUN_ID INPUT_HASH VTIME` and pipes the NDJSON stream through `process-logs.py`, which strips ANSI escape codes, adds `vtime_seconds`, and annotates each event with `active_faults`. The output is a JSON array.

`INPUT_HASH` and `VTIME` come verbatim from the property's `examples` or `counterexamples` array — pass them as strings, do not round or reformat. Pass `--raw` to skip annotation and write the unmodified NDJSON.

Always write logs to a unique path unless you have explicit instructions otherwise. Other agents may be concurrently downloading logs.

To learn how to understand logs, refer to `references/logs.md`.
