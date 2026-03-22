(function () {
  if (window.location.pathname !== "/search" || !/[?&]get_logs=true\b/.test(window.location.search)) {
    return JSON.stringify({ error: "expected selected-event logs view", url: window.location.href });
  }

  var counterText = (
    document.querySelector(".sequence_toolbar__items-counter")?.textContent || ""
  ).replace(/\s+/g, " ").trim();
  var matches = Array.from(counterText.matchAll(/(\d[\d,]*)\s*items?\b/gi));
  return matches.length ? matches[matches.length - 1][1] : "unknown";
})();
