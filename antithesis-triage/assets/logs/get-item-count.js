var counterText = (
  document.querySelector(".sequence_toolbar__items-counter")?.textContent || ""
).replace(/\s+/g, " ").trim();
var matches = Array.from(counterText.matchAll(/(\d[\d,]*)\s*items?\b/gi));
matches.length ? matches[matches.length - 1][1] : "unknown";
