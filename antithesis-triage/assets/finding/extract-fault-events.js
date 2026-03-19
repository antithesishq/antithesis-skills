// Extracts fault injection events and key validation events from
// all visible log entries on the current finding page.
// Useful for correlating faults with assertion failures.

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

  var events = Array.from(document.querySelectorAll(".event"));

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
      faultEvents.push({ vtime: vtime, source: source, text: text });
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

  return JSON.stringify({
    faultEvents: faultEvents,
    validationEvents: validationEvents,
  });
})();
