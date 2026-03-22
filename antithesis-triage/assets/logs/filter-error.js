(function () {
  if (window.location.pathname !== "/search" || !/[?&]get_logs=true\b/.test(window.location.search)) {
    return JSON.stringify({ error: "expected selected-event logs view", url: window.location.href });
  }

  var query =
    typeof window.__ANTITHESIS_QUERY__ === "string"
      ? window.__ANTITHESIS_QUERY__
      : "error";
  var filter = document.querySelector(".sequence_filter__input");
  filter.value = query;
  filter.dispatchEvent(new Event("input", { bubbles: true }));
})();
