# Multiple Test Directories

## When to use multiple test directories

Each Antithesis timeline runs commands from **one test directory**. With
multiple test directories, Antithesis explores each configuration in
different timelines within a single run.

Use multiple test directories when:

- **A driver causes cascading failures** that contaminate results for other
  properties. Put the disruptive driver in one test dir, everything else in
  another. Clean timelines give you uncontaminated data without remembering
  to toggle the driver on and off between runs.
- **Destructive operations interfere with other drivers.** Operations that
  destroy shared state (e.g., dropping tables, killing nodes, migrating
  storage formats) can be isolated so other drivers get stable timelines.
- **You want to test different configurations.** Each test dir can set
  different feature flags, client configurations, or protocol versions.
  Antithesis explores all configurations in one run.
- **You want graduated test complexity.** A "smoke" test dir with fast
  simple drivers alongside a "stress" test dir with heavy drivers ensures
  the smoke tests get clean timelines.

Do NOT split if:
- Drivers need to interact concurrently to trigger the bug you're looking for
- There is no cascade or interference problem (splitting halves timeline budget)
- One test dir is simpler and sufficient

## Implementation

### Use hard links, not symlinks

Hard links (`ln`, not `ln -s`) ensure that assertion `location.file` reports
the correct test directory. Python and many languages resolve symlinks when
reporting `__file__`, so with symlinks, `location.file` always shows the
source directory regardless of which test dir actually ran.

```dockerfile
# Source of truth — all drivers
COPY my-tests/ /opt/antithesis/test/v1/full/

# Filtered copy via hard links — exclude disruptive drivers
RUN mkdir -p /opt/antithesis/test/v1/core && \
    for f in /opt/antithesis/test/v1/full/*; do \
        name=$(basename "$f"); \
        case "$name" in \
            parallel_driver_dangerous_thing) ;; \
            first_*|finally_*|parallel_driver_*|serial_driver_*| \
            singleton_driver_*|anytime_*|eventually_*|helper_*) \
                ln "$f" /opt/antithesis/test/v1/core/"$name" ;; \
        esac; \
    done
```

### Only link TC-recognized prefixes

The Test Composer rejects unrecognized files in test directories. Only
hard-link files with TC-recognized prefixes (`first_`, `finally_`,
`parallel_driver_`, `serial_driver_`, `singleton_driver_`, `anytime_`,
`eventually_`) and `helper_` files.

Do NOT link `__pycache__`, SDK directories, or other support files.

### Exclude repair companions with destructive drivers

If a driver has a companion repair driver (e.g., `serial_driver_repo_repair`
exists to fix damage from `parallel_driver_refs_migrate`), exclude both
from the clean test dir. The repair driver is unnecessary when the
destructive driver isn't present.

### Register both dirs for assertion cataloging

```dockerfile
RUN ln -sf /opt/antithesis/test/v1/full /opt/antithesis/catalog/full
RUN ln -sf /opt/antithesis/test/v1/core /opt/antithesis/catalog/core
```

### Helper module imports

If drivers hardcode `sys.path.insert(0, "/opt/antithesis/test/v1/full")`
to find helper modules, this still works from hard-linked copies in `core/`
because the path is file content, not dependent on invocation location.

## Interpreting results

### Identifying which test dir produced a failure

Use `assertion.file` in the Logs Explorer. With hard links, this field
contains the full path including the test directory name:
`/opt/antithesis/test/v1/core/parallel_driver_fetch`.

| Field | Where | Works? |
|-------|-------|--------|
| `assertion.file` | Logs Explorer query filter | **Yes** — with hard links, shows correct test dir |
| `location.file` in assertion details | Triage report findings | **Yes** — same field, visible in expanded `{...}` details |
| `general.source` | Logs Explorer events | **No** — shows process name (`python3.11`), not test dir |

**Warning:** Do NOT use `general.source` to filter by test directory.
It contains the process name (e.g., `python3.11`), not the TC command
name. Filtering by `general.source contains "core/"` returns zero for
both passes and failures, giving a false "no events" result.

### Filtering by test dir in the Logs Explorer

Filter by `assertion.file` which contains the test directory path:

```
assertion.message contains "my-property"
AND assertion.status matches "failing"
AND assertion.file contains "core/"
```

This returns only failures from `core/` timelines, which cannot have
cascade noise from drivers excluded from that test dir.

**Always validate your filter** by checking passing events too. If
`assertion.file contains "core/"` with `assertion.status matches "passing"`
returns zero, your filter is broken — not your test.

### Sometimes assertions

A Sometimes assertion ("must be true at least once per run") is evaluated
across ALL timelines in a run. If the assertion fires as true in any
timeline — whether `core/` or `full/` — it passes for the whole run.

The split does not cause Sometimes failures as long as the driver that
emits the assertion exists in at least one test directory.

### Timeline budget

Each test directory gets a share of the timeline exploration budget. With
two test dirs, each gets roughly half. Plan run duration accordingly — a
2-hour run with two test dirs gives approximately 1 hour of exploration per
configuration.
