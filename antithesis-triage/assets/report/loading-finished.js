(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function hasLoadingText(text) {
    return /loading(?:\.\.\.)?/i.test(text || "");
  }

  function findSectionByHeading(heading) {
    return Array.from(document.querySelectorAll("section")).find(function (section) {
      return clean(section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent) === heading;
    });
  }

  var title = clean(document.querySelector(".branded_title")?.textContent);
  var metadata = clean(document.querySelector(".branded_metadata")?.textContent);
  var environmentSection = findSectionByHeading("Environment");
  var utilizationSection = findSectionByHeading("Utilization");
  var propertiesSection = document.querySelector(
    "section.section_properties:not(.section_findings)",
  );
  var environmentImages = document.querySelectorAll(
    ".presentation_environment__source_image",
  ).length;
  var utilizationMetric = clean(
    document.querySelector(".utilization-summary__metric")?.textContent,
  );
  var propertyTabs = document.querySelectorAll("a-tab").length;
  var propertyContainers = document.querySelectorAll(".property-container").length;
  var propertiesText = clean(propertiesSection?.textContent);
  var findingsSection = document.querySelector("section.section_findings");
  var findingsText = clean(findingsSection?.textContent);
  var findingsDetails = findingsSection?.querySelectorAll(
    "details.findings_section_details",
  ).length;
  var findingLinks = findingsSection?.querySelectorAll(
    'a[href*="/finding/"], a[href*="/findings/"]',
  ).length;
  var findingToggles = findingsSection?.querySelectorAll(
    'input[name="include_manual"], input[name="show_ongoing"]',
  ).length;
  var findingsLoadedText =
    /no findings|show suppressions|show ongoing findings|open triage report for this run|look into all findings/i.test(
      findingsText,
    );
  var environmentLoaded = !!(
    environmentImages > 0 ||
    (environmentSection &&
      clean(environmentSection.textContent) &&
      !hasLoadingText(environmentSection.textContent))
  );
  var utilizationLoaded = !!(
    utilizationMetric ||
    (utilizationSection &&
      clean(utilizationSection.textContent) &&
      !hasLoadingText(utilizationSection.textContent))
  );
  var propertiesLoaded = !!(
    propertyTabs >= 2 &&
    propertyContainers > 0 &&
    !hasLoadingText(propertiesText)
  );
  var findingsLoaded =
    !!findingsSection &&
    !hasLoadingText(findingsText) &&
    (findingsDetails > 0 ||
      findingLinks > 0 ||
      findingToggles >= 2 ||
      findingsLoadedText);

  return !!(
    title &&
    metadata &&
    environmentLoaded &&
    utilizationLoaded &&
    propertiesLoaded &&
    findingsLoaded
  );
})();
