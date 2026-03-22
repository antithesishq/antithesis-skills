// Returns the total item count from the finding page's inline log viewer.
// Scoped to the visible counter to avoid reading hidden panel counters.
(function () {
  var counters = document.querySelectorAll(".sequence_toolbar__items-counter");
  for (var i = 0; i < counters.length; i++) {
    if (counters[i].offsetHeight > 0) {
      var text = (counters[i].textContent || "").replace(/\s+/g, " ").trim();
      var matches = Array.from(text.matchAll(/(\d[\d,]*)\s*items?\b/gi));
      return matches.length ? matches[matches.length - 1][1] : "unknown";
    }
  }
  return "unknown";
})();
