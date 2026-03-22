(function () {
  if (window.location.pathname !== "/search" || !/[?&]get_logs=true\b/.test(window.location.search)) {
    return JSON.stringify({ error: "expected selected-event logs view", url: window.location.href });
  }

  var filter = document.querySelector(".sequence_filter__input");
  filter.value = "";
  filter.dispatchEvent(new Event("input", { bubbles: true }));
})();
