(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  var rows = document.querySelectorAll(".examples_table__row");

  return JSON.stringify(
    Array.from(rows).map(function (row, index) {
      var cells = row.querySelectorAll("td");
      var status = cells[0] ? clean(cells[0].textContent) : "";
      var time = cells[1] ? clean(cells[1].textContent) : "";

      var logLinks = row.querySelectorAll("a[href*='search']");
      var logsUrl = logLinks.length > 0 ? logLinks[0].href : null;

      var momentEl = row.querySelector("a[href*='moment'], [class*='moment']");
      var hasMoment =
        row.textContent.includes("moment") &&
        !row.textContent.includes("get logs moment");

      var artifactCell = cells[3] ? clean(cells[3].textContent) : "";
      var isSelected = row.classList.contains("_selected");

      return {
        index: index,
        status: status,
        time: time,
        artifacts: artifactCell,
        logsUrl: logsUrl,
        isSelected: isSelected,
      };
    }),
  );
})();
