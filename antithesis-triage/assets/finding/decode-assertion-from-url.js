// Decodes the assertion details embedded in a log URL's get_logs_event_desc
// parameter. Set LOG_URL before evaluating, or omit to use the selected row's URL.
//
// Usage:
//   var LOG_URL = "https://demo.antithesis.com/search?...&get_logs_event_desc=...";
//   <this script>

(function () {
  var url = typeof LOG_URL !== "undefined" ? LOG_URL : null;

  if (!url) {
    var selectedRow = document.querySelector(".examples_table__row._selected");
    if (!selectedRow) {
      return JSON.stringify({ error: "No URL provided and no row selected" });
    }
    var link = selectedRow.querySelector("a[href*='search']");
    url = link ? link.href : null;
  }

  if (!url) {
    return JSON.stringify({ error: "No log URL found" });
  }

  try {
    var params = new URL(url).searchParams;
    var encoded = params.get("get_logs_event_desc");
    if (!encoded) {
      return JSON.stringify({ error: "No get_logs_event_desc parameter in URL" });
    }

    var b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    var decoded = atob(b64);
    var outer = JSON.parse(decoded);
    var jsonStart = outer.indexOf("{");
    if (jsonStart === -1) {
      return JSON.stringify({ error: "No JSON found in decoded value", raw: outer });
    }
    var parsed = JSON.parse(outer.substring(jsonStart));

    var a = parsed.antithesis_assert || {};
    return JSON.stringify({
      condition: a.condition,
      message: a.message,
      assertType: a.assert_type,
      displayType: a.display_type,
      details: a.details || null,
      id: a.id,
      hit: a.hit,
      mustHit: a.must_hit,
      location: a.location || null,
      eventGroup: parsed.event_group || null,
      source: parsed.source || null,
    });
  } catch (e) {
    return JSON.stringify({ error: "Failed to decode: " + e.message });
  }
})();
