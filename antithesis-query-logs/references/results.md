# Search Results

## Result Count

After a search completes, the count appears as:
```
Search results: N matching events
```

The loading state shows:
```
Loading results... N% done
```

Wait for loading to complete before reading results.

## Result List

Results appear in `.event_search_results` as rows with:
- **Virtual time** (vtime) — the simulation timestamp
- **Source** — which process/container emitted the event (e.g., `python3.11`)
- **Container** — which container (e.g., `client1`)
- **Event preview** — truncated assertion JSON `{antithesis_assert: ...}`

## Expanding Event Details

Each result row has a `{}` icon/button that expands to show the full
assertion details JSON. This is the structured data attached to the assertion
event — whatever key-value pairs the SUT's assertion call included as details.

The expanded details are the most reliable way to see assertion context when
log viewer output is truncated. Use this to correlate failures with specific
detail values. If all failures share a common detail (e.g., a particular
configuration mode, feature flag, or protocol version) that passing events
do not, that detail is likely part of the root cause.

## Clicking a Result

Clicking a result row opens a log viewer panel on the right side showing:
- The full timeline log centered on that event
- Preceding and following events in the same timeline
- Fault injection events
- Other assertion events

This log panel is the same as the per-example log viewer from triage. You
can use the `antithesis-triage` skill's log reading methods
(see that skill's `references/logs.md`) to programmatically read and search
within this panel.
This is the bridge between the Logs Explorer (which finds events across all
timelines) and the triage log viewer (which gives deep context around a
single event).

## List vs Map Tabs

Toggle between `List` (default) and `Map` views using the tabs near the
result count:
- **List**: Chronological event list with expandable details
- **Map**: Multiverse timeline tree with failure dots (see map.md)
