(function () {
  if (window.location.pathname !== "/search" || !/[?&]get_logs=true\b/.test(window.location.search)) {
    return JSON.stringify({ error: "expected selected-event logs view", url: window.location.href });
  }

  if (typeof window.__ANTITHESIS_QUERY__ !== "string" || window.__ANTITHESIS_QUERY__ === "") {
    return JSON.stringify({
      error: "expected window.__ANTITHESIS_QUERY__ to be set",
      url: window.location.href,
    });
  }

  var query = window.__ANTITHESIS_QUERY__;
  var search = document.querySelector(".sequence_search__input");
  search.value = query;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  search.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
})();
