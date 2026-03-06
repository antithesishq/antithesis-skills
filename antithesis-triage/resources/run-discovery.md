# Run Discovery

If the user did not provide an explicit triage report url, you can search for recent runs at `https://$TENANT.antithesis.com/runs`.

The runs page is a virtualized grid rendered with `a-row` / `a-cell`, not a
plain HTML `<table>`. Rows are loaded in a `.vscroll` container, so a DOM query
only sees the currently rendered rows unless you scroll.

## Get recent runs as JSON

This expression scrolls through the virtualized runs list, collects all rendered
rows it encounters, and returns one JSON object per run.

```js
(async function () {
  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function text(el, selector) {
    var target = selector ? el.querySelector(selector) : el;
    return clean(target && target.textContent);
  }

  function ownText(el) {
    if (!el) return "";
    return clean(
      Array.from(el.childNodes)
        .filter(function (n) {
          return n.nodeType === Node.TEXT_NODE;
        })
        .map(function (n) {
          return n.textContent;
        })
        .join(" "),
    );
  }

  function tooltipMap(tooltip) {
    if (!tooltip) return {};

    var out = {};
    var rows = Array.from(tooltip.children);
    if (rows.length === 1 && rows[0].children.length) {
      rows = Array.from(rows[0].children);
    }

    rows.forEach(function (row) {
      var keyEl =
        row.querySelector(".runs_table_muted_tooltip_text") ||
        row.querySelector(".runs_table_name_column_tooltip_key");
      var valueEl = row.querySelector(".runs_table_tooltip_text");
      var key = clean(keyEl && keyEl.textContent).replace(/:$/, "");
      var value = clean(
        valueEl
          ? valueEl.textContent
          : clean(row.textContent).replace(clean(keyEl && keyEl.textContent), ""),
      );
      var parsed = clean(row.textContent).match(/^([^:]+):\s*(.*)$/);

      if (!key && parsed) key = clean(parsed[1]);
      if (!value && parsed) value = clean(parsed[2]);

      if (key) out[key] = value;
    });

    return out;
  }

  function pairMap(container) {
    if (!container) return {};

    var spans = Array.from(container.querySelectorAll("span"));
    var out = {};
    for (var i = 0; i + 1 < spans.length; i += 2) {
      var key = clean(spans[i].textContent).replace(/:$/, "");
      var value = clean(spans[i + 1].textContent);
      if (key) out[key] = value;
    }
    return out;
  }

  function findingsMap(container) {
    if (!container) return {};

    var out = {};
    Array.from(container.querySelectorAll("span")).forEach(function (span) {
      var m = clean(span.textContent).match(/^(\S+)\s+(.+)$/);
      if (m) out[m[2].toLowerCase()] = m[1];
    });
    return out;
  }

  function actionUrl(cell, label) {
    var link = Array.from(cell.querySelectorAll("a")).find(function (a) {
      return clean(a.textContent) === label;
    });
    return link ? link.href : null;
  }

  function runKey(run) {
    return (
      run.triageUrl ||
      run.logsUrl ||
      [run.name, run.description, run.date, run.time].join(" | ")
    );
  }

  function parseRow(row) {
    var nameCell = row.querySelector('[cell-identifier="name"]');
    var creatorSource = row.querySelector('[cell-identifier="creator_source"]');
    var creatorName = row.querySelector('[cell-identifier="creator_name"]');
    var dateCell = row.querySelector('[cell-identifier="date"]');
    var timeCell = row.querySelector('[cell-identifier="time"]');
    var statusCell = row.querySelector('[cell-identifier="status"]');
    var durationCell = row.querySelector('[cell-identifier="duration"]');
    var findingsCell = row.querySelector(".runs_table_run_findings");
    var utilizationCell = row.querySelector(".runs_table_utilization");
    var actionCell = row.querySelector("a-cell.table_left_most_right_pinned_col");

    var nameTooltip = nameCell ? nameCell.closest("a-cell").querySelector("a-tooltip") : null;
    var creatorTooltip = creatorSource
      ? creatorSource.closest("a-cell").querySelector("a-tooltip")
      : null;
    var nameMeta = tooltipMap(nameTooltip);
    var creatorMeta = tooltipMap(creatorTooltip);

    return {
      name:
        nameMeta.Name ||
        text(nameCell, ".runs_table_muted_tooltip_text") ||
        text(nameCell),
      description:
        nameMeta.Description || text(nameCell, ".runs_table_tooltip_text"),
      creatorSource: text(creatorSource),
      creatorName: ownText(creatorName && creatorName.querySelector("div")) || text(creatorName),
      creatorCategory: creatorMeta.Category || "",
      cadence: creatorMeta.Cadence || "",
      commit: creatorMeta["Commit hash"] || "",
      repository: creatorMeta.Repository || "",
      date: text(dateCell),
      time: text(timeCell),
      status: text(statusCell),
      duration: text(durationCell),
      findings: findingsMap(findingsCell),
      utilization: pairMap(utilizationCell),
      triageUrl: actionCell ? actionUrl(actionCell, "Triage results") : null,
      logsUrl: actionCell ? actionUrl(actionCell, "Explore Logs") : null,
      hasTriageResults: !!(actionCell && actionUrl(actionCell, "Triage results")),
    };
  }

  var scroller = document.querySelector(".vscroll");
  if (!scroller) return JSON.stringify({ error: "runs scroller not found" });

  var runs = new Map();
  var previousScrollTop = -1;
  var stablePasses = 0;

  for (var i = 0; i < 200; i++) {
    Array.from(document.querySelectorAll("a-row")).forEach(function (row) {
      var run = parseRow(row);
      var key = runKey(run);
      if (key) runs.set(key, run);
    });

    var maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    var nextScrollTop = Math.min(
      maxScrollTop,
      scroller.scrollTop + Math.max(200, Math.floor(scroller.clientHeight * 0.8)),
    );

    if (nextScrollTop === scroller.scrollTop || nextScrollTop === previousScrollTop) {
      stablePasses += 1;
      if (stablePasses >= 2) break;
    } else {
      stablePasses = 0;
    }

    previousScrollTop = scroller.scrollTop;
    scroller.scrollTop = nextScrollTop;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise(function (r) {
      setTimeout(r, 100);
    });
  }

  return JSON.stringify({
    count: runs.size,
    runs: Array.from(runs.values()),
  });
})();
```

Notes:

- `triageUrl` is `null` for runs that are still in progress and do not yet have a report.
- `findings` is keyed by labels such as `new`, `ongoing`, `resolved`, and `rare`.
- `utilization` is keyed by labels such as `Test hours`, `Setup`, and `Explore`.
