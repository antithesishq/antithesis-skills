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
          return !!run.triageUrl;
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
      return !!run.triageUrl;
    });

    report.counts.totalRuns = runs.length;
    report.counts.completedReports = runs.filter(function (run) {
      return !!run.triageUrl;
    }).length;
    report.discovered.latestCompletedReportUrl = latestCompleted
      ? latestCompleted.triageUrl
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

    var expandedCheck = report.checks.find(function (check) {
      return check.name === "report.expandFailedExamples" && check.ok;
    });
    var urlsCheck = report.checks.find(function (check) {
      return check.name === "report.getExampleUrls" && check.ok;
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
    report.discovered.firstExampleLogsUrl = urlsCheck
      ? firstNonEmptyLogsUrl(urlsCheck.result)
      : null;

    if (!report.discovered.firstExampleLogsUrl) {
      report.warnings.push("report did not expose an example logs url");
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
  if (phase === "logs") return auditLogs();

  return {
    ok: false,
    error: "unsupported audit phase",
    phase: phase,
    pageType: currentPageType(),
    url: window.location.href,
  };
})();
