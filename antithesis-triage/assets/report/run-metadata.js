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

  var title = (document.querySelector(".branded_title")?.textContent || "").trim();
  var metadataText = (
    document.querySelector(".branded_metadata")?.textContent || ""
  ).replace(/\s+/g, " ").trim();
  var metadataMatch = metadataText.match(
    /^Conducted on\s+(.+?)(?:\s*Source:\s*(.+))?$/,
  );

  return JSON.stringify({
    title: title,
    metadata: metadataText,
    conductedOn: metadataMatch ? metadataMatch[1].trim() : "",
    source: metadataMatch && metadataMatch[2] ? metadataMatch[2].trim() : "",
  });
})();
