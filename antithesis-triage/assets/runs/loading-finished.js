(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;

    var rect = el.getBoundingClientRect();
    return !!(
      rect.width > 0 &&
      rect.height > 0 &&
      window.getComputedStyle(el).visibility !== "hidden" &&
      window.getComputedStyle(el).display !== "none"
    );
  }

  var scroller = document.querySelector(".vscroll");
  if (!scroller) return false;

  var rows = Array.from(document.querySelectorAll("a-row"));
  if (rows.length === 0) return false;

  var hasRenderedCells = rows.some(function (row) {
    return row.querySelector("a-cell, [cell-identifier]");
  });

  if (!hasRenderedCells) return false;

  var hasVisibleLoadingIndicator = Array.from(scroller.querySelectorAll("*")).some(
    function (el) {
      return isVisible(el) && /^Loading(?:\.\.\.)?$/.test(clean(el.textContent));
    },
  );

  return !hasVisibleLoadingIndicator;
})();
