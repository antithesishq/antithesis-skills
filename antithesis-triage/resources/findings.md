# Findings

The Findings section shows a history of test runs, which essentially presents a diff of your software's behavior from one run to the next.

Findings are contained by `section.section_findings`.

Run this expression on a triage report to retrieve the findings grouped by date:

```js
Array.from(document.querySelectorAll("details.findings_section_details"))
  .map(function (section) {
    var summaryText = section.textContent.replace(/\s+/g, " ").trim();
    var dateMatch = summaryText.match(
      /^[A-Z][a-z]{2} \d{2} [A-Z][a-z]{2} \d{2}:\d{2}/,
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

        var m = text.match(/^(new|resolved|rare\??)\s*(.+)$/i);
        return m
          ? {
              status: m[1].replace(/\?$/, "").toLowerCase(),
              property: m[2].trim(),
            }
          : null;
      })
      .filter(Boolean);

    return { date: date, findings: findings };
  })
  .filter(function (group) {
    return group.date && group.findings.length > 0;
  });
```
