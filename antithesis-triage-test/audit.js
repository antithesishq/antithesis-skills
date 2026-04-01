(async function () {
  function now() {
    return Date.now();
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function currentPageType() {
    if (/^\/report\//.test(window.location.pathname)) return "report";
    if (
      window.location.pathname === "/search" &&
      /[?&]get_logs=true\b/.test(window.location.search)
    ) {
      return "logs";
    }
    if (window.location.pathname === "/runs") return "runs";
    return "unknown";
  }

  function summarizeWait(result) {
    return {
      attempts: result.attempts,
      waitedMs: result.waitedMs,
    };
  }

  function summarizeProperties(result) {
    var properties = Array.isArray(result.properties) ? result.properties : [];
    var countFieldsPresent = properties.filter(function (property) {
      return (
        property &&
        Object.prototype.hasOwnProperty.call(property, "passingCount") &&
        Object.prototype.hasOwnProperty.call(property, "failingCount")
      );
    }).length;
    var nonNullCountFields = properties.filter(function (property) {
      return (
        property &&
        (property.passingCount !== null || property.failingCount !== null)
      );
    }).length;
    return {
      expectedCount: result.expectedCount,
      propertyCount: properties.length,
      counts: result.counts || null,
      countFieldsPresent: countFieldsPresent,
      nonNullCountFields: nonNullCountFields,
    };
  }

  function summarizeImages(result) {
    return {
      count: Array.isArray(result) ? result.length : 0,
      names: Array.isArray(result)
        ? result.slice(0, 5).map(function (item) {
            return item.name;
          })
        : [],
    };
  }

  function summarizeFindings(result) {
    return {
      groups: Array.isArray(result) ? result.length : 0,
      findings: Array.isArray(result)
        ? result.reduce(function (sum, group) {
            return sum + (Array.isArray(group.findings) ? group.findings.length : 0);
          }, 0)
        : 0,
    };
  }

  function summarizeStringMetric(result) {
    var digits = typeof result === "string" ? result.replace(/[^\d.]/g, "") : "";
    return {
      raw: result,
      numeric: digits ? Number(digits) : null,
    };
  }

  function summarizeEventList(result) {
    var events = Array.isArray(result)
      ? result
      : result && Array.isArray(result.events)
        ? result.events
        : [];

    return {
      count: events.length,
      itemCount: result && typeof result.itemCount === "number"
        ? result.itemCount
        : null,
      collectedCount: result && typeof result.collectedCount === "number"
        ? result.collectedCount
        : null,
      firstEvent: events[0]
        ? {
            vtime: events[0].vtime,
            source: events[0].source,
            text: clean(events[0].text).slice(0, 160),
            highlighted: !!events[0].highlighted,
          }
        : null,
    };
  }

  function summarizeInlineLogViews(result) {
    var views = Array.isArray(result) ? result : [];
    return {
      count: views.length,
      firstView: views[0]
        ? {
            index: views[0].index,
            itemCount: views[0].itemCount,
            visibleEvents: views[0].visibleEvents,
            firstEvent: views[0].firstEvent
              ? {
                  vtime: views[0].firstEvent.vtime,
                  source: views[0].firstEvent.source,
                  text: clean(views[0].firstEvent.text).slice(0, 160),
                }
              : null,
          }
        : null,
    };
  }

  function summarizePropertyExamples(result) {
    var properties = Array.isArray(result.properties) ? result.properties : [];
    return {
      propertyCount: properties.length,
      totalExamples: result.totalExamples || 0,
      firstProperty: properties.length > 0
        ? {
            group: properties[0].group,
            name: properties[0].name,
            status: properties[0].status,
            examples: properties[0].examples.length,
          }
        : null,
    };
  }

  function hasRunStatus(run, needle) {
    var status = clean(run && run.status).toLowerCase();
    return status.indexOf(String(needle).toLowerCase()) >= 0;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function findCheck(checks, name) {
    return checks.find(function (check) {
      return check.name === name && check.ok;
    });
  }

  function skipCheck(name, reason) {
    return {
      name: name,
      ok: true,
      status: "skipped",
      durationMs: 0,
      reason: reason,
      summary: null,
    };
  }

  function tokensFromText(text) {
    return clean(text)
      .split(/[^A-Za-z0-9_:-]+/)
      .map(function (token) {
        return token.trim();
      })
      .filter(function (token) {
        return /[A-Za-z]/.test(token) && token.length >= 3;
      });
  }

  function deriveLogsQuery(events) {
    var seen = {};
    var fields = [];

    (Array.isArray(events) ? events : []).forEach(function (event) {
      if (!event) return;
      fields.push(event.source, event.container, event.text);
    });

    for (var i = 0; i < fields.length; i++) {
      var tokens = tokensFromText(fields[i]);
      for (var j = 0; j < tokens.length; j++) {
        var key = tokens[j].toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        return tokens[j];
      }
    }

    return "";
  }

  async function runCheck(name, fn, summarize, options) {
    var startedAt = now();
    var keepResult = !!(options && options.keepResult);
    var expectError = (options && options.expectError) || null;

    try {
      var result = await fn();

      if (expectError) {
        return {
          name: name,
          ok: false,
          status: "failed",
          durationMs: now() - startedAt,
          summary: "expected error '" + expectError + "' but got success",
          result: keepResult ? clone(result) : undefined,
        };
      }

      return {
        name: name,
        ok: true,
        status: "passed",
        durationMs: now() - startedAt,
        summary: summarize ? summarize(result) : null,
        result: keepResult ? clone(result) : undefined,
      };
    } catch (error) {
      var msg = error && error.message ? error.message : String(error);
      if (expectError && msg === expectError) {
        return {
          name: name,
          ok: true,
          status: "passed",
          durationMs: now() - startedAt,
          summary: "error handling verified: " + expectError,
        };
      }
      return {
        name: name,
        ok: false,
        status: "failed",
        durationMs: now() - startedAt,
        error: msg,
      };
    }
  }

  function makeReport(phase) {
    return {
      ok: true,
      phase: phase,
      pageType: currentPageType(),
      url: window.location.href,
      runtimeInfo: window.__antithesisTriage.info(),
      checks: [],
      counts: {},
      discovered: {},
      warnings: [],
      errors: [],
    };
  }

  function finalize(report) {
    report.errors = report.errors.concat(
      report.checks
        .filter(function (check) {
          return !check.ok;
        })
        .map(function (check) {
          return check.name + ": " + check.error;
        }),
    );

    if (report.errors.length > 0) {
      report.ok = false;
    }

    return report;
  }

  async function auditRuns() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("runs");

    report.checks.push(
      await runCheck("runs.waitForReady", function () {
        return runtime.runs.waitForReady();
      }, summarizeWait),
    );
    report.checks.push(
      await runCheck("runs.loadingStatus", function () {
        return runtime.runs.loadingStatus();
      }, null, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("runs.getRecentRuns", function () {
        return runtime.runs.getRecentRuns();
      }, function (result) {
        var runs = Array.isArray(result.runs) ? result.runs : [];
        var completed = runs.filter(function (run) {
          return !!run.triageUrl && hasRunStatus(run, "completed");
        });
        var incomplete = runs.filter(function (run) {
          return !!run.triageUrl && hasRunStatus(run, "incomplete");
        });
        return {
          count: result.count,
          completedReports: completed.length,
          incompleteReports: incomplete.length,
          latestCompletedReportUrl: completed[0] ? completed[0].triageUrl : null,
          latestIncompleteReportUrl: incomplete[0] ? incomplete[0].triageUrl : null,
        };
      }, { keepResult: true }),
    );

    var runsCheck = findCheck(report.checks, "runs.getRecentRuns");
    var runsSummary = runsCheck && runsCheck.summary ? runsCheck.summary : {};
    var runs = runsCheck && runsCheck.result && Array.isArray(runsCheck.result.runs)
      ? runsCheck.result.runs
      : [];

    report.counts.totalRuns = runs.length;
    report.counts.completedReports = runsSummary.completedReports || 0;
    report.counts.incompleteReports = runsSummary.incompleteReports || 0;
    report.discovered.latestCompletedReportUrl = runsSummary.latestCompletedReportUrl || null;
    report.discovered.latestIncompleteReportUrl = runsSummary.latestIncompleteReportUrl || null;

    if (report.counts.totalRuns === 0) {
      report.warnings.push("runs page returned zero runs");
    }
    if (!report.discovered.latestCompletedReportUrl) {
      report.warnings.push("could not find a recent completed report url");
    }

    return finalize(report);
  }

  async function auditReportCore() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("report-core");

    report.checks.push(
      await runCheck("report.waitForReady", function () {
        return runtime.report.waitForReady();
      }, summarizeWait),
    );
    report.checks.push(
      await runCheck("report.loadingStatus", function () {
        return runtime.report.loadingStatus();
      }, null, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getRunMetadata", function () {
        return runtime.report.getRunMetadata();
      }, function (result) {
        return {
          title: result.title,
          conductedOn: result.conductedOn,
          source: result.source,
        };
      }, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getEnvironmentSourceImages", function () {
        return runtime.report.getEnvironmentSourceImages();
      }, summarizeImages, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getFindingsGrouped", function () {
        return runtime.report.getFindingsGrouped();
      }, summarizeFindings, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getUtilizationTotalTestHours", function () {
        return runtime.report.getUtilizationTotalTestHours();
      }, summarizeStringMetric, { keepResult: true }),
    );

    var metadataCheck = findCheck(report.checks, "report.getRunMetadata");
    var imagesCheck = findCheck(report.checks, "report.getEnvironmentSourceImages");
    var findingsCheck = findCheck(report.checks, "report.getFindingsGrouped");

    report.discovered.title = metadataCheck ? metadataCheck.result.title : "";
    report.counts.environmentImages = imagesCheck && Array.isArray(imagesCheck.result)
      ? imagesCheck.result.length
      : 0;
    report.counts.findingGroups = findingsCheck && Array.isArray(findingsCheck.result)
      ? findingsCheck.result.length
      : 0;
    report.counts.findings = findingsCheck && Array.isArray(findingsCheck.result)
      ? findingsCheck.result.reduce(function (sum, group) {
          return sum + (Array.isArray(group.findings) ? group.findings.length : 0);
        }, 0)
      : 0;

    if (!report.discovered.title) {
      report.warnings.push("report metadata did not include a title");
    }

    return finalize(report);
  }

  async function auditReportProperties() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("report-properties");

    report.checks.push(
      await runCheck("report.getAllProperties", function () {
        return runtime.report.getAllProperties();
      }, summarizeProperties, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getFailedProperties", function () {
        return runtime.report.getFailedProperties();
      }, summarizeProperties, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getPassedProperties", function () {
        return runtime.report.getPassedProperties();
      }, summarizeProperties, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getUnfoundProperties", function () {
        return runtime.report.getUnfoundProperties();
      }, summarizeProperties, { keepResult: true }),
    );

    function propertyCount(checkName) {
      var check = findCheck(report.checks, checkName);
      return check && check.summary ? check.summary.propertyCount : 0;
    }

    report.counts.totalProperties = propertyCount("report.getAllProperties");
    report.counts.failedProperties = propertyCount("report.getFailedProperties");
    report.counts.passedProperties = propertyCount("report.getPassedProperties");
    report.counts.unfoundProperties = propertyCount("report.getUnfoundProperties");
    report.counts.propertiesWithCountFields = 0;
    report.counts.propertiesWithNonNullCountFields = 0;

    report.checks.forEach(function (check) {
      if (!check.ok || !check.summary) return;
      report.counts.propertiesWithCountFields += check.summary.countFieldsPresent || 0;
      report.counts.propertiesWithNonNullCountFields +=
        check.summary.nonNullCountFields || 0;
    });

    if (report.counts.totalProperties === 0) {
      report.warnings.push("report returned zero properties");
    }

    report.checks.forEach(function (check) {
      if (!check.ok) return;
      if (!check.result || !Array.isArray(check.result.properties)) return;

      var missingCountFields = check.result.properties.filter(function (property) {
        return !(
          property &&
          Object.prototype.hasOwnProperty.call(property, "passingCount") &&
          Object.prototype.hasOwnProperty.call(property, "failingCount")
        );
      });

      if (missingCountFields.length > 0) {
        report.errors.push(
          check.name +
            ": properties missing passingCount/failingCount fields (" +
            missingCountFields.length +
            ")"
        );
      }
    });

    return finalize(report);
  }

  async function auditReportExamples() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("report-examples");

    report.checks.push(
      await runCheck("report.getExampleLogsUrl", function () {
        return runtime.report.getExampleLogsUrl("__nonexistent__", 0);
      }, null, { expectError: "property not found" }),
    );

    report.checks.push(
      await runCheck("report.getPropertyExamples", function () {
        return runtime.report.getPropertyExamples();
      }, summarizePropertyExamples, { keepResult: true }),
    );

    report.checks.push(
      await runCheck("report.getFailedPropertyExamples", function () {
        return runtime.report.getFailedPropertyExamples();
      }, summarizePropertyExamples, { keepResult: true }),
    );

    var allPropertyExamplesCheck = findCheck(report.checks, "report.getPropertyExamples");
    var failedPropertyExamplesCheck = findCheck(report.checks, "report.getFailedPropertyExamples");

    report.counts.propertyExamples = allPropertyExamplesCheck && allPropertyExamplesCheck.result
      ? allPropertyExamplesCheck.result.totalExamples || 0
      : 0;
    report.counts.failedPropertyExamples =
      failedPropertyExamplesCheck && failedPropertyExamplesCheck.result
        ? failedPropertyExamplesCheck.result.totalExamples || 0
      : 0;

    return finalize(report);
  }

  async function auditReportError() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("report-error");

    // waitForReady should short-circuit on error reports instead of timing out.
    report.checks.push(
      await runCheck("report.waitForReady", function () {
        return runtime.report.waitForReady();
      }, function (result) {
        var summary = summarizeWait(result);
        summary.hasError = !!result.error;
        summary.errorType = result.error ? result.error.type : null;
        return summary;
      }, { keepResult: true }),
    );

    var waitCheck = report.checks.find(function (check) {
      return check.name === "report.waitForReady";
    });
    var waitResult = waitCheck && waitCheck.result ? waitCheck.result : {};
    var detectedError = waitResult.error || null;

    // getError should agree with waitForReady.
    report.checks.push(
      await runCheck("report.getError", function () {
        return runtime.report.getError();
      }, function (result) {
        return result;
      }, { keepResult: true }),
    );

    // Metadata and environment should always work on error reports.
    report.checks.push(
      await runCheck("report.getRunMetadata", function () {
        return runtime.report.getRunMetadata();
      }, function (result) {
        return {
          title: result.title,
          conductedOn: result.conductedOn,
          source: result.source,
        };
      }, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getEnvironmentSourceImages", function () {
        return runtime.report.getEnvironmentSourceImages();
      }, summarizeImages, { keepResult: true }),
    );

    report.checks.push(
      await runCheck("report.getInlineErrorLogViews", function () {
        return runtime.report.getInlineErrorLogViews();
      }, summarizeInlineLogViews, { keepResult: true }),
    );

    // For runtime errors, properties and utilization should still work.
    if (!detectedError || detectedError.type === "runtime_error") {
      report.checks.push(
        await runCheck("report.getAllProperties", function () {
          return runtime.report.getAllProperties();
        }, summarizeProperties),
      );
      report.checks.push(
        await runCheck("report.getUtilizationTotalTestHours", function () {
          return runtime.report.getUtilizationTotalTestHours();
        }, summarizeStringMetric, { keepResult: true }),
      );
    }

    // Validate error detection results.
    report.discovered.errorType = detectedError ? detectedError.type : null;
    report.discovered.errorSummary = detectedError ? detectedError.summary : null;
    report.discovered.errorDetails = detectedError ? detectedError.details : null;
    report.counts.waitedMs = waitResult.waitedMs || 0;

    var inlineViewsCheck = findCheck(report.checks, "report.getInlineErrorLogViews");
    var inlineViews = inlineViewsCheck && Array.isArray(inlineViewsCheck.result)
      ? inlineViewsCheck.result
      : [];
    var inlineView = inlineViews.find(function (view) {
      return view && typeof view.itemCount === "number" && view.itemCount > 0;
    }) || inlineViews[0] || null;

    report.counts.inlineErrorLogViews = inlineViews.length;
    report.discovered.inlineErrorLogIndex = inlineView ? inlineView.index : null;
    report.discovered.inlineErrorLogItemCount = inlineView
      ? inlineView.itemCount
      : null;

    if (inlineView) {
      report.checks.push(
        await runCheck("report.readInlineErrorLog", function () {
          return runtime.report.readInlineErrorLog(inlineView.index, 10);
        }, summarizeEventList, { keepResult: true }),
      );

      var readInlineCheck = findCheck(report.checks, "report.readInlineErrorLog");
      var readInlineResult = readInlineCheck && readInlineCheck.result;
      var readInlineEvents = readInlineResult && Array.isArray(readInlineResult.events)
        ? readInlineResult.events
        : [];

      report.counts.inlineErrorLogVisibleEvents = readInlineEvents.length;
      report.discovered.firstInlineErrorLogEvent = readInlineEvents[0]
        ? {
            vtime: readInlineEvents[0].vtime,
            source: readInlineEvents[0].source,
            text: clean(readInlineEvents[0].text).slice(0, 160),
          }
        : null;

      if (inlineView.itemCount > 0 && readInlineEvents.length === 0) {
        report.warnings.push(
          "inline error log view was discovered but readInlineErrorLog returned zero events"
        );
      }

      report.checks.push(
        await runCheck("report.collectInlineErrorLog", function () {
          var options = {};
          if (typeof inlineView.itemCount === "number" && inlineView.itemCount > 0) {
            options.maxItems = Math.min(inlineView.itemCount, 50);
          }
          return runtime.report.collectInlineErrorLog(inlineView.index, options);
        }, summarizeEventList, { keepResult: true }),
      );

      var collectInlineCheck = findCheck(report.checks, "report.collectInlineErrorLog");
      var collectInlineResult = collectInlineCheck && collectInlineCheck.result;

      report.counts.inlineErrorLogCollectedEvents =
        collectInlineResult && typeof collectInlineResult.collectedCount === "number"
          ? collectInlineResult.collectedCount
          : 0;

      if (
        collectInlineResult &&
        typeof collectInlineResult.collectedCount === "number" &&
        collectInlineResult.collectedCount < readInlineEvents.length
      ) {
        report.warnings.push(
          "collectInlineErrorLog returned fewer events than readInlineErrorLog"
        );
      }
    } else if (detectedError) {
      report.warnings.push(
        "error report did not expose any inline error log panes"
      );
      report.checks.push(
        skipCheck(
          "report.readInlineErrorLog",
          "error report did not expose any inline error log panes",
        ),
      );
      report.checks.push(
        skipCheck(
          "report.collectInlineErrorLog",
          "error report did not expose any inline error log panes",
        ),
      );
    }

    if (!detectedError) {
      report.warnings.push(
        "no error detected on this report — it may have loaded normally"
      );
    }
    if (waitResult.waitedMs > 10000) {
      report.warnings.push(
        "waitForReady took " + waitResult.waitedMs +
        "ms — error short-circuit may not be working"
      );
    }

    return finalize(report);
  }

  async function auditLogs() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("logs");

    report.checks.push(
      await runCheck("logs.waitForReady", function () {
        return runtime.logs.waitForReady();
      }, summarizeWait),
    );
    report.checks.push(
      await runCheck("logs.loadingStatus", function () {
        return runtime.logs.loadingStatus();
      }, null, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("logs.getItemCount", function () {
        return runtime.logs.getItemCount();
      }, summarizeStringMetric, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("logs.readVisibleEvents", function () {
        return runtime.logs.readVisibleEvents(10);
      }, function (result) {
        return {
          count: Array.isArray(result) ? result.length : 0,
          firstEvent: Array.isArray(result) && result[0]
            ? {
                vtime: result[0].vtime,
                source: result[0].source,
                text: clean(result[0].text).slice(0, 160),
              }
            : null,
        };
      }, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("logs.collectEvents", function () {
        return runtime.logs.collectEvents({ maxItems: 50 });
      }, summarizeEventList, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("logs.findHighlightedEvent", function () {
        return runtime.logs.findHighlightedEvent();
      }, function (result) {
        if (!Array.isArray(result)) {
          return { value: result };
        }
        return {
          count: result.length,
          highlightedCount: result.filter(function (item) {
            return !!item.highlighted;
          }).length,
        };
      }, { keepResult: true }),
    );

    var itemCountCheck = findCheck(report.checks, "logs.getItemCount");
    var visibleEventsCheck = findCheck(report.checks, "logs.readVisibleEvents");
    var highlightedCheck = findCheck(report.checks, "logs.findHighlightedEvent");
    var collectedEventsCheck = findCheck(report.checks, "logs.collectEvents");

    var queryEvents = [];
    if (visibleEventsCheck && Array.isArray(visibleEventsCheck.result)) {
      queryEvents = queryEvents.concat(visibleEventsCheck.result);
    }
    if (
      collectedEventsCheck &&
      collectedEventsCheck.result &&
      Array.isArray(collectedEventsCheck.result.events)
    ) {
      queryEvents = queryEvents.concat(collectedEventsCheck.result.events);
    }
    var logsQuery = deriveLogsQuery(queryEvents);
    report.discovered.logsQuery = logsQuery || null;

    report.counts.itemCount = itemCountCheck
      ? summarizeStringMetric(itemCountCheck.result).numeric
      : null;
    report.counts.visibleEvents = visibleEventsCheck && Array.isArray(visibleEventsCheck.result)
      ? visibleEventsCheck.result.length
      : 0;
    report.counts.collectedEvents =
      collectedEventsCheck &&
      collectedEventsCheck.result &&
      typeof collectedEventsCheck.result.collectedCount === "number"
        ? collectedEventsCheck.result.collectedCount
        : 0;
    report.counts.highlightedWindow = highlightedCheck && Array.isArray(highlightedCheck.result)
      ? highlightedCheck.result.length
      : 0;

    if (logsQuery) {
      report.checks.push(
        await runCheck("logs.filter", async function () {
          runtime.logs.filter(logsQuery);
          await delay(250);

          var visible = runtime.logs.readVisibleEvents(10);

          return {
            query: logsQuery,
            filterValue: clean(
              document.querySelector(".sequence_filter__input") &&
                document.querySelector(".sequence_filter__input").value,
            ),
            itemCount: runtime.logs.getItemCount(),
            visibleEvents: visible,
          };
        }, function (result) {
          return {
            query: result.query,
            filterValue: result.filterValue,
            itemCount: result.itemCount,
            visibleEvents: Array.isArray(result.visibleEvents)
              ? result.visibleEvents.length
              : 0,
          };
        }, { keepResult: true }),
      );
      report.checks.push(
        await runCheck("logs.clearFilter", async function () {
          runtime.logs.clearFilter();
          await delay(250);

          var visible = runtime.logs.readVisibleEvents(10);

          return {
            filterValue: clean(
              document.querySelector(".sequence_filter__input") &&
                document.querySelector(".sequence_filter__input").value,
            ),
            itemCount: runtime.logs.getItemCount(),
            visibleEvents: visible,
          };
        }, function (result) {
          return {
            filterValue: result.filterValue,
            itemCount: result.itemCount,
            visibleEvents: Array.isArray(result.visibleEvents)
              ? result.visibleEvents.length
              : 0,
          };
        }, { keepResult: true }),
      );
      report.checks.push(
        await runCheck("logs.search", async function () {
          runtime.logs.search(logsQuery);
          await delay(250);

          return {
            query: logsQuery,
            searchValue: clean(
              document.querySelector(".sequence_search__input") &&
                document.querySelector(".sequence_search__input").value,
            ),
          };
        }, function (result) {
          return {
            query: result.query,
            searchValue: result.searchValue,
          };
        }, { keepResult: true }),
      );
    } else {
      report.checks.push(
        skipCheck(
          "logs.filter",
          "could not derive a stable search term from the visible log events",
        ),
      );
      report.checks.push(
        skipCheck(
          "logs.clearFilter",
          "could not derive a stable search term from the visible log events",
        ),
      );
      report.checks.push(
        skipCheck(
          "logs.search",
          "could not derive a stable search term from the visible log events",
        ),
      );
    }

    if (report.counts.visibleEvents === 0) {
      report.warnings.push("logs page returned zero visible events");
    }
    if (report.counts.collectedEvents === 0) {
      report.warnings.push("logs collector returned zero events");
    }

    return finalize(report);
  }

  if (!window.__antithesisTriage || typeof window.__antithesisTriage.info !== "function") {
    return {
      ok: false,
      error: "antithesis triage runtime is not loaded",
      url: window.location.href,
    };
  }

  var phase = window.__ANTITHESIS_TRIAGE_AUDIT_PHASE__ || currentPageType();

  if (phase === "runs") return auditRuns();
  if (phase === "report-core") return auditReportCore();
  if (phase === "report-properties") return auditReportProperties();
  if (phase === "report-examples") return auditReportExamples();
  if (phase === "report-error") return auditReportError();
  if (phase === "logs") return auditLogs();

  return {
    ok: false,
    error: "unsupported audit phase",
    phase: phase,
    pageType: currentPageType(),
    url: window.location.href,
  };
})();
