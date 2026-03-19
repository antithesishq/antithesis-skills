// Reads all currently visible events from the inline log viewer.
// Unlike read-visible-events.js, this reads ALL rendered events (no cap).
// Set PARSE_FAULTS = true to extract structured fault data.
//
// Usage:
//   var PARSE_FAULTS = true;
//   <this script>

(function () {
  var parseFaults =
    typeof PARSE_FAULTS !== "undefined" ? PARSE_FAULTS : false;

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function lastTextNode(el) {
    if (!el) return "";
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === Node.TEXT_NODE && clean(nodes[i].textContent)) {
        return clean(nodes[i].textContent);
      }
    }
    return "";
  }

  function firstTextNode(el) {
    if (!el) return "";
    var nodes = el.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeType === Node.TEXT_NODE && clean(nodes[i].textContent)) {
        return clean(nodes[i].textContent);
      }
    }
    return "";
  }

  function lastText(el) {
    var direct = lastTextNode(el);
    if (direct) return direct;
    return clean(el?.textContent || "");
  }

  function extractOutput(ev) {
    var assertion = ev.querySelector(".sdk-assertion__meta");
    if (assertion) return clean(assertion.textContent);

    var varying = ev.querySelector(".event__varying-part");
    if (varying) {
      var direct = firstTextNode(varying);
      if (direct) return direct;
    }

    var output = ev.querySelector(".event__varying-part .event__output_text");
    var last = lastTextNode(output);
    if (last) return last;

    var fallback = clean(output?.textContent || "");
    fallback = fallback.replace(/^event\.output_text\s*/i, "");
    if (fallback) return fallback;

    if (varying) {
      var text = clean(varying.innerText || "");
      return text.replace(/event\.output_text\s*/gi, "").trim();
    }

    return "";
  }

  function toValidJson(str) {
    // Quote unquoted keys: {key: → {"key":
    var result = str.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
    // Quote unquoted string values in arrays: [ALL] → ["ALL"]
    result = result.replace(/\[([^\[\]]*)\]/g, function (m, inner) {
      if (!inner.trim()) return m;
      var items = inner.split(",").map(function (s) {
        s = s.trim();
        if (
          /^"/.test(s) ||
          /^-?\d/.test(s) ||
          s === "true" ||
          s === "false" ||
          s === "null"
        ) {
          return s;
        }
        return '"' + s + '"';
      });
      return "[" + items.join(",") + "]";
    });
    // Quote unquoted string values after colons: :Jammed, → :"Jammed",
    result = result.replace(/:([a-zA-Z_]\w*)([,}\]])/g, ':"$1"$2');
    return result;
  }

  function parseFaultJson(text) {
    // Match the outer {fault:{...}} or just {fault:...}
    var match = text.match(/\{fault:\{[\s\S]*\}$/);
    if (!match) return null;

    try {
      var parsed = JSON.parse(toValidJson(match[0]));
      return parsed.fault || parsed;
    } catch (e) {
      return null;
    }
  }

  // Scope to the visible panel inside .example__content to avoid
  // picking up .event elements from other page areas or hidden panels.
  var scope = document.querySelector(".example__content");
  if (scope) {
    var panels = scope.children;
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].offsetHeight > 0) {
        scope = panels[i];
        break;
      }
    }
  } else {
    scope = document;
  }

  var events = Array.from(scope.querySelectorAll(".event"));

  var result = events.map(function (ev) {
    var text = extractOutput(ev);
    var entry = {
      vtime: lastText(ev.querySelector(".event__vtime")),
      source: lastText(ev.querySelector(".event__source_name")),
      text: text,
      highlighted: ev.classList.contains("_emphasized_blue"),
    };

    if (parseFaults && text.includes("fault:")) {
      var parsed = parseFaultJson(text);
      if (parsed) {
        entry.fault = parsed;
      }
    }

    return entry;
  });

  // Read from the visible counter only
  var counterText = "";
  var allCounters = document.querySelectorAll(".sequence_toolbar__items-counter");
  for (var ci = 0; ci < allCounters.length; ci++) {
    if (allCounters[ci].offsetHeight > 0) {
      counterText = clean(allCounters[ci].textContent);
      break;
    }
  }
  var countMatch = counterText.match(/(\d[\d,]*)\s*items?\b/i);

  return JSON.stringify({
    totalItems: countMatch ? countMatch[1] : "unknown",
    visibleCount: result.length,
    events: result,
  });
})();
