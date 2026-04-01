# Multiverse Map

## Overview

The Map tab shows a tree visualization of all timelines in a test run.
Gray lines represent timelines, which branch from parent timelines when
Antithesis forks execution to explore different paths. Purple dots mark
where the searched events occur.

## Cluster Analysis

Failures that appear on the same timeline branch likely share a common
root cause. Failures on different branches are independent reproductions.

**Key metric: independent cluster count.**

- "8 failures in 2 clusters" — likely 2 distinct root causes
- "8 failures in 8 clusters" — 8 independent reproductions, strong signal
- "8 failures in 1 cluster" — potentially one root cause cascading through
  forked timelines

## Investigation Strategy

1. Identify how many distinct clusters exist
2. Pick one representative failure from each cluster
3. Investigate each cluster's representative — failures within the same
   cluster are likely very similar
4. Different clusters may have different root causes

## Accessing the Map

After executing a search, click the `Map` tab near the results count.
The map renders with the timeline tree and event dots.

## DOM Structure

The map tab is selectable via a tab element near the search results.
The map itself renders as an interactive visualization — right-click
for zoom and view options.

Clicking a dot on the map opens the corresponding log viewer panel, same as
clicking a result in the List view. From there you can use the
`antithesis-triage` skill's log reading methods (see that skill's
`references/logs.md`) to inspect the full timeline context around that event.
