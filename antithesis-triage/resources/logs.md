# Logs

Logs are accessed per-example from the triage report. Each example row in an expanded property has a "get logs" link that opens a timeline-specific log viewer on the search page.

**Important:** The search/logs page requires full authentication (the report's `auth` token is not sufficient). Ensure the user is authenticated before navigating to log URLs.

## Getting log URLs from triage report examples

After expanding a property to see its examples table:

```js
JSON.stringify(
  Array.from(document.querySelectorAll(".examples_table__row")).map(
    function (row) {
      var example = row.querySelector(".example_failing, .example_passing");
      var getLogsLink = row.querySelector("a[href*='search']");
      return {
        status: example ? example.className.replace("example_", "") : "",
        time: row.querySelectorAll("td")[1]?.textContent?.trim() || "",
        logsUrl: getLogsLink ? getLogsLink.href : null,
      };
    },
  ),
);
```

## Navigate to logs for a specific example

Use the `logsUrl` from the example row to open the log viewer:

```
agent-browser open --session-name $SESSION "<logsUrl>"
agent-browser wait --session-name $SESSION --load networkidle
```

## Log viewer page structure

The log viewer is at `$TENANT.antithesis.com/search?search=...&get_logs=true&...`. It shows a timeline-specific event log centered on the assertion moment.

Log viewers are `div.sequence_printer_wrapper` elements, each with a virtual scroll.

## Get log item count

```js
document
  .querySelector(".sequence_toolbar__items-counter")
  ?.textContent?.match(/(\d[\d,]*)\s*items/)?.[1] || "unknown";
```

## Filter logs by text

```js
var filter = document.querySelector(".sequence_filter__input");
filter.value = "error";
filter.dispatchEvent(new Event("input", { bubbles: true }));
```

Clear the filter:

```js
var filter = document.querySelector(".sequence_filter__input");
filter.value = "";
filter.dispatchEvent(new Event("input", { bubbles: true }));
```

## Read visible log entries

Each `.event` element contains tooltip children (`<a-tooltip>`) followed by a text node with the actual value. Use `lastText()` to extract the visible text, skipping tooltip prefixes.

```js
(function () {
  function lastText(el) {
    if (!el) return "";
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === 3 && nodes[i].textContent.trim())
        return nodes[i].textContent.trim();
    }
    return el.textContent.trim();
  }
  var wrapper = document.querySelector(".sequence_printer_wrapper");
  return JSON.stringify(
    Array.from(wrapper.querySelectorAll(".event"))
      .slice(0, 20)
      .map(function (ev) {
        return {
          vtime: lastText(ev.querySelector(".event__vtime")),
          source: lastText(ev.querySelector(".event__source_name")),
          text: lastText(ev.querySelector(".event__output_text")),
          highlighted: ev.classList.contains("_emphasized_blue"),
        };
      }),
  );
})();
```

Note: logs use virtual scrolling — only ~50-70 rows render at a time. Scroll within `div.vscroll` to load more.

## Find the highlighted assertion event

The event that triggered the "get logs" link is highlighted with `._emphasized_blue`:

```js
(function () {
  function lastText(el) {
    if (!el) return "";
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === 3 && nodes[i].textContent.trim())
        return nodes[i].textContent.trim();
    }
    return el.textContent.trim();
  }
  var events = Array.from(document.querySelectorAll(".event"));
  var idx = events.findIndex(function (e) {
    return e.classList.contains("_emphasized_blue");
  });
  if (idx < 0) return "no highlighted event found";
  var start = Math.max(0, idx - 10);
  var end = Math.min(events.length, idx + 5);
  return JSON.stringify(
    events.slice(start, end).map(function (ev) {
      return {
        vtime: lastText(ev.querySelector(".event__vtime")),
        source: lastText(ev.querySelector(".event__source_name")),
        text: lastText(ev.querySelector(".event__output_text")),
        highlighted: ev.classList.contains("_emphasized_blue"),
      };
    }),
  );
})();
```

## Search within logs

Use the search input to find and navigate between matches:

```js
var search = document.querySelector(".sequence_search__input");
search.value = "error";
search.dispatchEvent(new Event("input", { bubbles: true }));
search.dispatchEvent(
  new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
);
```

The search count is displayed next to the search input (e.g., "1 / 30").
