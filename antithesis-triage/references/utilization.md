# Utilization

The Utilization section graphs the number of new behaviors discovered over time during this run.

## Get total test hours

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getUtilizationTotalTestHours()"
```

The Utilization graph is rendered as SVG in the `.utilization_plot` element.
