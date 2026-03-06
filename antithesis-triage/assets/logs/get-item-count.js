var counterText = (
  document.querySelector(".sequence_toolbar__items-counter")?.textContent || ""
).replace(/\s+/g, " ").trim();
var match = counterText.match(/(\d[\d,]*)\s*items?/i);
match ? match[1] : "unknown";
