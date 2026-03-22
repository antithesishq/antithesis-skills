(function () {
  if (!/^\/report\//.test(window.location.pathname)) {
    return JSON.stringify({ error: "expected main report view", url: window.location.href });
  }

  if (/\/findings?\//.test(window.location.hash)) {
    return JSON.stringify({
      error: "expected main report view, not finding hash route",
      url: window.location.href,
    });
  }

  var metric = document.querySelector(".utilization-summary__metric");
  return metric ? metric.textContent.trim() : "no data";
})();
