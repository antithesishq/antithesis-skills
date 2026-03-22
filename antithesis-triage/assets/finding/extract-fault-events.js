// Extracts fault injection events and key validation events from
// all visible log entries on the current finding page.
// Useful for correlating faults with assertion failures.
//
// Note: only reads events currently rendered in the virtual scroll viewport
// (~50-70 rows). If totalItems >> visibleCount, use filter-inline-logs.js
// to narrow the log set before running this script.

(function () {
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
    var result = str.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
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
    result = result.replace(/:([a-zA-Z_]\w*)([,}\]])/g, ':"$1"$2');
    return result;
  }

  function parseFaultJson(text) {
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

  var faultEvents = [];
  var validationEvents = [];

  events.forEach(function (ev) {
    var text = extractOutput(ev);
    var source = lastText(ev.querySelector(".event__source_name"));
    var vtime = lastText(ev.querySelector(".event__vtime"));

    var isFault =
      source.includes("fault_injector") ||
      text.includes('"type":"network"') ||
      text.includes("type:network") ||
      text.includes('"type":"node"') ||
      text.includes("type:node") ||
      text.includes('"type":"clock"') ||
      text.includes("type:clock") ||
      text.includes("name:kill") ||
      text.includes("name:partition") ||
      text.includes("name:clog") ||
      text.includes("name:restore") ||
      text.includes("name:stop") ||
      text.includes("name:pause");

    var isValidation =
      text.includes("Broke watch guarantee") ||
      text.includes("Watch validation") ||
      text.includes("Linearization") ||
      text.includes("validation failed") ||
      text.includes("validation success") ||
      text.includes("Assertion Always") ||
      text.includes("Assertion Sometimes") ||
      text.includes("Assertion Reachable") ||
      text.includes("finally_validation") ||
      text.includes("container_exit_code");

    if (isFault) {
      var entry = { vtime: vtime, source: source, text: text };
      var parsed = parseFaultJson(text);
      if (parsed) {
        entry.fault = parsed;
      }
      faultEvents.push(entry);
    }
    if (isValidation) {
      validationEvents.push({
        vtime: vtime,
        source: source,
        text: text,
        highlighted: ev.classList.contains("_emphasized_blue"),
      });
    }
  });

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
    visibleCount: events.length,
    faultEvents: faultEvents,
    validationEvents: validationEvents,
  });
})();
