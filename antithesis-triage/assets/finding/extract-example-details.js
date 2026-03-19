// Extracts structured assertion details from the currently selected example.
// Reads from the Details panel (first child of .example__content) which contains
// the assertion data in Antithesis unquoted-key JSON format.

(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  var selectedRow = document.querySelector(".examples_table__row._selected");
  if (!selectedRow) {
    return JSON.stringify({ error: "No example row is selected" });
  }

  var status = clean(selectedRow.querySelectorAll("td")[0]?.textContent);
  var time = clean(selectedRow.querySelectorAll("td")[1]?.textContent);

  // The example__content div has three children:
  //   [0] = Details panel (assertion data)
  //   [1] = Logs panel (log viewer)
  //   [2] = Artifacts panel
  var content = document.querySelector(".example__content");
  if (!content || !content.children[0]) {
    return JSON.stringify({ error: "Details panel not found" });
  }

  var detailsText = clean(content.children[0].textContent);

  // Try to parse the Antithesis unquoted-key JSON
  var parsed = null;
  try {
    // The text is like: {antithesis_assert:{...},event_group:"...",source:{...}}
    // Convert unquoted keys to quoted keys for JSON.parse
    var jsonStr = detailsText
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
      .replace(/:(\w+)([,}])/g, function (m, val, end) {
        if (val === "true" || val === "false" || val === "null" || /^\d+$/.test(val)) {
          return ":" + val + end;
        }
        return ':"' + val + '"' + end;
      });
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    // Parsing failed; raw text is still available
  }

  var assertion = null;
  if (parsed && parsed.antithesis_assert) {
    var a = parsed.antithesis_assert;
    assertion = {
      condition: a.condition,
      message: a.message,
      assertType: a.assert_type,
      displayType: a.display_type,
      details: a.details || null,
      id: a.id,
      hit: a.hit,
      mustHit: a.must_hit,
      location: a.location || null,
    };
  }

  return JSON.stringify({
    status: status,
    time: time,
    raw: detailsText,
    assertion: assertion,
    source: parsed ? parsed.source : null,
    eventGroup: parsed ? parsed.event_group : null,
  });
})();
