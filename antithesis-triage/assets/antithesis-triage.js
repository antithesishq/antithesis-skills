(function () {
  var VERSION = "1.2.0";

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
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
    return clean(el && el.textContent);
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
      var details = clean(pre ? pre.textContent : content && content.textContent);

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
      return { error: "expected main report view", url: window.location.href };
    }

    if (/\/findings?\//.test(window.location.hash)) {
      return {
        error: "expected main report view, not finding hash route",
        url: window.location.href,
      };
    }

    return null;
  }

  function requireLogsPage() {
    if (
      window.location.pathname !== "/search" ||
      !/[?&]get_logs=true\b/.test(window.location.search)
    ) {
      return {
        error: "expected selected-event logs view",
        url: window.location.href,
      };
    }

    return null;
  }

  function requireRunsPage() {
    if (window.location.pathname !== "/runs") {
      return { error: "expected runs page", url: window.location.href };
    }

    return null;
  }

  function findSectionByHeading(heading) {
    return Array.from(document.querySelectorAll("section")).find(function (
      section,
    ) {
      return (
        clean(section.querySelector("h1, h2, h3, h4, h5, h6") && section.querySelector("h1, h2, h3, h4, h5, h6").textContent) ===
        heading
      );
    });
  }

  function visibleCount(selector) {
    return Array.from(document.querySelectorAll(selector)).filter(isVisible).length;
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
    return clean(
      container.querySelector(":scope > .property .property__name_label") &&
        container.querySelector(":scope > .property .property__name_label").textContent,
    );
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
    return container.querySelector(":scope > .property .property__expander-button");
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

  function isSelected(tab) {
    return !!tab && tab.getAttribute("selected") === "true";
  }

  async function activateTab(findTab, visibleReady) {
    var tab = findTab();
    if (!tab) return null;

    for (var attempt = 0; attempt < 12; attempt++) {
      click(tab);
      await wait(250);

      var expected = countFromTab(tab);
      if (isSelected(tab) && (visibleReady(expected) || expected === 0)) {
        return tab;
      }
    }

    return tab;
  }

  async function waitForReady(checkFn, detailsFn, options) {
    var timeoutMs =
      options && typeof options.timeoutMs === "number" ? options.timeoutMs : 60000;
    var intervalMs =
      options && typeof options.intervalMs === "number" ? options.intervalMs : 1000;
    var startedAt = Date.now();
    var deadline = startedAt + timeoutMs;
    var attempts = 0;

    while (Date.now() <= deadline) {
      attempts += 1;

      if (checkFn()) {
        return {
          ok: true,
          ready: true,
          attempts: attempts,
          waitedMs: Date.now() - startedAt,
        };
      }

      if (Date.now() + intervalMs > deadline) break;
      await wait(intervalMs);
    }

    return {
      ok: false,
      ready: false,
      attempts: attempts,
      waitedMs: Date.now() - startedAt,
      details: detailsFn ? detailsFn() : null,
    };
  }

  async function expandVisibleContainers(shouldExpand, maxPasses, settleMs) {
    for (var i = 0; i < maxPasses; i++) {
      var changed = false;

      visiblePropertyContainers().forEach(function (container) {
        if (!shouldExpand(container)) return;

        if (click(expanderButton(container))) {
          changed = true;
        }
      });

      if (!changed) break;
      await wait(settleMs);
    }
  }

  function visibleLeafProperties(filterStatus) {
    return visiblePropertyContainers()
      .filter(function (container) {
        if (!isLeaf(container) || !nameOf(container)) return false;
        return !filterStatus || containerStatus(container) === filterStatus;
      })
      .map(function (container) {
        return {
          group: groupPath(container),
          name: nameOf(container),
          status: containerStatus(container),
        };
      });
  }

  function examplesRows(container) {
    return container.querySelectorAll(
      ":scope > .property__details .examples_table__row",
    ).length;
  }

  function extractLogEvent(ev) {
    // Assertion rows and regular log rows render their useful text differently.
    var assertion = ev.querySelector(".sdk-assertion__meta");
    if (assertion) {
      return clean(assertion.textContent);
    }

    var output = ev.querySelector(".event__varying-part .event__output_text");
    var direct = lastTextNode(output);
    if (direct) return direct;

    return clean(output && output.textContent).replace(/^event\.output_text\s*/i, "");
  }

  function serializeLogEvent(ev) {
    return {
      vtime: lastText(ev.querySelector(".event__vtime")),
      source: lastText(ev.querySelector(".event__source_name")),
      text: extractLogEvent(ev),
      highlighted:
        ev.classList.contains("_emphasized_blue") ||
        ev.classList.contains("_emphasized"),
    };
  }

  function readEventsFromWrapper(wrapper, limit) {
    var maxItems = typeof limit === "number" && limit > 0 ? limit : 20;

    return Array.from(wrapper.querySelectorAll(".event"))
      .slice(0, maxItems)
      .map(function (ev) {
        return serializeLogEvent(ev);
      });
  }

  function errorSection() {
    return findSectionByHeading("Error");
  }

  function inlineErrorLogWrappers() {
    var section = errorSection();
    if (!section) return [];

    return Array.from(section.querySelectorAll(".sequence_printer_wrapper")).filter(
      isVisible,
    );
  }

  function requireInlineErrorLogs() {
    var navError = requireReportPage();
    if (navError) return navError;

    var err = detectError();
    if (!err) {
      return {
        error: "expected error report with inline logs",
        url: window.location.href,
      };
    }

    var wrappers = inlineErrorLogWrappers();
    if (!wrappers.length) {
      return {
        error: "no inline error log panes found",
        errorType: err.type,
        url: window.location.href,
      };
    }

    return null;
  }

  function inlineErrorLogViews() {
    return inlineErrorLogWrappers().map(function (wrapper, index) {
      var counterText = clean(
        wrapper.querySelector(".sequence_toolbar__items-counter") &&
          wrapper.querySelector(".sequence_toolbar__items-counter").textContent,
      );
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

  async function collectEventsFromWrapper(wrapper, options) {
    var scroller = wrapper.querySelector(".vscroll");
    if (!scroller) return { error: "log scroller not found" };

    var maxItems =
      options && typeof options.maxItems === "number" && options.maxItems > 0
        ? options.maxItems
        : null;
    var stepPx =
      options && typeof options.stepPx === "number" && options.stepPx > 0
        ? options.stepPx
        : Math.max(Math.floor(scroller.clientHeight * 0.8), 200);
    var settleMs =
      options && typeof options.settleMs === "number" && options.settleMs >= 0
        ? options.settleMs
        : 100;
    var maxScrolls =
      options && typeof options.maxScrolls === "number" && options.maxScrolls > 0
        ? options.maxScrolls
        : 500;

    var startTop = scroller.scrollTop;
    var seen = {};
    var events = [];

    function recordVisible() {
      Array.from(wrapper.querySelectorAll(".event")).forEach(function (ev) {
        var entry = serializeLogEvent(ev);
        var key = [entry.vtime, entry.source, entry.text].join("\n");
        if (!entry.vtime && !entry.source && !entry.text) return;
        if (seen[key]) return;
        seen[key] = true;
        events.push(entry);
      });
    }

    scroller.scrollTop = 0;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await wait(settleMs);

    var previousCount = -1;
    for (var i = 0; i < maxScrolls; i++) {
      recordVisible();
      if (maxItems && events.length >= maxItems) break;

      var atBottom =
        Math.ceil(scroller.scrollTop + scroller.clientHeight) >=
        Math.floor(scroller.scrollHeight);
      if (atBottom && events.length === previousCount) break;
      previousCount = events.length;

      var nextTop = Math.min(
        scroller.scrollTop + stepPx,
        Math.max(scroller.scrollHeight - scroller.clientHeight, 0),
      );

      if (nextTop === scroller.scrollTop) {
        if (atBottom) break;
        nextTop = scroller.scrollHeight;
      }

      scroller.scrollTop = nextTop;
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      await wait(settleMs);
    }

    recordVisible();
    scroller.scrollTop = startTop;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));

    return {
      itemCount: parseItemCount(
        clean(
          wrapper.querySelector(".sequence_toolbar__items-counter") &&
            wrapper.querySelector(".sequence_toolbar__items-counter").textContent,
        ),
      ),
      collectedCount: events.length,
      truncated: !!(maxItems && events.length >= maxItems),
      events: maxItems ? events.slice(0, maxItems) : events,
    };
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
          : clean(row.textContent).replace(clean(keyEl && keyEl.textContent), ""),
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
    var actionCell = row.querySelector("a-cell.table_left_most_right_pinned_col");
    var nameTooltip = nameCell
      ? nameCell.closest("a-cell").querySelector("a-tooltip")
      : null;
    var creatorTooltip = creatorSource
      ? creatorSource.closest("a-cell").querySelector("a-tooltip")
      : null;
    var nameMeta = tooltipMap(nameTooltip);
    var creatorMeta = tooltipMap(creatorTooltip);

    return {
      name:
        nameMeta.Name ||
        clean(nameCell && nameCell.querySelector(".runs_table_muted_tooltip_text") && nameCell.querySelector(".runs_table_muted_tooltip_text").textContent) ||
        clean(nameCell && nameCell.textContent),
      description:
        nameMeta.Description ||
        clean(nameCell && nameCell.querySelector(".runs_table_tooltip_text") && nameCell.querySelector(".runs_table_tooltip_text").textContent),
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

  async function getAllProperties() {
    var error = requireReportPage();
    if (error) return error;

    var tab = await activateTab(
      function () {
        return tabByPattern(/\ball\b/);
      },
      function () {
        return visiblePropertyContainers().length > 0;
      },
    );

    // Fresh report loads may only expose top-level groups until they are expanded.
    for (var i = 0; i < 24; i++) {
      var before = visibleLeafProperties().length;
      await expandVisibleContainers(
        function (container) {
          return !!expanderButton(container) && !isExpanded(container);
        },
        1,
        250,
      );
      var after = visibleLeafProperties().length;
      if (after === before) break;
    }

    var properties = visibleLeafProperties();
    var counts = properties.reduce(function (acc, property) {
      acc[property.status] = (acc[property.status] || 0) + 1;
      return acc;
    }, {});

    return {
      filter: "all",
      expectedCount: countFromTab(tab),
      counts: counts,
      properties: properties,
    };
  }

  async function getFilteredProperties(target) {
    var error = requireReportPage();
    if (error) return error;

    var tab = await activateTab(
      function () {
        if (target === "failed") {
          return document.querySelector("a-tab._failing") || tabByPattern(/\bfailed\b/);
        }
        if (target === "passed") {
          return document.querySelector("a-tab._passing") || tabByPattern(/\bpassed\b/);
        }
        return tabByPattern(/\ball\b/);
      },
      function () {
        return visiblePropertyContainers().some(function (container) {
          return !target || containerStatus(container) === target;
        });
      },
    );

    await expandVisibleContainers(
      function (container) {
        if (!expanderButton(container) || isExpanded(container)) return false;
        // The passed tab already filters the tree; only expand passed-status branches there.
        if (target === "passed") return containerStatus(container) === target;
        return true;
      },
      target === "passed" ? 16 : 24,
      target === "passed" ? 300 : 250,
    );

    return {
      filter: target || "all",
      expectedCount: countFromTab(tab),
      properties: visibleLeafProperties(target),
    };
  }

  async function expandFailedExamples() {
    var error = requireReportPage();
    if (error) return error;

    await activateTab(
      function () {
        return document.querySelector("a-tab._failing") || tabByPattern(/\bfailed\b/);
      },
      function () {
        return visiblePropertyContainers().some(function (container) {
          return containerStatus(container) === "failed";
        });
      },
    );

    for (var i = 0; i < 8; i++) {
      var changed = false;

      // Expand failed groups first so leaf examples tables become reachable.
      visiblePropertyContainers().forEach(function (container) {
        if (!isVisible(container) || !isGroup(container) || isExpanded(container)) {
          return;
        }

        if (containerStatus(container) !== "failed") {
          return;
        }

        if (click(expanderButton(container))) {
          changed = true;
        }
      });

      if (changed) await wait(250);

      // Then expand failed leaves until example rows render.
      visiblePropertyContainers().forEach(function (container) {
        if (!isVisible(container) || isGroup(container)) return;
        if (containerStatus(container) !== "failed" || examplesRows(container) > 0) {
          return;
        }

        if (click(expanderButton(container))) {
          changed = true;
        }
      });

      if (changed) {
        await wait(250);
      } else {
        break;
      }
    }

    var expandedProperties = visiblePropertyContainers()
      .filter(function (container) {
        return (
          !isGroup(container) &&
          containerStatus(container) === "failed" &&
          examplesRows(container) > 0
        );
      })
      .map(function (container) {
        return {
          group: groupPath(container),
          name: nameOf(container),
          exampleRows: examplesRows(container),
        };
      })
      .filter(function (property) {
        return property.name;
      });

    return {
      filter: "failed",
      expandedProperties: expandedProperties,
      totalExampleRows: expandedProperties.reduce(function (sum, property) {
        return sum + property.exampleRows;
      }, 0),
    };
  }

  function getExampleUrls() {
    var error = requireReportPage();
    if (error) return error;

    return Array.from(document.querySelectorAll(".examples_table__row")).map(
      function (row) {
        var example = row.querySelector(".example_failing, .example_passing");
        var getLogsLink = row.querySelector("a[href*='search']");

        return {
          status: example ? example.className.replace("example_", "") : "",
          time: row.querySelectorAll("td")[1] && clean(row.querySelectorAll("td")[1].textContent),
          logsUrl: getLogsLink ? getLogsLink.href : null,
        };
      },
    );
  }

  function examplesForContainer(container) {
    return Array.from(
      container.querySelectorAll(":scope > .property__details .examples_table__row"),
    ).map(function (row) {
      var example = row.querySelector(".example_failing, .example_passing");
      var getLogsLink = row.querySelector("a[href*='search']");

      return {
        status: example ? example.className.replace("example_", "") : "",
        time: row.querySelectorAll("td")[1] && clean(row.querySelectorAll("td")[1].textContent),
        logsUrl: getLogsLink ? getLogsLink.href : null,
      };
    });
  }

  async function getFailedPropertyExamples() {
    var error = requireReportPage();
    if (error) return error;

    var expanded = await expandFailedExamples();
    if (expanded && expanded.error) return expanded;

    var properties = visiblePropertyContainers()
      .filter(function (container) {
        return (
          !isGroup(container) &&
          containerStatus(container) === "failed" &&
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
      })
      .filter(function (property) {
        return property.name;
      });

    return {
      filter: "failed",
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
      var environmentImages = visibleCount(".presentation_environment__source_image");
      var utilizationMetric = clean(
        document.querySelector(".utilization-summary__metric") &&
          document.querySelector(".utilization-summary__metric").textContent,
      );
      var propertyTabs = visibleCount("a-tab");
      var propertyContainers = visibleCount(".property-container");
      var propertiesText = clean(propertiesSection && propertiesSection.textContent);
      var findingsSection = document.querySelector("section.section_findings");
      var findingsText = clean(findingsSection && findingsSection.textContent);
      var findingsDetails =
        findingsSection && isVisible(findingsSection)
          ? findingsSection.querySelectorAll("details.findings_section_details").length
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
      return result;
    },

    loadingStatus: function () {
      var error = requireReportPage();
      if (error) return error;

      var environmentSection = findSectionByHeading("Environment");
      var utilizationSection = findSectionByHeading("Utilization");
      var propertiesSection = document.querySelector(
        "section.section_properties:not(.section_findings)",
      );
      var findingsSection = document.querySelector("section.section_findings");

      return {
        title: clean(document.querySelector(".branded_title") && document.querySelector(".branded_title").textContent),
        metadata: clean(document.querySelector(".branded_metadata") && document.querySelector(".branded_metadata").textContent),
        readyState: document.readyState,
        environmentImages: document.querySelectorAll(
          ".presentation_environment__source_image",
        ).length,
        utilizationMetric: clean(
          document.querySelector(".utilization-summary__metric") &&
            document.querySelector(".utilization-summary__metric").textContent,
        ),
        propertyTabs: document.querySelectorAll("a-tab").length,
        propertyContainers: document.querySelectorAll(".property-container").length,
        findingsDetails: findingsSection
          ? findingsSection.querySelectorAll("details.findings_section_details").length
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
      var navError = requireReportPage();
      if (navError) return navError;
      return detectError();
    },

    getInlineErrorLogViews: function () {
      var error = requireInlineErrorLogs();
      if (error) return error;
      return inlineErrorLogViews();
    },

    readInlineErrorLog: function (index, limit) {
      var error = requireInlineErrorLogs();
      if (error) return error;

      var wrappers = inlineErrorLogWrappers();
      var target = typeof index === "number" ? index : 0;
      var wrapper = wrappers[target];
      if (!wrapper) {
        return {
          error: "inline error log pane not found",
          index: target,
          available: wrappers.length,
        };
      }

      return {
        index: target,
        itemCount: parseItemCount(
          clean(
            wrapper.querySelector(".sequence_toolbar__items-counter") &&
              wrapper.querySelector(".sequence_toolbar__items-counter").textContent,
          ),
        ),
        events: readEventsFromWrapper(wrapper, limit),
      };
    },

    collectInlineErrorLog: async function (index, options) {
      var error = requireInlineErrorLogs();
      if (error) return error;

      var wrappers = inlineErrorLogWrappers();
      var target = typeof index === "number" ? index : 0;
      var wrapper = wrappers[target];
      if (!wrapper) {
        return {
          error: "inline error log pane not found",
          index: target,
          available: wrappers.length,
        };
      }

      var result = await collectEventsFromWrapper(wrapper, options || {});
      if (result.error) return result;
      result.index = target;
      return result;
    },

    getRunMetadata: function () {
      var error = requireReportPage();
      if (error) return error;

      var title = clean(
        document.querySelector(".branded_title") &&
          document.querySelector(".branded_title").textContent,
      );
      var metadataText = clean(
        document.querySelector(".branded_metadata") &&
          document.querySelector(".branded_metadata").textContent,
      );
      var metadataMatch = metadataText.match(
        /^Conducted on\s+(.+?)(?:\s*Source:\s*(.+))?$/,
      );

      return {
        title: title,
        metadata: metadataText,
        conductedOn: metadataMatch ? metadataMatch[1].trim() : "",
        source: metadataMatch && metadataMatch[2] ? metadataMatch[2].trim() : "",
      };
    },

    getEnvironmentSourceImages: function () {
      var error = requireReportPage();
      if (error) return error;

      return Array.from(
        document.querySelectorAll(".presentation_environment__source_image"),
      ).map(function (img) {
        var title = img.querySelector(".source_image__title");
        var digest = img.querySelector(".click_to_copy_text_element");
        return {
          name: title ? clean(title.childNodes[0] && title.childNodes[0].textContent) : "",
          digest: clean(digest && digest.textContent),
        };
      });
    },

    getFindingsGrouped: async function () {
      var error = requireReportPage();
      if (error) return error;

      // Expand all findings sections so lazy-rendered content is available.
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

      // Re-query after expansion in case the DOM changed.
      return Array.from(document.querySelectorAll("details.findings_section_details"))
        .map(function (section) {
          var summary = clean(
            (section.querySelector("summary") && section.querySelector("summary").textContent) ||
              section.textContent,
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
              var text = clean(anchor.textContent).replace(/Look into this finding$/, "").trim();
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

    getUtilizationTotalTestHours: function () {
      var error = requireReportPage();
      if (error) return error;

      var metric = document.querySelector(".utilization-summary__metric");
      return metric ? clean(metric.textContent) : "no data";
    },

    getAllProperties: getAllProperties,
    getFailedProperties: function () {
      return getFilteredProperties("failed");
    },
    getPassedProperties: function () {
      return getFilteredProperties("passed");
    },
    getUnfoundProperties: function () {
      return getFilteredProperties("unfound");
    },
    expandFailedExamples: expandFailedExamples,
    getExampleUrls: getExampleUrls,
    getFailedPropertyExamples: getFailedPropertyExamples,
  };

  var logsApi = {
    loadingFinished: function () {
      var wrapper = document.querySelector(".sequence_printer_wrapper");
      var filterInput = document.querySelector(".sequence_filter__input");
      var searchInput = document.querySelector(".sequence_search__input");
      var counter = document.querySelector(".sequence_toolbar__items-counter");
      var counterText = clean(counter && counter.textContent);
      var visibleEvents = Array.from(document.querySelectorAll(".event")).filter(isVisible)
        .length;
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
      return {
        url: window.location.href,
        wrapperVisible: isVisible(document.querySelector(".sequence_printer_wrapper")),
        filterVisible: isVisible(document.querySelector(".sequence_filter__input")),
        searchVisible: isVisible(document.querySelector(".sequence_search__input")),
        counterVisible: isVisible(
          document.querySelector(".sequence_toolbar__items-counter"),
        ),
        visibleEvents: Array.from(document.querySelectorAll(".event")).filter(isVisible)
          .length,
        itemCounter: clean(
          document.querySelector(".sequence_toolbar__items-counter") &&
            document.querySelector(".sequence_toolbar__items-counter").textContent,
        ),
      };
    },

    waitForReady: async function (options) {
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

    getItemCount: function () {
      var error = requireLogsPage();
      if (error) return error;

      var counterText = clean(
        document.querySelector(".sequence_toolbar__items-counter") &&
          document.querySelector(".sequence_toolbar__items-counter").textContent,
      );
      var count = parseItemCount(counterText);
      return count === null ? "unknown" : String(count);
    },

    filter: function (query) {
      var error = requireLogsPage();
      if (error) return error;

      var filter = document.querySelector(".sequence_filter__input");
      filter.value = typeof query === "string" && query !== "" ? query : "error";
      filter.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true, query: filter.value };
    },

    clearFilter: function () {
      var error = requireLogsPage();
      if (error) return error;

      var filter = document.querySelector(".sequence_filter__input");
      filter.value = "";
      filter.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true };
    },

    readVisibleEvents: function (limit) {
      var error = requireLogsPage();
      if (error) return error;
      return readEventsFromWrapper(document, limit);
    },

    findHighlightedEvent: function (beforeCount, afterCount) {
      var error = requireLogsPage();
      if (error) return error;

      var events = Array.from(document.querySelectorAll(".event"));
      var highlightedIndex = events.findIndex(function (ev) {
        return ev.classList.contains("_emphasized_blue");
      });

      if (highlightedIndex < 0) {
        return { error: "no highlighted event found" };
      }

      var before = typeof beforeCount === "number" ? beforeCount : 10;
      var after = typeof afterCount === "number" ? afterCount : 5;
      var start = Math.max(0, highlightedIndex - before);
      var end = Math.min(events.length, highlightedIndex + after);

      return events.slice(start, end).map(function (ev) {
        return serializeLogEvent(ev);
      });
    },

    search: function (query) {
      var error = requireLogsPage();
      if (error) return error;

      if (typeof query !== "string" || query === "") {
        return {
          error: "expected non-empty query",
          url: window.location.href,
        };
      }

      var search = document.querySelector(".sequence_search__input");
      search.value = query;
      search.dispatchEvent(new Event("input", { bubbles: true }));
      search.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      return { ok: true, query: query };
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

      var hasVisibleLoadingIndicator = Array.from(scroller.querySelectorAll("*")).some(
        function (el) {
          return isVisible(el) && /^Loading(?:\.\.\.)?$/.test(clean(el.textContent));
        },
      );

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

    getRecentRuns: async function () {
      var error = requireRunsPage();
      if (error) return error;

      var scroller = document.querySelector(".vscroll");
      if (!scroller) return { error: "runs scroller not found" };

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

        var maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        var nextScrollTop = Math.min(
          maxScrollTop,
          scroller.scrollTop + Math.max(200, Math.floor(scroller.clientHeight * 0.8)),
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
        ok: true,
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
