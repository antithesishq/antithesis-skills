var title = (document.querySelector(".branded_title")?.textContent || "").trim();
var metadataText = (
  document.querySelector(".branded_metadata")?.textContent || ""
).replace(/\s+/g, " ").trim();
var metadataMatch = metadataText.match(
  /^Conducted on\s+(.+?)(?:\s*Source:\s*(.+))?$/,
);

JSON.stringify({
  title: title,
  metadata: metadataText,
  conductedOn: metadataMatch ? metadataMatch[1].trim() : "",
  source: metadataMatch && metadataMatch[2] ? metadataMatch[2].trim() : "",
});
