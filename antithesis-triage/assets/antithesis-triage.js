(function () {
  var VERSION = "3.0.0";

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function abort(details) {
    var msg =
      typeof details === "string"
        ? details
        : (details && details.error) || JSON.stringify(details);
    var err = new Error(msg);
    err.details = details;
    throw err;
  }

  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;

    var rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    var style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function click(el) {
    if (!el) return false;

    ["pointerdown", "mousedown", "mouseup", "click"].forEach(function (type) {
      el.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
        }),
      );
    });

    return true;
  }

  function ownText(el) {
    if (!el) return "";

    // Tooltip-heavy cells often mix labels and nested metadata; keep only direct text.
    return clean(
      Array.from(el.childNodes)
        .filter(function (node) {
          return node.nodeType === Node.TEXT_NODE;
        })
        .map(function (node) {
          return node.textContent;
        })
        .join(" "),
    );
  }

  function lastTextNode(el) {
    if (!el) return "";

    // Log rows append the visible value as the last text node after tooltip elements.
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === Node.TEXT_NODE && clean(nodes[i].textContent)) {
        return clean(nodes[i].textContent);
      }
    }

    return "";
  }

  function lastText(el) {
    var direct = lastTextNode(el);
    if (direct) return direct;
    // Only fall back to full textContent when no child elements exist;
    // otherwise the tooltip label (e.g. "event.container") leaks through.
    if (el && !el.querySelector("*")) return clean(el.textContent);
    return "";
  }

  function parseItemCount(text) {
    var matches = Array.from((text || "").matchAll(/(\d[\d,]*)\s*items?\b/gi));
    return matches.length
      ? Number(matches[matches.length - 1][1].replace(/,/g, ""))
      : null;
  }

  function hasLoadingText(text) {
    return /loading(?:\.\.\.)?/i.test(text || "");
  }

  // ---------------------------------------------------------------------------
  // Error detection
  // ---------------------------------------------------------------------------

  function detectSetupError() {
    // Setup-failure reports replace the normal Properties / Findings / Utilization
    // sections with a single "Error" section whose heading is an <h3>.
    var sections = document.querySelectorAll(".section_container.top_section");

    for (var i = 0; i < sections.length; i++) {
      var heading = sections[i].querySelector("h3");
      if (!heading || clean(heading.textContent) !== "Error") continue;

      var summary = sections[i].querySelector(".section_summary");
      var content = sections[i].querySelector(".section_content");

      // The validation error message lives in a <pre> inside the content area.
      // Fall back to the full section text (trimmed) if no <pre> is found.
      var pre = content && content.querySelector("pre");
      var details = clean(
        pre ? pre.textContent : content && content.textContent,
      );

      return {
        type: "setup_error",
        summary: clean(summary && summary.textContent),
        details: details.length > 2000 ? details.substring(0, 2000) : details,
      };
    }

    return null;
  }

  function detectRuntimeError() {
    // Runtime errors render a prominent banner at the top of the page using the
    // GeneralErrorNew component.  The rest of the report may partially load but
    // one or more sections (typically Findings) will be stuck on "Loading...".
    var el = document.querySelector(".GeneralErrorNew");
    if (!el || !isVisible(el)) return null;

    var title = el.querySelector(".GeneralErrorNew__title");
    var text = el.querySelector(".GeneralErrorNew__text");
    var details = clean(text && text.textContent);

    return {
      type: "runtime_error",
      summary: clean(title && title.textContent) || "Error",
      details: details.length > 2000 ? details.substring(0, 2000) : details,
    };
  }

  function detectError() {
    return detectSetupError() || detectRuntimeError() || null;
  }

  function requireReportPage() {
    if (!/^\/report\//.test(window.location.pathname)) {
      abort({ error: "expected main report view", url: window.location.href });
    }

    if (/\/findings?\//.test(window.location.hash)) {
      abort({
        error: "expected main report view, not finding hash route",
        url: window.location.href,
      });
    }
  }

  function requireLogsPage() {
    if (
      window.location.pathname !== "/search" ||
      !/[?&]get_logs=true\b/.test(window.location.search)
    ) {
      abort({
        error: "expected selected-event logs view",
        url: window.location.href,
      });
    }
  }

  function requireRunsPage() {
    if (window.location.pathname !== "/runs") {
      abort({ error: "expected runs page", url: window.location.href });
    }
  }

  function findSectionByHeading(heading) {
    return Array.from(document.querySelectorAll("section")).find(
      function (section) {
        var h = section.querySelector("h1, h2, h3, h4, h5, h6");
        return clean(h && h.textContent) === heading;
      },
    );
  }

  function visibleCount(selector) {
    return Array.from(document.querySelectorAll(selector)).filter(isVisible)
      .length;
  }

  function sectionInfo(section) {
    return {
      exists: !!section,
      text: clean(section && section.textContent),
      hasLoadingText: hasLoadingText(section && section.textContent),
    };
  }

  function sectionLooksLoaded(section) {
    if (!section || !isVisible(section)) return false;

    var text = clean(section.textContent);
    return !!(text && !hasLoadingText(text));
  }

  function allPropertyContainers() {
    return Array.from(document.querySelectorAll(".property-container"));
  }

  function visiblePropertyContainers() {
    return allPropertyContainers().filter(isVisible);
  }

  function stateFromStatus(el) {
    var classes = el ? el.className : "";
    return classes.includes("_passed")
      ? "passed"
      : classes.includes("_failed")
        ? "failed"
        : classes.includes("_unfound")
          ? "unfound"
          : "unknown";
  }

  function containerStatus(container) {
    return stateFromStatus(
      container.querySelector(":scope > .property .property__status"),
    );
  }

  function nameOf(container) {
    var label = container.querySelector(
      ":scope > .property .property__name_label",
    );
    return clean(label && label.textContent);
  }

  function directChildren(container) {
    return container.querySelectorAll(
      ":scope > .property__details > .property-container",
    ).length;
  }

  function isLeaf(container) {
    return directChildren(container) === 0;
  }

  function isGroup(container) {
    return directChildren(container) > 0;
  }

  function isExpanded(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._expanded, :scope > .property__details._unfolded",
    );
  }

  function expanderButton(container) {
    return container.querySelector(
      ":scope > .property .property__expander-button",
    );
  }

  function groupPath(container) {
    var path = [];
    var parent = container.parentElement
      ? container.parentElement.closest(".property-container")
      : null;

    while (parent) {
      var name = nameOf(parent);
      if (name) path.unshift(name);
      parent = parent.parentElement
        ? parent.parentElement.closest(".property-container")
        : null;
    }

    return path;
  }

  function tabLabelText(tab) {
    return clean(tab && tab.textContent).toLowerCase();
  }

  function tabByPattern(pattern) {
    return Array.from(document.querySelectorAll("a-tab")).find(function (tab) {
      return pattern.test(tabLabelText(tab));
    });
  }

  function countFromTab(tab) {
    var match = tabLabelText(tab).match(/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function waitForReady(checkFn, detailsFn, options) {
    var timeoutMs =
      options && typeof options.timeoutMs === "number"
        ? options.timeoutMs
        : 60000;
    var intervalMs =
      options && typeof options.intervalMs === "number"
        ? options.intervalMs
        : 1000;
    var startedAt = Date.now();
    var deadline = startedAt + timeoutMs;
    var attempts = 0;

    while (Date.now() <= deadline) {
      attempts += 1;

      if (checkFn()) {
        return {
          attempts: attempts,
          waitedMs: Date.now() - startedAt,
        };
      }

      if (Date.now() + intervalMs > deadline) break;
      await wait(intervalMs);
    }

    abort({
      error: "timed out waiting for page to be ready",
      attempts: attempts,
      waitedMs: Date.now() - startedAt,
      details: detailsFn ? detailsFn() : null,
    });
  }

  async function expandAllFindings() {
    var sections = Array.from(
      document.querySelectorAll("details.findings_section_details"),
    );
    var opened = 0;
    sections.forEach(function (section) {
      if (!section.open) {
        section.open = true;
        opened++;
      }
    });
    if (opened > 0) await wait(300);
  }

  async function expandAllSections() {
    var settleMs = 300;
    var maxPasses = 10;

    for (var pass = 0; pass < maxPasses; pass++) {
      var collapsed = Array.from(
        document.querySelectorAll(".section_container"),
      ).filter(function (sc) {
        var expander = sc.querySelector(
          ":scope > .section_header .expander.section_expander",
        );
        return expander && !expander.classList.contains("_expanded");
      });

      if (collapsed.length === 0) break;

      for (var i = 0; i < collapsed.length; i++) {
        var btn = collapsed[i].querySelector(
          ":scope > .section_header .section_title_button",
        );
        if (btn) click(btn);
      }

      await wait(settleMs);
    }
  }

  async function expandAllProperties() {
    requireReportPage();

    // Expand all property containers in up to 32 passes (groups and leaves).
    for (var i = 0; i < 32; i++) {
      var changed = false;

      document
        .querySelectorAll(".property__expander-button")
        .forEach(function (btn) {
          var container = btn.closest(".property-container");
          if (!container || !isVisible(container) || isExpanded(container))
            return;
          if (click(btn)) changed = true;
        });

      if (!changed) break;
      await wait(250);
    }
  }

  function exampleCounts(container) {
    var text = clean(container.textContent);
    var match = text.match(
      /([\d,]+)\s+passing\s+example.*?([\d,]+)\s+failing\s+example/,
    );
    if (!match) return { passingCount: null, failingCount: null };
    return { passingCount: match[1], failingCount: match[2] };
  }

  // Assumes leaf properties are already expanded (waitForReady expands all
  // sections and properties on load). Pass/fail example counts are only
  // present in the DOM after expansion.
  function visibleLeafProperties(filterStatus) {
    return visiblePropertyContainers()
      .filter(function (container) {
        if (!isLeaf(container) || !nameOf(container)) return false;
        return !filterStatus || containerStatus(container) === filterStatus;
      })
      .map(function (container) {
        var counts = exampleCounts(container);
        return {
          group: groupPath(container),
          name: nameOf(container),
          status: containerStatus(container),
          passingCount: counts.passingCount,
          failingCount: counts.failingCount,
        };
      });
  }

  function exampleRowElements(container) {
    return container.querySelectorAll(
      ":scope > .property__details .examples_table__row",
    );
  }

  function examplesRows(container) {
    return exampleRowElements(container).length;
  }

  function cleanLogOutput(text) {
    return clean(text).replace(/^event\.output_text\s*/i, "");
  }

  function extractLogOutput(varyingPart) {
    var output =
      varyingPart && varyingPart.querySelector(".event__output_text");
    var direct = cleanLogOutput(lastTextNode(output));
    if (direct) return direct;
    return cleanLogOutput(output && output.textContent);
  }

  function extractLogDirectText(varyingPart) {
    return clean(
      Array.from((varyingPart && varyingPart.childNodes) || [])
        .filter(function (node) {
          return node.nodeType === Node.TEXT_NODE;
        })
        .map(function (node) {
          return node.textContent;
        })
        .join(" "),
    );
  }

  function extractLogDetails(ev) {
    // Assertion rows and regular log rows render their useful text differently.
    var assertion = ev.querySelector(".sdk-assertion__meta");
    var assertionText = clean(assertion && assertion.textContent);
    if (assertionText) {
      return {
        assertionText: assertionText,
        directText: "",
        outputText: "",
        text: assertionText,
      };
    }

    var varyingPart = ev.querySelector(".event__varying-part");
    var directText = extractLogDirectText(varyingPart);
    var outputText = extractLogOutput(varyingPart);
    var text = outputText || directText;

    if (directText && outputText && directText !== outputText) {
      text = directText + " | " + outputText;
    }

    return {
      assertionText: "",
      directText: directText,
      outputText: outputText,
      text: text,
    };
  }

  function serializeLogEvent(ev) {
    var details = extractLogDetails(ev);

    return {
      vtime: lastText(ev.querySelector(".event__vtime")),
      container: lastText(ev.querySelector(".event__container")),
      source: lastText(ev.querySelector(".event__source_name")),
      text: details.text,
      directText: details.directText,
      outputText: details.outputText,
      highlighted:
        ev.classList.contains("_emphasized_blue") ||
        ev.classList.contains("_emphasized"),
    };
  }

  function errorSection() {
    return findSectionByHeading("Error");
  }

  function inlineErrorLogWrappers() {
    var section = errorSection();
    if (!section) return [];

    return Array.from(
      section.querySelectorAll(".sequence_printer_wrapper"),
    ).filter(isVisible);
  }

  function requireInlineErrorLogs() {
    requireReportPage();

    var err = detectError();
    if (!err) {
      abort({
        error: "expected error report with inline logs",
        url: window.location.href,
      });
    }

    var wrappers = inlineErrorLogWrappers();
    if (!wrappers.length) {
      abort({
        error: "no inline error log panes found",
        errorType: err.type,
        url: window.location.href,
      });
    }
  }

  function inlineErrorLogViews() {
    return inlineErrorLogWrappers().map(function (wrapper, index) {
      var counterEl = wrapper.querySelector(".sequence_toolbar__items-counter");
      var counterText = clean(counterEl && counterEl.textContent);
      var events = Array.from(wrapper.querySelectorAll(".event"));
      var firstEvent = events.length ? serializeLogEvent(events[0]) : null;

      return {
        index: index,
        itemCount: parseItemCount(counterText),
        visibleEvents: events.filter(isVisible).length,
        firstEvent: firstEvent,
      };
    });
  }

  function tooltipMap(tooltip) {
    if (!tooltip) return {};

    // Runs-page tooltips reuse a few DOM layouts; normalize them into key/value maps.
    var out = {};
    var rows = Array.from(tooltip.children);

    if (rows.length === 1 && rows[0].children.length) {
      rows = Array.from(rows[0].children);
    }

    rows.forEach(function (row) {
      var keyEl =
        row.querySelector(".runs_table_muted_tooltip_text") ||
        row.querySelector(".runs_table_name_column_tooltip_key");
      var valueEl = row.querySelector(".runs_table_tooltip_text");
      var key = clean(keyEl && keyEl.textContent).replace(/:$/, "");
      var value = clean(
        valueEl
          ? valueEl.textContent
          : clean(row.textContent).replace(
              clean(keyEl && keyEl.textContent),
              "",
            ),
      );
      var parsed = clean(row.textContent).match(/^([^:]+):\s*(.*)$/);

      if (!key && parsed) key = clean(parsed[1]);
      if (!value && parsed) value = clean(parsed[2]);
      if (key) out[key] = value;
    });

    return out;
  }

  function pairMap(container) {
    if (!container) return {};

    // Utilization cells render as alternating key/value spans.
    var spans = Array.from(container.querySelectorAll("span"));
    var out = {};
    for (var i = 0; i + 1 < spans.length; i += 2) {
      var key = clean(spans[i].textContent).replace(/:$/, "");
      var value = clean(spans[i + 1].textContent);
      if (key) out[key] = value;
    }
    return out;
  }

  function findingsMap(container) {
    if (!container) return {};

    // Findings cells collapse badge text into single spans like "3 new".
    var out = {};
    Array.from(container.querySelectorAll("span")).forEach(function (span) {
      var match = clean(span.textContent).match(/^(\S+)\s+(.+)$/);
      if (match) out[match[2].toLowerCase()] = match[1];
    });
    return out;
  }

  function actionUrl(cell, label) {
    var link = Array.from(cell.querySelectorAll("a")).find(function (anchor) {
      return clean(anchor.textContent) === label;
    });
    return link ? link.href : null;
  }

  function parseRunRow(row) {
    var nameCell = row.querySelector('[cell-identifier="name"]');
    var creatorSource = row.querySelector('[cell-identifier="creator_source"]');
    var creatorName = row.querySelector('[cell-identifier="creator_name"]');
    var dateCell = row.querySelector('[cell-identifier="date"]');
    var timeCell = row.querySelector('[cell-identifier="time"]');
    var statusCell = row.querySelector('[cell-identifier="status"]');
    var durationCell = row.querySelector('[cell-identifier="duration"]');
    var findingsCell = row.querySelector(".runs_table_run_findings");
    var utilizationCell = row.querySelector(".runs_table_utilization");
    var actionCell = row.querySelector(
      "a-cell.table_left_most_right_pinned_col",
    );
    var nameTooltip = nameCell
      ? nameCell.closest("a-cell").querySelector("a-tooltip")
      : null;
    var creatorTooltip = creatorSource
      ? creatorSource.closest("a-cell").querySelector("a-tooltip")
      : null;
    var nameMeta = tooltipMap(nameTooltip);
    var creatorMeta = tooltipMap(creatorTooltip);

    var nameMutedEl =
      nameCell && nameCell.querySelector(".runs_table_muted_tooltip_text");
    var nameTooltipTextEl =
      nameCell && nameCell.querySelector(".runs_table_tooltip_text");

    return {
      name:
        nameMeta.Name ||
        clean(nameMutedEl && nameMutedEl.textContent) ||
        clean(nameCell && nameCell.textContent),
      description:
        nameMeta.Description ||
        clean(nameTooltipTextEl && nameTooltipTextEl.textContent),
      creatorSource: clean(creatorSource && creatorSource.textContent),
      creatorName:
        ownText(creatorName && creatorName.querySelector("div")) ||
        clean(creatorName && creatorName.textContent),
      creatorCategory: creatorMeta.Category || "",
      cadence: creatorMeta.Cadence || "",
      commit: creatorMeta["Commit hash"] || "",
      repository: creatorMeta.Repository || "",
      date: clean(dateCell && dateCell.textContent),
      time: clean(timeCell && timeCell.textContent),
      status: clean(statusCell && statusCell.textContent),
      duration: clean(durationCell && durationCell.textContent),
      findings: findingsMap(findingsCell),
      utilization: pairMap(utilizationCell),
      triageUrl: actionCell ? actionUrl(actionCell, "Triage results") : null,
      logsUrl: actionCell ? actionUrl(actionCell, "Explore Logs") : null,
      hasTriageResults: !!(
        actionCell && actionUrl(actionCell, "Triage results")
      ),
    };
  }

  function runKey(run) {
    // Prefer stable URLs; fall back to visible row content for in-progress runs.
    return (
      run.triageUrl ||
      run.logsUrl ||
      [run.name, run.description, run.date, run.time].join(" | ")
    );
  }

  function getAllProperties() {
    requireReportPage();

    var tab = tabByPattern(/\ball\b/);
    var properties = visibleLeafProperties();
    var counts = properties.reduce(function (acc, property) {
      acc[property.status] = (acc[property.status] || 0) + 1;
      return acc;
    }, {});

    return {
      expectedCount: countFromTab(tab),
      counts: counts,
      properties: properties,
    };
  }

  function parseExampleRow(row, index) {
    var example = row.querySelector(".example_failing, .example_passing");
    var timeCell = row.querySelectorAll("td")[1];

    return {
      index: index,
      status: example ? example.className.replace("example_", "") : "",
      time: timeCell && clean(timeCell.textContent),
    };
  }

  function examplesForContainer(container) {
    return Array.from(exampleRowElements(container)).map(function (row, i) {
      return parseExampleRow(row, i);
    });
  }

  function getExampleLogsUrl(propertyName, exampleIndex) {
    requireReportPage();

    var idx = typeof exampleIndex === "number" ? exampleIndex : 0;
    var containers = visiblePropertyContainers();
    var target = null;

    for (var i = 0; i < containers.length; i++) {
      var container = containers[i];
      if (isGroup(container)) continue;
      if (nameOf(container) === propertyName) {
        target = container;
        break;
      }
    }

    if (!target) {
      abort({ error: "property not found", propertyName: propertyName });
    }

    var rows = Array.from(exampleRowElements(target));

    if (idx < 0 || idx >= rows.length) {
      abort({
        error: "example index out of range",
        propertyName: propertyName,
        exampleIndex: idx,
        availableExamples: rows.length,
      });
    }

    var row = rows[idx];
    var link = row.querySelector("a[href*='search']");

    return {
      propertyName: propertyName,
      exampleIndex: idx,
      logsUrl: link ? link.href : null,
    };
  }

  function getPropertyExamples() {
    requireReportPage();

    var properties = visiblePropertyContainers()
      .filter(function (container) {
        return (
          !isGroup(container) &&
          nameOf(container) &&
          examplesRows(container) > 0
        );
      })
      .map(function (container) {
        return {
          group: groupPath(container),
          name: nameOf(container),
          status: containerStatus(container),
          examples: examplesForContainer(container),
        };
      });

    return {
      properties: properties,
      totalExamples: properties.reduce(function (sum, property) {
        return sum + property.examples.length;
      }, 0),
    };
  }

  var reportApi = {
    loadingFinished: function () {
      var titleEl = document.querySelector(".branded_title");
      var metadataEl = document.querySelector(".branded_metadata");
      var title = clean(titleEl && titleEl.textContent);
      var metadata = clean(metadataEl && metadataEl.textContent);

      // Error reports are "done loading" even though normal sections may be
      // missing or stuck.  Require at least the title to have rendered so the
      // runtime has something to extract.
      if (detectError() && isVisible(titleEl) && title) {
        return true;
      }

      var environmentSection = findSectionByHeading("Environment");
      var utilizationSection = findSectionByHeading("Utilization");
      var propertiesSection = document.querySelector(
        "section.section_properties:not(.section_findings)",
      );
      var environmentImages = visibleCount(
        ".presentation_environment__source_image",
      );
      var utilizationMetric = clean(
        document.querySelector(".utilization-summary__metric") &&
          document.querySelector(".utilization-summary__metric").textContent,
      );
      var propertyTabs = visibleCount("a-tab");
      var propertyContainers = visibleCount(".property-container");
      var propertiesText = clean(
        propertiesSection && propertiesSection.textContent,
      );
      var findingsSection = document.querySelector("section.section_findings");
      var findingsText = clean(findingsSection && findingsSection.textContent);
      var findingsDetails =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll("details.findings_section_details")
              .length
          : 0;
      var findingLinks =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll(
              'a[href*="/finding/"], a[href*="/findings/"]',
            ).length
          : 0;
      var findingToggles =
        findingsSection && isVisible(findingsSection)
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
    },

    sectionReadiness: function () {
      requireReportPage();

      var err = detectError();
      var environmentSection = findSectionByHeading("Environment");
      var utilizationSection = findSectionByHeading("Utilization");
      var propertiesSection = document.querySelector(
        "section.section_properties:not(.section_findings)",
      );
      var findingsSection = document.querySelector("section.section_findings");

      var environmentImages = visibleCount(
        ".presentation_environment__source_image",
      );
      var utilizationMetric = clean(
        document.querySelector(".utilization-summary__metric") &&
          document.querySelector(".utilization-summary__metric").textContent,
      );
      var propertyTabs = visibleCount("a-tab");
      var propertyContainers = visibleCount(".property-container");
      var propertiesText = clean(
        propertiesSection && propertiesSection.textContent,
      );
      var findingsText = clean(findingsSection && findingsSection.textContent);
      var findingsDetails =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll("details.findings_section_details")
              .length
          : 0;
      var findingLinks =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll(
              'a[href*="/finding/"], a[href*="/findings/"]',
            ).length
          : 0;
      var findingToggles =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll(
              'input[name="include_manual"], input[name="show_ongoing"]',
            ).length
          : 0;
      var findingsLoadedText =
        /no findings|show suppressions|show ongoing findings|open triage report for this run|look into all findings/i.test(
          findingsText,
        );

      function status(loaded, section) {
        if (loaded) return "ok";
        if (err && section && hasLoadingText(section.textContent))
          return "error";
        if (err) return "error";
        return "not_loaded";
      }

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

      return {
        environment: status(environmentLoaded, environmentSection),
        utilization: status(utilizationLoaded, utilizationSection),
        properties: status(propertiesLoaded, propertiesSection),
        findings: status(findingsLoaded, findingsSection),
      };
    },

    waitForReady: async function (options) {
      var result = await waitForReady(
        function () {
          return reportApi.loadingFinished();
        },
        function () {
          return reportApi.loadingStatus();
        },
        options,
      );

      var err = detectError();
      if (err) result.error = err;

      // Per-section status so agents know which methods will work.
      var sectionStatus = reportApi.sectionReadiness();
      result.sections = sectionStatus;

      await expandAllSections();
      if (sectionStatus.properties === "ok") await expandAllProperties();
      if (sectionStatus.findings === "ok") await expandAllFindings();
      return result;
    },

    loadingStatus: function () {
      requireReportPage();

      var environmentSection = findSectionByHeading("Environment");
      var utilizationSection = findSectionByHeading("Utilization");
      var propertiesSection = document.querySelector(
        "section.section_properties:not(.section_findings)",
      );
      var findingsSection = document.querySelector("section.section_findings");
      var titleEl = document.querySelector(".branded_title");
      var metadataEl = document.querySelector(".branded_metadata");
      var metricEl = document.querySelector(".utilization-summary__metric");

      return {
        title: clean(titleEl && titleEl.textContent),
        metadata: clean(metadataEl && metadataEl.textContent),
        readyState: document.readyState,
        environmentImages: document.querySelectorAll(
          ".presentation_environment__source_image",
        ).length,
        utilizationMetric: clean(metricEl && metricEl.textContent),
        propertyTabs: document.querySelectorAll("a-tab").length,
        propertyContainers: document.querySelectorAll(".property-container")
          .length,
        findingsDetails: findingsSection
          ? findingsSection.querySelectorAll("details.findings_section_details")
              .length
          : 0,
        findingLinks: findingsSection
          ? findingsSection.querySelectorAll(
              'a[href*="/finding/"], a[href*="/findings/"]',
            ).length
          : 0,
        findingToggles: findingsSection
          ? findingsSection.querySelectorAll(
              'input[name="include_manual"], input[name="show_ongoing"]',
            ).length
          : 0,
        findingsText: clean(findingsSection && findingsSection.textContent),
        error: detectError(),
        sections: {
          environment: sectionInfo(environmentSection),
          utilization: sectionInfo(utilizationSection),
          properties: sectionInfo(propertiesSection),
          findings: sectionInfo(findingsSection),
        },
      };
    },

    getError: function () {
      requireReportPage();
      return detectError();
    },

    getInlineErrorLogViews: function () {
      requireInlineErrorLogs();
      return inlineErrorLogViews();
    },

    getRunMetadata: function () {
      requireReportPage();

      var titleEl = document.querySelector(".branded_title");
      var metadataEl = document.querySelector(".branded_metadata");
      var title = clean(titleEl && titleEl.textContent);
      var metadataText = clean(metadataEl && metadataEl.textContent);
      var metadataMatch = metadataText.match(
        /^Conducted on\s+(.+?)(?:\s*Source:\s*(.+))?$/,
      );

      var metricKeys = {
        "Test hours": "test_hours",
        "Wall clock": "wall_clock",
      };
      var metrics = document.querySelectorAll(".utilization-summary__metric");
      var utilization = {};
      metrics.forEach(function (m) {
        var parts = clean(m.textContent).split(":");
        if (parts.length !== 2) return;
        var key = metricKeys[parts[0].trim()];
        if (key) utilization[key] = parts[1].trim();
      });

      return {
        title: title,
        metadata: metadataText,
        conductedOn: metadataMatch ? metadataMatch[1].trim() : "",
        source:
          metadataMatch && metadataMatch[2] ? metadataMatch[2].trim() : "",
        test_hours: utilization.test_hours || null,
        wall_clock: utilization.wall_clock || null,
      };
    },

    getEnvironmentSourceImages: function () {
      requireReportPage();

      return Array.from(
        document.querySelectorAll(".presentation_environment__source_image"),
      ).map(function (img) {
        var title = img.querySelector(".source_image__title");
        var digest = img.querySelector(".click_to_copy_text_element");
        return {
          name: title
            ? clean(title.childNodes[0] && title.childNodes[0].textContent)
            : "",
          digest: clean(digest && digest.textContent),
        };
      });
    },

    getFindingsGrouped: function () {
      requireReportPage();

      return Array.from(
        document.querySelectorAll("details.findings_section_details"),
      )
        .map(function (section) {
          var summaryEl = section.querySelector("summary");
          var summary = clean(
            (summaryEl && summaryEl.textContent) || section.textContent,
          );
          var dateMatch = summary.match(
            /^[A-Z][a-z]{2} \d{2} [A-Z][a-z]{2,3} \d{2}:\d{2}/,
          );
          var date = dateMatch ? dateMatch[0] : "";

          var findings = Array.from(
            section.querySelectorAll(
              "a.w_fit.anchor_remove-style.w_full.justify_start",
            ),
          )
            .map(function (anchor) {
              var text = clean(anchor.textContent)
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
        });
    },

    getAllProperties: getAllProperties,
    getExampleLogsUrl: getExampleLogsUrl,
    getPropertyExamples: getPropertyExamples,
  };

  var logsApi = {
    loadingFinished: function () {
      var wrapper = document.querySelector(".sequence_printer_wrapper");
      var filterInput = document.querySelector(".sequence_filter__input");
      var searchInput = document.querySelector(".sequence_search__input");
      var counter = document.querySelector(".sequence_toolbar__items-counter");
      var counterText = clean(counter && counter.textContent);
      var visibleEvents = Array.from(
        document.querySelectorAll(".event"),
      ).filter(isVisible).length;
      var hasItemCount = /(\d[\d,]*)\s*items?\b/i.test(counterText);
      var inSelectedLogView =
        /[?&]get_logs=true\b/.test(window.location.search) ||
        /selected event log/i.test(clean(document.body.textContent));

      return !!(
        inSelectedLogView &&
        isVisible(wrapper) &&
        isVisible(filterInput) &&
        isVisible(searchInput) &&
        isVisible(counter) &&
        visibleEvents > 0 &&
        hasItemCount &&
        !/loading logs/i.test(counterText)
      );
    },

    loadingStatus: function () {
      var counterEl = document.querySelector(
        ".sequence_toolbar__items-counter",
      );
      return {
        url: window.location.href,
        wrapperVisible: isVisible(
          document.querySelector(".sequence_printer_wrapper"),
        ),
        filterVisible: isVisible(
          document.querySelector(".sequence_filter__input"),
        ),
        searchVisible: isVisible(
          document.querySelector(".sequence_search__input"),
        ),
        counterVisible: isVisible(counterEl),
        visibleEvents: Array.from(document.querySelectorAll(".event")).filter(
          isVisible,
        ).length,
        itemCounter: clean(counterEl && counterEl.textContent),
      };
    },

    waitForReady: async function (options) {
      requireLogsPage();
      return waitForReady(
        function () {
          return logsApi.loadingFinished();
        },
        function () {
          return logsApi.loadingStatus();
        },
        options,
      );
    },

    getLogViewers: function () {
      var wrappers = document.querySelectorAll(".sequence_printer_wrapper");
      return Array.from(wrappers).map(function (wrapper, i) {
        var text = wrapper.textContent || "";
        var itemMatch = text.match(/(\d[\d,]*)\s*items?\b/i);
        var itemCount = itemMatch
          ? Number(itemMatch[1].replace(/,/g, ""))
          : null;
        var prev = wrapper.previousElementSibling;
        var label = prev ? clean(prev.textContent) : null;
        var rect = wrapper.getBoundingClientRect();
        return {
          index: i,
          label: label,
          itemCount: itemCount,
          visible: rect.width > 0 && rect.height > 0,
        };
      });
    },

    prepareDownload: function (format, index) {
      var fmt = (format || "txt").toLowerCase();
      var downloadMap = {
        txt: "events.log",
        json: "events.json",
        csv: "events.csv",
      };
      var filename = downloadMap[fmt];
      if (!filename) {
        abort("unsupported format: " + format + "; use txt, json, or csv");
      }

      var wrappers = document.querySelectorAll(".sequence_printer_wrapper");
      if (wrappers.length === 0) {
        abort("no log viewers found on this page");
      }

      var idx = index != null ? index : 0;
      if (idx < 0 || idx >= wrappers.length) {
        abort(
          "log viewer index " +
            idx +
            " out of range; page has " +
            wrappers.length +
            " viewer(s)",
        );
      }

      var wrapper = wrappers[idx];

      var link = wrapper.querySelector(
        'a.sequence_printer_menu_button[download="' + filename + '"]',
      );
      if (!link) {
        abort("download link not found for format: " + fmt);
      }

      // Force the shadow-root menu visible so agent-browser can click the link.
      var aMenu = link.closest("a-menu");
      var shadowMenu =
        aMenu && aMenu.shadowRoot && aMenu.shadowRoot.querySelector("menu");
      if (!shadowMenu) {
        abort("shadow menu not found for download link in viewer " + idx);
      }
      shadowMenu.style.display = "flex";
      shadowMenu.style.position = "fixed";
      shadowMenu.style.top = "0";
      shadowMenu.style.left = "0";
      shadowMenu.style.zIndex = "99999";

      // Clear any previous marker, then tag this link for agent-browser.
      wrappers.forEach(function (w) {
        var prev = w.querySelector("[data-triage-dl]");
        if (prev) prev.removeAttribute("data-triage-dl");
      });
      link.setAttribute("data-triage-dl", "active");

      var selector = "a.sequence_printer_menu_button[data-triage-dl]";
      return { format: fmt, filename: filename, selector: selector };
    },
  };

  var runsApi = {
    loadingFinished: function () {
      var scroller = document.querySelector(".vscroll");
      if (!scroller) return false;

      var rows = Array.from(document.querySelectorAll("a-row"));
      if (rows.length === 0) return false;

      var hasRenderedCells = rows.some(function (row) {
        return row.querySelector("a-cell, [cell-identifier]");
      });
      if (!hasRenderedCells) return false;

      // Cells exist structurally but may not have hydrated with data yet.
      // Require at least one row with a non-empty name or status cell.
      var hasPopulatedRow = rows.some(function (row) {
        var name = row.querySelector('[cell-identifier="name"]');
        var status = row.querySelector('[cell-identifier="status"]');
        return (
          (name && clean(name.textContent) !== "") ||
          (status && clean(status.textContent) !== "")
        );
      });
      if (!hasPopulatedRow) return false;

      var hasVisibleLoadingIndicator = Array.from(
        scroller.querySelectorAll("*"),
      ).some(function (el) {
        return (
          isVisible(el) && /^Loading(?:\.\.\.)?$/.test(clean(el.textContent))
        );
      });

      return !hasVisibleLoadingIndicator;
    },

    loadingStatus: function () {
      var scroller = document.querySelector(".vscroll");
      var rows = Array.from(document.querySelectorAll("a-row"));

      return {
        url: window.location.href,
        hasScroller: !!scroller,
        rows: rows.length,
        hasRenderedCells: rows.some(function (row) {
          return row.querySelector("a-cell, [cell-identifier]");
        }),
      };
    },

    waitForReady: async function (options) {
      return waitForReady(
        function () {
          return runsApi.loadingFinished();
        },
        function () {
          return runsApi.loadingStatus();
        },
        options,
      );
    },

    /**
     * getRecentRuns(options?)
     *   options.status - optional status filter: "Starting", "In progress",
     *                    "Completed", "Cancelled", or "Incomplete"
     */
    getRecentRuns: async function (options) {
      requireRunsPage();
      options = options || {};

      var statusFilter = options.status || null;
      var statusOption = null;

      // Apply status filter if requested.
      if (statusFilter) {
        var allOptions = Array.from(
          document.querySelectorAll('a-menu-item[role="option"]'),
        );
        statusOption = allOptions.find(function (o) {
          return clean(o.textContent) === statusFilter;
        });
        if (!statusOption)
          abort(
            "status filter option '" +
              statusFilter +
              "' not found. Valid options: " +
              allOptions
                .map(function (o) {
                  return clean(o.textContent);
                })
                .join(", "),
          );
        statusOption.click();
        await wait(300);

        // Wait for the filtered list to settle.
        await runsApi.waitForReady({ timeoutMs: 10000 });
      }

      var scroller = document.querySelector(".vscroll");
      if (!scroller) abort("runs scroller not found");

      var runs = new Map();
      var previousScrollTop = -1;
      var stablePasses = 0;

      // The runs table is virtualized, so walk the scroller and merge rendered rows.
      for (var i = 0; i < 200; i++) {
        Array.from(document.querySelectorAll("a-row")).forEach(function (row) {
          var run = parseRunRow(row);
          var key = runKey(run);
          if (key) runs.set(key, run);
        });

        var maxScrollTop = Math.max(
          0,
          scroller.scrollHeight - scroller.clientHeight,
        );
        var nextScrollTop = Math.min(
          maxScrollTop,
          scroller.scrollTop +
            Math.max(200, Math.floor(scroller.clientHeight * 0.8)),
        );

        if (
          nextScrollTop === scroller.scrollTop ||
          nextScrollTop === previousScrollTop
        ) {
          stablePasses += 1;
          if (stablePasses >= 2) break;
        } else {
          stablePasses = 0;
        }

        previousScrollTop = scroller.scrollTop;
        scroller.scrollTop = nextScrollTop;
        scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        await wait(100);
      }

      // Clear the status filter to leave the page in a clean state.
      if (statusOption) {
        statusOption.click();
        await wait(100);
      }

      return {
        count: runs.size,
        runs: Array.from(runs.values()),
      };
    },
  };

  var api = {
    __version: VERSION,
    report: reportApi,
    logs: logsApi,
    runs: runsApi,
    info: function () {
      return {
        version: VERSION,
        description: "Antithesis triage runtime",
        namespaces: {
          report: Object.keys(reportApi).sort(),
          logs: Object.keys(logsApi).sort(),
          runs: Object.keys(runsApi).sort(),
        },
      };
    },
  };

  window.__antithesisTriage = api;
  return api.info();
})();
