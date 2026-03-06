JSON.stringify(
  Array.from(document.querySelectorAll(".examples_table__row")).map(
    function (row) {
      var example = row.querySelector(".example_failing, .example_passing");
      var getLogsLink = row.querySelector("a[href*='search']");
      return {
        status: example ? example.className.replace("example_", "") : "",
        time: row.querySelectorAll("td")[1]?.textContent?.trim() || "",
        logsUrl: getLogsLink ? getLogsLink.href : null,
      };
    },
  ),
);
