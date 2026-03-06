(function () {
  var counterText = (
    document.querySelector(".sequence_toolbar__items-counter")?.textContent || ""
  ).replace(/\s+/g, " ").trim();

  return !!(
    document.querySelector(".sequence_printer_wrapper") &&
    document.querySelector(".sequence_filter__input") &&
    document.querySelector(".sequence_search__input") &&
    document.querySelectorAll(".event").length > 0 &&
    counterText &&
    !/Loading logs/i.test(counterText)
  );
})();
