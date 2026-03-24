(async function () {
  function now() {
    return Date.now();
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isMethodError(result) {
    return isObject(result) && typeof result.error === "string";
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
      ok: !!result.ok,
      ready: !!result.ready,
      attempts: result.attempts,
      waitedMs: result.waitedMs,
    };
  }

  function summarizeProperties(result) {
    return {
      expectedCount: result.expectedCount,
      propertyCount: Array.isArray(result.properties) ? result.properties.length : 0,
      counts: result.counts || null,
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

  function firstNonEmptyLogsUrl(exampleUrls) {
    if (!Array.isArray(exampleUrls)) return null;
    var row = exampleUrls.find(function (item) {
      return item && typeof item.logsUrl === "string" && item.logsUrl !== "";
    });
    return row ? row.logsUrl : null;
  }

  async function runCheck(name, fn, summarize, options) {
    var startedAt = now();
    var keepResult = !!(options && options.keepResult);

    try {
      var result = await fn();
      if (isMethodError(result)) {
        return {
          name: name,
          ok: false,
          durationMs: now() - startedAt,
          error: result.error,
          result: keepResult ? clone(result) : undefined,
        };
      }

      return {
        name: name,
        ok: true,
        durationMs: now() - startedAt,
        summary: summarize ? summarize(result) : null,
        result: keepResult ? clone(result) : undefined,
      };
    } catch (error) {
      return {
        name: name,
        ok: false,
        durationMs: now() - startedAt,
        error: error && error.message ? error.message : String(error),
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
          return !!run.triageUrl && /\bcompleted\b/i.test(run.status);
        });
        return {
          count: result.count,
          completedReports: completed.length,
          latestCompletedReportUrl: completed[0] ? completed[0].triageUrl : null,
        };
      }, { keepResult: true }),
    );

    var runsCheck = report.checks.find(function (check) {
      return check.name === "runs.getRecentRuns" && check.ok;
    });
    var runs = runsCheck && runsCheck.result && Array.isArray(runsCheck.result.runs)
      ? runsCheck.result.runs
      : [];
    var latestCompleted = runs.find(function (run) {
      return !!run.triageUrl && /\bcompleted\b/i.test(run.status);
    });
    var latestIncomplete = runs.find(function (run) {
      return !!run.triageUrl && /\bincomplete\b/i.test(run.status);
    });

    report.counts.totalRuns = runs.length;
    report.counts.completedReports = runs.filter(function (run) {
      return !!run.triageUrl && /\bcompleted\b/i.test(run.status);
    }).length;
    report.counts.incompleteReports = runs.filter(function (run) {
      return !!run.triageUrl && /\bincomplete\b/i.test(run.status);
    }).length;
    report.discovered.latestCompletedReportUrl = latestCompleted
      ? latestCompleted.triageUrl
      : null;
    report.discovered.latestIncompleteReportUrl = latestIncomplete
      ? latestIncomplete.triageUrl
      : null;

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

    var metadataCheck = report.checks.find(function (check) {
      return check.name === "report.getRunMetadata" && check.ok;
    });
    var imagesCheck = report.checks.find(function (check) {
      return check.name === "report.getEnvironmentSourceImages" && check.ok;
    });
    var findingsCheck = report.checks.find(function (check) {
      return check.name === "report.getFindingsGrouped" && check.ok;
    });

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
      }, summarizeProperties),
    );
    report.checks.push(
      await runCheck("report.getFailedProperties", function () {
        return runtime.report.getFailedProperties();
      }, summarizeProperties),
    );
    report.checks.push(
      await runCheck("report.getPassedProperties", function () {
        return runtime.report.getPassedProperties();
      }, summarizeProperties),
    );
    report.checks.push(
      await runCheck("report.getUnfoundProperties", function () {
        return runtime.report.getUnfoundProperties();
      }, summarizeProperties),
    );

    function propertyCount(checkName) {
      var check = report.checks.find(function (c) {
        return c.name === checkName;
      });
      return check && check.summary ? check.summary.propertyCount : 0;
    }

    report.counts.totalProperties = propertyCount("report.getAllProperties");
    report.counts.failedProperties = propertyCount("report.getFailedProperties");
    report.counts.passedProperties = propertyCount("report.getPassedProperties");
    report.counts.unfoundProperties = propertyCount("report.getUnfoundProperties");

    if (report.counts.totalProperties === 0) {
      report.warnings.push("report returned zero properties");
    }

    return finalize(report);
  }

  async function auditReportExamples() {
    var runtime = window.__antithesisTriage;
    var report = makeReport("report-examples");

    report.checks.push(
      await runCheck("report.expandFailedExamples", function () {
        return runtime.report.expandFailedExamples();
      }, function (result) {
        return {
          expandedProperties: Array.isArray(result.expandedProperties)
            ? result.expandedProperties.length
            : 0,
          totalExampleRows: result.totalExampleRows || 0,
        };
      }, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("report.getExampleUrls", function () {
        return runtime.report.getExampleUrls();
      }, function (result) {
        return {
          count: Array.isArray(result) ? result.length : 0,
          firstLogsUrl: firstNonEmptyLogsUrl(result),
        };
      }, { keepResult: true }),
    );

    report.checks.push(
      await runCheck("report.getFailedPropertyExamples", function () {
        return runtime.report.getFailedPropertyExamples();
      }, function (result) {
        var properties = Array.isArray(result.properties) ? result.properties : [];
        return {
          propertyCount: properties.length,
          totalExamples: result.totalExamples || 0,
          firstProperty: properties.length > 0
            ? { group: properties[0].group, name: properties[0].name, examples: properties[0].examples.length }
            : null,
        };
      }, { keepResult: true }),
    );

    var expandedCheck = report.checks.find(function (check) {
      return check.name === "report.expandFailedExamples" && check.ok;
    });
    var urlsCheck = report.checks.find(function (check) {
      return check.name === "report.getExampleUrls" && check.ok;
    });
    var propertyExamplesCheck = report.checks.find(function (check) {
      return check.name === "report.getFailedPropertyExamples" && check.ok;
    });

    report.counts.expandedProperties = expandedCheck && expandedCheck.result
      ? Array.isArray(expandedCheck.result.expandedProperties)
        ? expandedCheck.result.expandedProperties.length
        : 0
      : 0;
    report.counts.totalExampleRows = expandedCheck && expandedCheck.result
      ? expandedCheck.result.totalExampleRows || 0
      : 0;
    report.counts.exampleUrls = urlsCheck && Array.isArray(urlsCheck.result)
      ? urlsCheck.result.length
      : 0;
    report.counts.exampleLogsUrls = urlsCheck && Array.isArray(urlsCheck.result)
      ? urlsCheck.result.filter(function (item) {
          return !!(item && item.logsUrl);
        }).length
      : 0;
    report.counts.failedPropertyExamples = propertyExamplesCheck && propertyExamplesCheck.result
      ? propertyExamplesCheck.result.totalExamples || 0
      : 0;
    report.discovered.firstExampleLogsUrl = urlsCheck
      ? firstNonEmptyLogsUrl(urlsCheck.result)
      : null;
    if (!report.discovered.firstExampleLogsUrl && propertyExamplesCheck && propertyExamplesCheck.result) {
      var properties = propertyExamplesCheck.result.properties || [];
      for (var pi = 0; pi < properties.length; pi++) {
        var examples = properties[pi].examples || [];
        for (var ei = 0; ei < examples.length; ei++) {
          if (examples[ei].logsUrl) {
            report.discovered.firstExampleLogsUrl = examples[ei].logsUrl;
            break;
          }
        }
        if (report.discovered.firstExampleLogsUrl) break;
      }
    }

    if (!report.discovered.firstExampleLogsUrl) {
      report.warnings.push("report did not expose an example logs url");
    }

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

    var itemCountCheck = report.checks.find(function (check) {
      return check.name === "logs.getItemCount" && check.ok;
    });
    var visibleEventsCheck = report.checks.find(function (check) {
      return check.name === "logs.readVisibleEvents" && check.ok;
    });
    var highlightedCheck = report.checks.find(function (check) {
      return check.name === "logs.findHighlightedEvent" && check.ok;
    });

    report.counts.itemCount = itemCountCheck
      ? summarizeStringMetric(itemCountCheck.result).numeric
      : null;
    report.counts.visibleEvents = visibleEventsCheck && Array.isArray(visibleEventsCheck.result)
      ? visibleEventsCheck.result.length
      : 0;
    report.counts.highlightedWindow = highlightedCheck && Array.isArray(highlightedCheck.result)
      ? highlightedCheck.result.length
      : 0;

    if (report.counts.visibleEvents === 0) {
      report.warnings.push("logs page returned zero visible events");
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
