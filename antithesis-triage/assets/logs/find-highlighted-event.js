(function () {
  if (window.location.pathname !== "/search" || !/[?&]get_logs=true\b/.test(window.location.search)) {
    return JSON.stringify({ error: "expected selected-event logs view", url: window.location.href });
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function lastTextNode(el) {
    if (!el) return "";
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === Node.TEXT_NODE && clean(nodes[i].textContent)) {
        return clean(nodes[i].textContent);
      }
    }
    return "";
  }

  function lastText(el) {
    var direct = lastTextNode(el);
    if (direct) return direct;
    return clean(el?.textContent || "");
  }

  function extractOutput(ev) {
    var assertion = ev.querySelector(".sdk-assertion__meta");
    if (assertion) return clean(assertion.textContent);

    var output = ev.querySelector(".event__varying-part .event__output_text");
    var direct = lastTextNode(output);
    if (direct) return direct;

    var fallback = clean(output?.textContent || "");
    return fallback.replace(/^event\.output_text\s*/i, "");
  }

  var events = Array.from(document.querySelectorAll(".event"));
  var highlightedIndex = events.findIndex(function (ev) {
    return ev.classList.contains("_emphasized_blue");
  });

  if (highlightedIndex < 0) return "no highlighted event found";

  var start = Math.max(0, highlightedIndex - 10);
  var end = Math.min(events.length, highlightedIndex + 5);

  return JSON.stringify(
    events.slice(start, end).map(function (ev) {
      return {
        vtime: lastText(ev.querySelector(".event__vtime")),
        source: lastText(ev.querySelector(".event__source_name")),
        text: extractOutput(ev),
        highlighted: ev.classList.contains("_emphasized_blue"),
      };
    }),
  );
})();
