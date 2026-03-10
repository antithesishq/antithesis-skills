(function () {
  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function hasLoadingText(text) {
    return /\bLoading(?:\.\.\.)?\b/i.test(text || "");
  }

  function findSectionByHeading(heading) {
    return Array.from(document.querySelectorAll("section")).find(function (section) {
      return clean(section.querySelector("h1, h2, h3, h4, h5, h6")?.textContent) === heading;
    });
  }

  function sectionInfo(section) {
    return {
      exists: !!section,
      text: clean(section?.textContent),
      hasLoadingText: hasLoadingText(section?.textContent),
    };
  }

  var environmentSection = findSectionByHeading("Environment");
  var utilizationSection = findSectionByHeading("Utilization");
  var propertiesSection = document.querySelector(
    "section.section_properties:not(.section_findings)",
  );
  var findingsSection = document.querySelector("section.section_findings");
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
  var findingsText = clean(findingsSection?.textContent);

  return JSON.stringify(
    {
      title: title,
      metadata: metadata,
      readyState: document.readyState,
      environmentImages: environmentImages,
      utilizationMetric: utilizationMetric,
      propertyTabs: propertyTabs,
      propertyContainers: propertyContainers,
      findingsDetails: findingsSection?.querySelectorAll("details.findings_section_details")
        .length,
      findingLinks: findingsSection?.querySelectorAll(
        'a[href*="/finding/"], a[href*="/findings/"]',
      ).length,
      findingToggles: findingsSection?.querySelectorAll(
        'input[name="include_manual"], input[name="show_ongoing"]',
      ).length,
      findingsText: findingsText,
      sections: {
        environment: sectionInfo(environmentSection),
        utilization: sectionInfo(utilizationSection),
        properties: sectionInfo(propertiesSection),
        findings: sectionInfo(findingsSection),
      },
    },
    null,
    2,
  );
})();
