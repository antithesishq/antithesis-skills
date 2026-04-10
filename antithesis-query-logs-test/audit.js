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

  function isMethodError(result) {
    return isObject(result) && typeof result.error === "string";
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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

  function findCheck(checks, name) {
    return checks.find(function (check) {
      return check.name === name && check.ok;
    });
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
          status: "failed",
          durationMs: now() - startedAt,
          error: result.error,
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
      return {
        name: name,
        ok: false,
        status: "failed",
        durationMs: now() - startedAt,
        error: error && error.message ? error.message : String(error),
      };
    }
  }

  function makeReport(phase) {
    return {
      ok: true,
      phase: phase,
      url: window.location.href,
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

  // ---------------------------------------------------------------------------
  // Page inspection helpers
  // ---------------------------------------------------------------------------

  function getRunSelectorText() {
    var selector = document.querySelector(
      ".select_container.event_search_run_selector",
    );
    if (!selector) return null;
    return clean(selector.textContent);
  }

  function isRunSelected() {
    var text = getRunSelectorText();
    if (!text) return { selected: false, text: null, error: "run selector not found" };
    var isDefault =
      text.toLowerCase().includes("select run") ||
      text.toLowerCase().includes("select option");
    return { selected: !isDefault, text: text.substring(0, 200) };
  }

  function getPopulatedTextareas() {
    var textareas = Array.from(
      document.querySelectorAll("textarea.textarea_component"),
    );
    return {
      total: textareas.length,
      populated: textareas.filter(function (t) {
        return t.value.trim().length > 0;
      }).length,
      values: textareas.map(function (t) {
        return t.value.trim();
      }),
    };
  }

  function isTemporalBlockVisible() {
    // Look for temporal block indicators in the DOM
    var labels = Array.from(document.querySelectorAll("label, span, div"));
    var temporal = labels.find(function (el) {
      var text = clean(el.textContent).toLowerCase();
      return (
        text === "preceded by" ||
        text === "not preceded by" ||
        text === "followed by" ||
        text === "not followed by"
      );
    });
    return !!temporal;
  }

  function decodeSearchParam() {
    var param = new URLSearchParams(window.location.search).get("search");
    if (!param) return null;
    try {
      var b64 = param.slice(3); // strip "v5v"
      while (b64.length % 4) b64 += "=";
      return JSON.parse(atob(b64));
    } catch (e) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Deep diff for JSON comparison
  // ---------------------------------------------------------------------------

  function typeOf(v) {
    if (v === null) return "null";
    if (Array.isArray(v)) return "array";
    return typeof v;
  }

  function deepDiff(prefix, a, b) {
    var diffs = [];
    var tA = typeOf(a);
    var tB = typeOf(b);

    if (tA !== tB) {
      diffs.push({
        path: prefix,
        type: "type_mismatch",
        urlValue: a,
        uiValue: b,
        urlType: tA,
        uiType: tB,
      });
      return diffs;
    }

    if (tA !== "object" && tA !== "array") {
      if (a !== b) {
        diffs.push({
          path: prefix,
          type: "value_mismatch",
          urlValue: a,
          uiValue: b,
        });
      }
      return diffs;
    }

    if (tA === "array") {
      var maxLen = Math.max(
        (a || []).length,
        (b || []).length,
      );
      for (var i = 0; i < maxLen; i++) {
        var childPath = prefix + "[" + i + "]";
        if (i >= a.length) {
          diffs.push({
            path: childPath,
            type: "missing_in_url",
            uiValue: b[i],
          });
        } else if (i >= b.length) {
          diffs.push({
            path: childPath,
            type: "extra_in_url",
            urlValue: a[i],
          });
        } else {
          diffs = diffs.concat(deepDiff(childPath, a[i], b[i]));
        }
      }
      return diffs;
    }

    // Object
    var allKeys = {};
    Object.keys(a || {}).forEach(function (k) { allKeys[k] = true; });
    Object.keys(b || {}).forEach(function (k) { allKeys[k] = true; });

    Object.keys(allKeys).sort().forEach(function (key) {
      var childPath = prefix ? prefix + "." + key : key;
      if (!(key in a)) {
        diffs.push({
          path: childPath,
          type: "missing_in_url",
          uiValue: b[key],
        });
      } else if (!(key in b)) {
        diffs.push({
          path: childPath,
          type: "extra_in_url",
          urlValue: a[key],
        });
      } else {
        diffs = diffs.concat(deepDiff(childPath, a[key], b[key]));
      }
    });

    return diffs;
  }

  function generateHypotheses(diffs) {
    var hypotheses = [];

    var hasPDiff = diffs.some(function (d) { return d.path.startsWith("q.p"); });
    var hasYDiff = diffs.some(function (d) { return d.path === "q.n.y"; });
    var hasTDiff = diffs.some(function (d) { return d.path.startsWith("q.n.t"); });
    var hasSDiff = diffs.some(function (d) { return d.path === "s"; });
    var hasNDiff = diffs.some(function (d) {
      return d.path.startsWith("q.n.r") || d.path.startsWith("q.n.");
    });
    var pMissing = diffs.some(function (d) {
      return d.path === "q.p" && d.type === "missing_in_url";
    });
    var pExtra = diffs.some(function (d) {
      return d.path === "q.p" && d.type === "extra_in_url";
    });

    if (pMissing) {
      hypotheses.push(
        "URL builder omits q.p entirely — the temporal condition block is missing",
      );
    }
    if (pExtra) {
      hypotheses.push(
        "URL builder includes q.p but the platform does not expect it in this position",
      );
    }
    if (hasPDiff && !pMissing && !pExtra) {
      hypotheses.push(
        "q.p structure differs — the temporal condition block format has changed",
      );
    }
    if (hasYDiff) {
      hypotheses.push(
        "q.n.y value differs — the temporal type identifier may have changed format",
      );
    }
    if (hasTDiff) {
      hypotheses.push(
        "q.n.t (temporal window) differs — the time window format has changed",
      );
    }
    if (hasSDiff) {
      hypotheses.push(
        "Session ID differs — this may indicate a session encoding change",
      );
    }
    if (hasNDiff && !hasYDiff && !hasTDiff) {
      hypotheses.push(
        "Main query block (q.n.r) differs — condition wrapping or structure has changed",
      );
    }

    if (diffs.length === 0) {
      hypotheses.push(
        "JSON structures match exactly — the failure is not in the query format but in URL parsing or page initialization",
      );
    }

    return hypotheses;
  }

  // ---------------------------------------------------------------------------
  // Phase: setup
  // ---------------------------------------------------------------------------

  async function auditSetup() {
    var report = makeReport("setup");

    // This phase runs on the report page with the triage runtime.
    var triage = window.__antithesisTriage;
    if (!triage) {
      report.errors.push("triage runtime not loaded");
      report.ok = false;
      return report;
    }

    report.checks.push(
      await runCheck("setup.waitForReady", function () {
        return triage.report.waitForReady();
      }, function (r) {
        return { ok: r.ok, ready: r.ready, waitedMs: r.waitedMs };
      }),
    );

    report.checks.push(
      await runCheck("setup.getAllProperties", function () {
        return triage.report.getAllProperties();
      }, function (r) {
        var failed = (r.properties || []).filter(function (p) {
          return p.status === "failed";
        });
        return {
          count: failed.length,
          firstName: failed.length > 0 ? failed[0].name : null,
        };
      }, { keepResult: true }),
    );

    var allCheck = findCheck(report.checks, "setup.getAllProperties");
    var failedProps = allCheck && allCheck.result
      ? (allCheck.result.properties || []).filter(function (p) {
          return p.status === "failed";
        })
      : [];

    if (failedProps.length === 0) {
      report.errors.push("no failed properties found — cannot test queries");
      return finalize(report);
    }

    report.discovered.failingPropertyName = failedProps[0].name;
    report.discovered.secondFailingPropertyName =
      failedProps.length > 1 ? failedProps[1].name : null;
    report.counts.failedProperties = failedProps.length;

    // Extract the "Explore logs" link
    report.checks.push(
      await runCheck("setup.extractExploreLogsUrl", function () {
        var link = document.querySelector('a.an-button[href*="/search"]');
        if (!link) return { error: "Explore logs link not found on report page" };
        return { url: link.href };
      }, function (r) {
        return { url: r.url ? r.url.substring(0, 100) + "..." : null };
      }, { keepResult: true }),
    );

    var logsLinkCheck = findCheck(report.checks, "setup.extractExploreLogsUrl");
    if (logsLinkCheck && logsLinkCheck.result) {
      report.discovered.exploreLogsUrl = logsLinkCheck.result.url;
    }

    // Extract session ID from the explore logs URL
    report.checks.push(
      await runCheck("setup.extractSessionId", function () {
        var link = document.querySelector('a.an-button[href*="/search"]');
        if (!link) return { error: "Explore logs link not found" };
        try {
          var url = new URL(link.href);
          var param = url.searchParams.get("search");
          if (!param) return { error: "no search param in explore logs URL" };
          var b64 = param.slice(3);
          while (b64.length % 4) b64 += "=";
          var decoded = JSON.parse(atob(b64));
          if (!decoded.s) return { error: "no session ID in decoded query" };
          return { sessionId: decoded.s };
        } catch (e) {
          return { error: "failed to decode explore logs URL: " + e.message };
        }
      }, function (r) {
        return { sessionId: r.sessionId ? r.sessionId.substring(0, 40) + "..." : null };
      }, { keepResult: true }),
    );

    var sessionCheck = findCheck(report.checks, "setup.extractSessionId");
    if (sessionCheck && sessionCheck.result) {
      report.discovered.sessionId = sessionCheck.result.sessionId;
    }

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: simple-url
  // ---------------------------------------------------------------------------

  async function auditSimpleUrl() {
    var report = makeReport("simple-url");
    var runtime = window.__antithesisQueryLogs;

    if (!runtime) {
      report.errors.push("query-logs runtime not loaded");
      report.ok = false;
      return report;
    }

    // Check run selector
    report.checks.push(
      await runCheck("simple-url.runSelector", function () {
        var result = isRunSelected();
        if (!result.selected) {
          return { error: "run not selected: " + (result.text || result.error) };
        }
        return result;
      }, function (r) {
        return { selected: r.selected, text: r.text };
      }),
    );

    // Check query fields populated
    report.checks.push(
      await runCheck("simple-url.queryFields", function () {
        var fields = getPopulatedTextareas();
        if (fields.populated === 0) {
          return { error: "no textareas populated — URL was not parsed by the page" };
        }
        return fields;
      }, function (r) {
        return { total: r.total, populated: r.populated };
      }, { keepResult: true }),
    );

    // Decode the URL for reference
    report.checks.push(
      await runCheck("simple-url.decodeUrl", function () {
        var decoded = decodeSearchParam();
        if (!decoded) return { error: "could not decode search URL parameter" };
        return { decoded: decoded };
      }, null, { keepResult: true }),
    );

    if (findCheck(report.checks, "simple-url.decodeUrl")) {
      var decoded = findCheck(report.checks, "simple-url.decodeUrl").result;
      if (decoded) report.discovered.simpleUrlDecoded = decoded.decoded;
    }

    // Search
    report.checks.push(
      await runCheck("simple-url.search", function () {
        return runtime.search(30000);
      }, function (r) {
        return { count: r.count };
      }, { keepResult: true }),
    );

    // Result count
    var searchCheck = findCheck(report.checks, "simple-url.search");
    if (searchCheck && searchCheck.result) {
      report.counts.simpleUrlResultCount = searchCheck.result.count || 0;
      report.discovered.simpleUrlResultCount = searchCheck.result.count || 0;
    }

    // Read a few results
    report.checks.push(
      await runCheck("simple-url.readResults", function () {
        return runtime.readResults(3);
      }, function (r) {
        var results = Array.isArray(r) ? r : r.results || [];
        return { count: results.length };
      }),
    );

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: temporal-url
  // ---------------------------------------------------------------------------

  async function auditTemporalUrl() {
    var report = makeReport("temporal-url");
    var runtime = window.__antithesisQueryLogs;

    if (!runtime) {
      report.errors.push("query-logs runtime not loaded");
      report.ok = false;
      return report;
    }

    // Check run selector — this is the primary failure symptom
    var runSel = isRunSelected();
    report.checks.push({
      name: "temporal-url.runSelector",
      ok: runSel.selected,
      status: runSel.selected ? "passed" : "failed",
      durationMs: 0,
      error: runSel.selected ? null : "run not selected: " + (runSel.text || runSel.error),
      summary: { selected: runSel.selected, text: runSel.text },
    });
    report.discovered.temporalUrlRunSelectorText = runSel.text;

    // Check query fields
    var fields = getPopulatedTextareas();
    report.checks.push({
      name: "temporal-url.queryFields",
      ok: fields.populated > 0,
      status: fields.populated > 0 ? "passed" : "failed",
      durationMs: 0,
      error: fields.populated === 0
        ? "no textareas populated — temporal URL was not parsed"
        : null,
      summary: { total: fields.total, populated: fields.populated, values: fields.values },
    });
    report.discovered.temporalUrlFieldsPopulated = fields.populated;

    // Check temporal block visibility
    var temporalVisible = isTemporalBlockVisible();
    report.checks.push({
      name: "temporal-url.temporalBlockPresent",
      ok: true, // informational, not a pass/fail
      status: "passed",
      durationMs: 0,
      summary: { temporalBlockVisible: temporalVisible },
    });

    // Decode the URL
    report.checks.push(
      await runCheck("temporal-url.decodeUrl", function () {
        var decoded = decodeSearchParam();
        if (!decoded) return { error: "could not decode search URL parameter" };
        return { decoded: decoded };
      }, null, { keepResult: true }),
    );

    var decodeCheck = findCheck(report.checks, "temporal-url.decodeUrl");
    if (decodeCheck && decodeCheck.result) {
      report.discovered.temporalUrlDecoded = decodeCheck.result.decoded;
    }

    // Attempt search
    if (runSel.selected && fields.populated > 0) {
      report.checks.push(
        await runCheck("temporal-url.search", function () {
          return runtime.search(30000);
        }, function (r) {
          return { count: r.count };
        }, { keepResult: true }),
      );

      var searchCheck = findCheck(report.checks, "temporal-url.search");
      report.discovered.temporalUrlResultCount =
        searchCheck && searchCheck.result ? searchCheck.result.count || 0 : 0;
    } else {
      report.checks.push(
        skipCheck("temporal-url.search", "skipped because run selector or fields not populated"),
      );
      report.discovered.temporalUrlResultCount = null;
    }

    // Determine overall success
    report.discovered.temporalUrlWorked =
      runSel.selected && fields.populated > 0 &&
      report.discovered.temporalUrlResultCount !== null &&
      report.discovered.temporalUrlResultCount >= 0;

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: temporal-ui
  // ---------------------------------------------------------------------------

  async function auditTemporalUi() {
    var report = makeReport("temporal-ui");
    var runtime = window.__antithesisQueryLogs;

    if (!runtime) {
      report.errors.push("query-logs runtime not loaded");
      report.ok = false;
      return report;
    }

    var propertyName = window.__ANTITHESIS_QUERY_LOGS_PROPERTY_NAME__ || "";
    var temporalPropertyName = window.__ANTITHESIS_QUERY_LOGS_TEMPORAL_PROPERTY_NAME__ || "";
    if (!propertyName) {
      report.errors.push("property name not set — cannot build UI query");
      report.ok = false;
      return report;
    }
    if (!temporalPropertyName) {
      report.errors.push("temporal property name not set — cannot build temporal condition");
      report.ok = false;
      return report;
    }

    // Verify we're on a clean Logs Explorer with run selected
    report.checks.push(
      await runCheck("temporal-ui.pageReady", function () {
        var runSel = isRunSelected();
        if (!runSel.selected) {
          return { error: "run not selected on Logs Explorer: " + (runSel.text || runSel.error) };
        }
        return { runSelected: true, text: runSel.text };
      }, function (r) {
        return { text: r.text };
      }),
    );

    if (!findCheck(report.checks, "temporal-ui.pageReady")) {
      return finalize(report);
    }

    // Set main query: assertion.message contains <property>
    report.checks.push(
      await runCheck("temporal-ui.setMainQuery", async function () {
        // Set first textarea to property name
        var result1 = runtime.setQueryValue(0, propertyName);
        if (isMethodError(result1)) return result1;

        // Add AND row
        var addResult = runtime.addAndRow();
        if (isMethodError(addResult)) return addResult;
        await delay(500);

        // Set second textarea to "failing"
        var result2 = runtime.setQueryValue(1, "failing");
        if (isMethodError(result2)) return result2;

        return { ok: true, property: propertyName };
      }, function (r) {
        return { property: r.property };
      }),
    );

    // Add preceded by temporal block
    report.checks.push(
      await runCheck("temporal-ui.addPrecededBy", async function () {
        var result = runtime.addPrecededBy();
        if (isMethodError(result)) return result;
        await delay(500);
        return { ok: true };
      }, null),
    );

    // Switch to "Not preceded by"
    report.checks.push(
      await runCheck("temporal-ui.switchToNotPrecededBy", async function () {
        var result = runtime.switchToNotPrecededBy();
        if (isMethodError(result)) return result;
        await delay(500);
        return { ok: true };
      }, null),
    );

    // Set temporal condition field to the SECOND property
    report.checks.push(
      await runCheck("temporal-ui.setTemporalQuery", async function () {
        // Find the temporal block's textarea and set it
        var textareas = Array.from(
          document.querySelectorAll("textarea.textarea_component"),
        );
        // The temporal textarea should be the last one added
        var lastTextarea = textareas[textareas.length - 1];
        if (!lastTextarea) return { error: "no textarea found for temporal condition" };
        lastTextarea.value = temporalPropertyName;
        lastTextarea.dispatchEvent(new Event("input", { bubbles: true }));
        lastTextarea.dispatchEvent(new Event("change", { bubbles: true }));
        await delay(300);
        return { ok: true, value: temporalPropertyName };
      }, function (r) {
        return { value: r.value };
      }),
    );

    // Execute search
    report.checks.push(
      await runCheck("temporal-ui.search", async function () {
        return runtime.search(30000);
      }, function (r) {
        return { count: r.count };
      }, { keepResult: true }),
    );

    var searchCheck = findCheck(report.checks, "temporal-ui.search");
    report.discovered.uiTemporalResultCount =
      searchCheck && searchCheck.result ? searchCheck.result.count || 0 : null;

    // Capture the URL the platform generated
    report.checks.push(
      await runCheck("temporal-ui.captureUrl", function () {
        var decoded = decodeSearchParam();
        var url = window.location.href;
        return {
          url: url,
          decoded: decoded,
          hasSearchParam: url.includes("search="),
        };
      }, function (r) {
        return {
          hasSearchParam: r.hasSearchParam,
          hasDecoded: !!r.decoded,
        };
      }, { keepResult: true }),
    );

    var captureCheck = findCheck(report.checks, "temporal-ui.captureUrl");
    if (captureCheck && captureCheck.result) {
      report.discovered.uiTemporalUrl = captureCheck.result.url;
      report.discovered.uiTemporalDecoded = captureCheck.result.decoded;
    }

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: diagnostic
  // ---------------------------------------------------------------------------

  async function auditDiagnostic() {
    var report = makeReport("diagnostic");

    var data = window.__ANTITHESIS_QUERY_LOGS_DIAGNOSTIC_DATA__ || {};
    var urlDecoded = data.temporalUrlDecoded || null;
    var uiDecoded = data.uiTemporalDecoded || null;

    report.checks.push({
      name: "diagnostic.urlDecoded",
      ok: !!urlDecoded,
      status: urlDecoded ? "passed" : "failed",
      durationMs: 0,
      error: urlDecoded ? null : "URL-constructed temporal query JSON not available",
      summary: urlDecoded ? { keys: Object.keys(urlDecoded) } : null,
    });

    report.checks.push({
      name: "diagnostic.uiDecoded",
      ok: !!uiDecoded,
      status: uiDecoded ? "passed" : "failed",
      durationMs: 0,
      error: uiDecoded ? null : "UI-generated temporal query JSON not available",
      summary: uiDecoded ? { keys: Object.keys(uiDecoded) } : null,
    });

    if (!urlDecoded || !uiDecoded) {
      report.checks.push(
        skipCheck("diagnostic.structuralDiff", "one or both decoded JSONs not available"),
      );
      report.checks.push(
        skipCheck("diagnostic.hypothesis", "cannot generate hypotheses without both JSONs"),
      );
      report.warnings.push(
        "diagnostic comparison skipped — need both URL and UI decoded JSONs",
      );
      return finalize(report);
    }

    // Deep diff
    var diffs = deepDiff("", urlDecoded, uiDecoded);

    report.checks.push({
      name: "diagnostic.structuralDiff",
      ok: true,
      status: "passed",
      durationMs: 0,
      summary: {
        totalDifferences: diffs.length,
        match: diffs.length === 0,
      },
    });

    report.discovered.differences = diffs;
    report.discovered.jsonMatch = diffs.length === 0;
    report.counts.totalDifferences = diffs.length;

    // Categorize diffs
    var missingInUrl = diffs.filter(function (d) { return d.type === "missing_in_url"; });
    var extraInUrl = diffs.filter(function (d) { return d.type === "extra_in_url"; });
    var valueMismatches = diffs.filter(function (d) { return d.type === "value_mismatch"; });
    var typeMismatches = diffs.filter(function (d) { return d.type === "type_mismatch"; });

    report.counts.missingInUrl = missingInUrl.length;
    report.counts.extraInUrl = extraInUrl.length;
    report.counts.valueMismatches = valueMismatches.length;
    report.counts.typeMismatches = typeMismatches.length;

    // Generate hypotheses
    var hypotheses = generateHypotheses(diffs);

    report.checks.push({
      name: "diagnostic.hypothesis",
      ok: true,
      status: "passed",
      durationMs: 0,
      summary: {
        hypotheses: hypotheses,
      },
    });

    report.discovered.hypotheses = hypotheses;

    // Store both JSONs for reference
    report.discovered.urlJson = urlDecoded;
    report.discovered.uiJson = uiDecoded;

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase dispatch
  // ---------------------------------------------------------------------------

  var phase = window.__ANTITHESIS_QUERY_LOGS_AUDIT_PHASE__ || "unknown";

  if (phase === "setup") return auditSetup();
  if (phase === "simple-url") return auditSimpleUrl();
  if (phase === "temporal-url") return auditTemporalUrl();
  if (phase === "temporal-url-retry") return auditTemporalUrl();
  if (phase === "temporal-ui") return auditTemporalUi();
  if (phase === "diagnostic") return auditDiagnostic();

  return {
    ok: false,
    error: "unsupported audit phase",
    phase: phase,
    url: window.location.href,
  };
})();
