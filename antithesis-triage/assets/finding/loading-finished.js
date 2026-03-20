(function () {
  // Finding heading must be present ("Explore finding: ...")
  var headings = document.querySelectorAll("h1, h2, h3");
  var hasHeading = Array.from(headings).some(function (h) {
    return /explore finding/i.test(h.textContent || "");
  });

  // Examples table must have at least one row
  var rows = document.querySelectorAll(".examples_table__row");
  var hasExamples = rows.length > 0;

  // Inline log viewer must have events loaded (the first selected row's logs)
  var events = document.querySelectorAll(".event");
  var hasEvents = events.length > 0;

  // Item counter must be present and not show loading
  var counterText = (
    document.querySelector(".sequence_toolbar__items-counter")?.textContent || ""
  )
    .replace(/\s+/g, " ")
    .trim();
  var counterReady = counterText && !/loading/i.test(counterText);

  return !!(hasHeading && hasExamples && hasEvents && counterReady);
})();
