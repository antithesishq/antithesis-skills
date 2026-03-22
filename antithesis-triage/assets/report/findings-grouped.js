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

  return JSON.stringify(
    Array.from(document.querySelectorAll("details.findings_section_details"))
      .map(function (section) {
        var summary = (
          section.querySelector("summary")?.textContent || section.textContent || ""
        )
          .replace(/\s+/g, " ")
          .trim();
        var dateMatch = summary.match(
          /^[A-Z][a-z]{2} \d{2} [A-Z][a-z]{2,3} \d{2}:\d{2}/,
        );
        var date = dateMatch ? dateMatch[0] : "";

        var findings = Array.from(
          section.querySelectorAll(
            "a.w_fit.anchor_remove-style.w_full.justify_start",
          ),
        )
          .map(function (a) {
            var text = a.textContent
              .replace(/\s+/g, " ")
              .replace(/Look into this finding$/, "")
              .trim();
            var match = text.match(/^(new|resolved|rare\??)\s*(.+)$/i);
            if (!match) return null;
            return {
              status: match[1].replace(/\?$/, "").toLowerCase(),
              property: match[2].trim(),
            };
          })
          .filter(Boolean);

        return { date: date, findings: findings };
      })
      .filter(function (group) {
        return group.date && group.findings.length > 0;
      }),
  );
})();
