(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  var title = clean(document.querySelector(".branded_title")?.textContent);
  var metadata = clean(document.querySelector(".branded_metadata")?.textContent);
  var environmentImages = document.querySelectorAll(
    ".presentation_environment__source_image",
  ).length;
  var utilizationMetric = clean(
    document.querySelector(".utilization-summary__metric")?.textContent,
  );
  var propertyTabs = document.querySelectorAll("a-tab").length;
  var propertyContainers = document.querySelectorAll(".property-container").length;
  var findingsSection = document.querySelector("section.section_findings");
  var findingsText = clean(findingsSection?.textContent);
  var findingsLoaded =
    !!findingsSection &&
    !/Loading\.\.\./.test(findingsText) &&
    (document.querySelectorAll("details.findings_section_details").length > 0 ||
      /Show suppressions|Show ongoing findings|Open triage report for this run/.test(
        findingsText,
      ));

  return !!(
    title &&
    metadata &&
    environmentImages > 0 &&
    utilizationMetric &&
    propertyTabs >= 4 &&
    propertyContainers > 0 &&
    findingsLoaded
  );
})();
