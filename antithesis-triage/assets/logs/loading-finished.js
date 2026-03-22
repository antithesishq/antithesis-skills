(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;

    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    var style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  var wrapper = document.querySelector(".sequence_printer_wrapper");
  var filterInput = document.querySelector(".sequence_filter__input");
  var searchInput = document.querySelector(".sequence_search__input");
  var counter = document.querySelector(".sequence_toolbar__items-counter");
  var counterText = clean(counter?.textContent);
  var visibleEvents = Array.from(document.querySelectorAll(".event")).filter(isVisible)
    .length;
  var hasItemCount = /(\d[\d,]*)\s*items?\b/i.test(counterText);
  var inSelectedLogView =
    location.search.indexOf("get_logs=true") !== -1 ||
    /selected event log/i.test(clean(document.body.textContent));

  return !!(
    inSelectedLogView &&
    isVisible(wrapper) &&
    isVisible(filterInput) &&
    isVisible(searchInput) &&
    isVisible(counter) &&
    visibleEvents > 0 &&
    hasItemCount &&
    !/loading logs/i.test(counterText)
  );
})();
