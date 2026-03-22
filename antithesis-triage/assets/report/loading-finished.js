(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;

    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    var style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function hasLoadingText(text) {
    return /loading(?:\.\.\.)?/i.test(text || "");
  }

  function findSectionByHeading(heading) {
    return Array.from(document.querySelectorAll("section")).find(function (section) {
      return clean(section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent) === heading;
    });
  }

  function visibleCount(selector) {
    return Array.from(document.querySelectorAll(selector)).filter(isVisible).length;
  }

  function sectionLooksLoaded(section) {
    if (!section || !isVisible(section)) return false;

    var text = clean(section.textContent);
    return !!(text && !hasLoadingText(text));
  }

  var titleEl = document.querySelector(".branded_title");
  var metadataEl = document.querySelector(".branded_metadata");
  var title = clean(titleEl?.textContent);
  var metadata = clean(metadataEl?.textContent);
  var environmentSection = findSectionByHeading("Environment");
  var utilizationSection = findSectionByHeading("Utilization");
  var propertiesSection = document.querySelector(
    "section.section_properties:not(.section_findings)",
  );
  var environmentImages = visibleCount(".presentation_environment__source_image");
  var utilizationMetric = clean(
    document.querySelector(".utilization-summary__metric")?.textContent,
  );
  var propertyTabs = visibleCount("a-tab");
  var propertyContainers = visibleCount(".property-container");
  var propertiesText = clean(propertiesSection?.textContent);
  var findingsSection = document.querySelector("section.section_findings");
  var findingsText = clean(findingsSection?.textContent);
  var findingsDetails = findingsSection && isVisible(findingsSection)
    ? findingsSection.querySelectorAll(
    "details.findings_section_details",
  ).length
    : 0;
  var findingLinks = findingsSection && isVisible(findingsSection)
    ? findingsSection.querySelectorAll(
    'a[href*="/finding/"], a[href*="/findings/"]',
  ).length
    : 0;
  var findingToggles = findingsSection && isVisible(findingsSection)
    ? findingsSection.querySelectorAll(
    'input[name="include_manual"], input[name="show_ongoing"]',
  ).length
    : 0;
  var findingsLoadedText =
    /no findings|show suppressions|show ongoing findings|open triage report for this run|look into all findings/i.test(
      findingsText,
    );
  var environmentLoaded = !!(
    environmentImages > 0 || sectionLooksLoaded(environmentSection)
  );
  var utilizationLoaded = !!(
    utilizationMetric || sectionLooksLoaded(utilizationSection)
  );
  var propertiesLoaded = !!(
    propertiesSection &&
    isVisible(propertiesSection) &&
    propertyTabs >= 2 &&
    propertyContainers > 0 &&
    !hasLoadingText(propertiesText)
  );
  var findingsLoaded =
    !!findingsSection &&
    isVisible(findingsSection) &&
    !hasLoadingText(findingsText) &&
    (findingsDetails > 0 ||
      findingLinks > 0 ||
      findingToggles >= 2 ||
      findingsLoadedText);

  return !!(
    isVisible(titleEl) &&
    isVisible(metadataEl) &&
    title &&
    metadata &&
    environmentLoaded &&
    utilizationLoaded &&
    propertiesLoaded &&
    findingsLoaded
  );
})();
