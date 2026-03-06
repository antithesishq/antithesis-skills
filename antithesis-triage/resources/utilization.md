# Utilization

The Utilization section graphs the number of new behaviors discovered over time during this run.

## Get total test hours

```js
var metric = document.querySelector(".utilization-summary__metric");
metric ? metric.textContent.trim() : "no data";
```

The Utilization graph is rendered as SVG in the `.utilization_plot` element.
