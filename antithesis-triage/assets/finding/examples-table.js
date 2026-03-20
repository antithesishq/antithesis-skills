(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function decodeAssertionFromUrl(url) {
    if (!url) return null;
    try {
      var params = new URL(url).searchParams;
      var encoded = params.get("get_logs_event_desc");
      if (!encoded) return null;
      // Handle URL-safe base64
      var b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      var decoded = atob(b64);
      // The decoded value is a JSON string containing a log line with embedded JSON.
      // Format: "[  30.884] [  finally_validation] [   ]  - {\"antithesis_assert\":{...}}"
      var outer = JSON.parse(decoded);
      var jsonStart = outer.indexOf("{");
      if (jsonStart === -1) return null;
      var jsonStr = outer.substring(jsonStart);
      return JSON.parse(jsonStr);
    } catch (e) {
      return null;
    }
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

      // Decode assertion details from the log URL
      var assertionRaw = decodeAssertionFromUrl(logsUrl);
      var assertion = null;
      if (assertionRaw && assertionRaw.antithesis_assert) {
        var a = assertionRaw.antithesis_assert;
        assertion = {
          condition: a.condition,
          message: a.message,
          assertType: a.assert_type,
          details: a.details || null,
          id: a.id,
          location: a.location || null,
          hit: a.hit,
        };
      }

      return {
        index: index,
        status: status,
        time: time,
        artifacts: artifactCell,
        logsUrl: logsUrl,
        isSelected: isSelected,
        assertion: assertion,
      };
    }),
  );
})();
