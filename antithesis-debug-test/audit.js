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

  function summarizeWait(result) {
    return {
      ok: !!result.ok,
      ready: !!result.ready,
      attempts: result.attempts,
      waitedMs: result.waitedMs,
    };
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
      url: window.location.href,
      runtimeInfo: window.__antithesisDebug.info(),
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
  // Phase: notebook-load
  // ---------------------------------------------------------------------------

  async function auditNotebookLoad() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("notebook-load");

    report.checks.push(
      await runCheck("notebook.waitForReady", function () {
        return runtime.notebook.waitForReady();
      }, summarizeWait),
    );
    report.checks.push(
      await runCheck("notebook.loadingStatus", function () {
        return runtime.notebook.loadingStatus();
      }, null, { keepResult: true }),
    );
    report.checks.push(
      await runCheck("notebook.loadingFinished", function () {
        var result = runtime.notebook.loadingFinished();
        if (result === true) return { finished: true };
        return { error: "loadingFinished returned " + String(result) };
      }, function (result) {
        return { finished: result.finished };
      }),
    );
    report.checks.push(
      await runCheck("notebook.getSource", function () {
        return runtime.notebook.getSource();
      }, function (result) {
        return {
          length: result.length,
          preview: (result.source || "").substring(0, 200),
          hasPrepareCall: /prepare_multiverse_debugging/.test(result.source || ""),
        };
      }),
    );
    report.checks.push(
      await runCheck("notebook.getCells", function () {
        return runtime.notebook.getCells();
      }, function (result) {
        return {
          count: Array.isArray(result) ? result.length : 0,
          actionCells: Array.isArray(result)
            ? result.filter(function (c) { return c.hasAction; }).length
            : 0,
          visibleCells: Array.isArray(result)
            ? result.filter(function (c) { return c.visible; }).length
            : 0,
        };
      }),
    );
    report.checks.push(
      await runCheck("notebook.getCellCount", function () {
        var count = runtime.notebook.getCellCount();
        return { count: count };
      }, function (result) {
        return { count: result.count };
      }),
    );

    var sourceCheck = report.checks.find(function (c) {
      return c.name === "notebook.getSource" && c.ok;
    });
    var cellsCheck = report.checks.find(function (c) {
      return c.name === "notebook.getCells" && c.ok;
    });

    report.counts.sourceLength = sourceCheck && sourceCheck.summary
      ? sourceCheck.summary.length
      : 0;
    report.counts.cellCount = cellsCheck && cellsCheck.summary
      ? cellsCheck.summary.count
      : 0;
    report.counts.actionCells = cellsCheck && cellsCheck.summary
      ? cellsCheck.summary.actionCells
      : 0;
    report.discovered.hasPrepareCall = sourceCheck && sourceCheck.summary
      ? sourceCheck.summary.hasPrepareCall
      : false;

    if (report.counts.sourceLength === 0) {
      report.warnings.push("editor source is empty");
    }
    if (report.counts.cellCount === 0) {
      report.warnings.push("no cells rendered");
    }

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: notebook-write
  // ---------------------------------------------------------------------------

  async function auditNotebookWrite() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("notebook-write");

    var originalResult = runtime.notebook.getSource();
    if (isMethodError(originalResult)) {
      report.errors.push("cannot read original source: " + originalResult.error);
      return finalize(report);
    }
    var originalSource = originalResult.source;
    report.discovered.originalSourceLength = originalSource.length;

    var marker = "// __AUDIT_MARKER_" + Date.now() + "__";
    report.checks.push(
      await runCheck("notebook.appendSource", function () {
        return runtime.notebook.appendSource(marker);
      }, function (result) {
        return { ok: result.ok, appended: result.appended, length: result.length };
      }),
    );

    report.checks.push(
      await runCheck("notebook.getSource (after append)", function () {
        var result = runtime.notebook.getSource();
        if (isMethodError(result)) return result;
        if ((result.source || "").indexOf(marker) < 0) {
          return { error: "appended marker not found in source" };
        }
        return result;
      }, function (result) {
        return { length: result.length, containsMarker: true };
      }),
    );

    report.checks.push(
      await runCheck("notebook.setSource (restore)", function () {
        return runtime.notebook.setSource(originalSource);
      }, function (result) {
        return { ok: result.ok, length: result.length };
      }),
    );

    report.checks.push(
      await runCheck("notebook.getSource (after restore)", function () {
        var result = runtime.notebook.getSource();
        if (isMethodError(result)) return result;
        if (result.source !== originalSource) {
          return { error: "source does not match original after restore" };
        }
        return result;
      }, function (result) {
        return { length: result.length, matchesOriginal: true };
      }),
    );

    report.counts.appendChecks = report.checks.length;

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-list
  // List existing actions from the seeded notebook. Fast, no side effects.
  // ---------------------------------------------------------------------------

  async function auditActionsList() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-list");

    report.checks.push(
      await runCheck("actions.getAll", function () {
        return runtime.actions.getAll();
      }, function (result) {
        return {
          count: Array.isArray(result) ? result.length : 0,
          authorized: Array.isArray(result)
            ? result.filter(function (a) { return a.authorized; }).length
            : 0,
          completed: Array.isArray(result)
            ? result.filter(function (a) { return a.completed; }).length
            : 0,
        };
      }, { keepResult: true }),
    );

    var actionsCheck = report.checks.find(function (c) {
      return c.name === "actions.getAll" && c.ok;
    });
    report.counts.totalActions = actionsCheck && Array.isArray(actionsCheck.result)
      ? actionsCheck.result.length
      : 0;
    report.discovered.actions = actionsCheck ? actionsCheck.result : [];

    if (report.counts.totalActions === 0) {
      report.warnings.push("no action cells found in seeded notebook");
    }

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-inject
  // Inject a debug cell into the notebook. Returns immediately.
  // ---------------------------------------------------------------------------

  async function auditActionsInject() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-inject");

    var tag = window.__ANTITHESIS_DEBUG_AUDIT_TAG__ || ("__AUDIT_" + Date.now());
    var inspectCell =
      "\n// " + tag + "\n" +
      "inspect_branch = moment.branch()\n" +
      "print(bash`echo " + tag + "`.run({branch: inspect_branch, container: containers[0]?.name ?? \"workload\"}))\n";

    report.checks.push(
      await runCheck("notebook.appendSource (inject)", function () {
        return runtime.notebook.appendSource(inspectCell);
      }, function (result) {
        return { ok: result.ok, appended: result.appended };
      }),
    );

    report.discovered.tag = tag;
    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-settle
  // Wait for the injected cell to appear as an action. Quick poll.
  // ---------------------------------------------------------------------------

  async function auditActionsSettle() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-settle");

    var tag = window.__ANTITHESIS_DEBUG_AUDIT_TAG__ || "";

    report.checks.push(
      await runCheck("actions.getAll (after inject)", function () {
        return runtime.actions.getAll();
      }, function (result) {
        var found = Array.isArray(result) && result.some(function (a) {
          return a.buttonText.includes(tag);
        });
        return {
          count: Array.isArray(result) ? result.length : 0,
          tagFound: found,
        };
      }, { keepResult: true }),
    );

    var actionsCheck = report.checks.find(function (c) {
      return c.name === "actions.getAll (after inject)" && c.ok;
    });
    var actions = actionsCheck && Array.isArray(actionsCheck.result) ? actionsCheck.result : [];
    var tagAction = actions.find(function (a) { return a.buttonText.includes(tag); });

    report.counts.actionsAfterInject = actions.length;
    report.discovered.tagCellIndex = tagAction ? tagAction.cellIndex : null;
    report.discovered.tagFound = !!tagAction;

    if (!tagAction) {
      report.warnings.push("injected cell not found as action after settle");
    }

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-authorize
  // Authorize the injected cell. Returns immediately after click.
  // ---------------------------------------------------------------------------

  async function auditActionsAuthorize() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-authorize");

    var tag = window.__ANTITHESIS_DEBUG_AUDIT_TAG__ || "";

    report.checks.push(
      await runCheck("actions.authorizeByContent", function () {
        return runtime.actions.authorizeByContent(tag);
      }, function (result) {
        return { clicked: result.clicked };
      }, { keepResult: true }),
    );

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-result
  // Poll for the action result. Bounded to 20s to stay under CDP timeout.
  // ---------------------------------------------------------------------------

  async function auditActionsResult() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-result");

    var tag = window.__ANTITHESIS_DEBUG_AUDIT_TAG__ || "";

    // waitForResult may time out if the container doesn't exist or the command
    // takes too long — that is a valid observation, not a test failure. We wrap
    // it so a timeout still produces an ok check with details.
    report.checks.push(
      await runCheck("actions.waitForResult", function () {
        return runtime.actions.waitForResult(tag, { timeoutMs: 20000 }).then(function (result) {
          // A timeout is still useful information — return it as ok with details.
          if (!result.ok) {
            return {
              ok: true,
              timedOut: true,
              authorized: result.authorized,
              waitedMs: result.waitedMs,
            };
          }
          return result;
        });
      }, function (result) {
        return {
          ok: result.ok,
          timedOut: !!result.timedOut,
          statusLabel: result.statusLabel,
          eventCount: result.eventCount,
          eventsPreview: result.events ? result.events.slice(0, 3) : [],
          waitedMs: result.waitedMs,
        };
      }, { keepResult: true }),
    );

    // Also read cells for final state.
    report.checks.push(
      await runCheck("notebook.getCells (final)", function () {
        return runtime.notebook.getCells();
      }, function (result) {
        return {
          count: Array.isArray(result) ? result.length : 0,
          actionCells: Array.isArray(result)
            ? result.filter(function (c) { return c.hasAction; }).length
            : 0,
          completedActions: Array.isArray(result)
            ? result.filter(function (c) { return c.actionCompleted; }).length
            : 0,
        };
      }, { keepResult: true }),
    );

    var waitCheck = report.checks.find(function (c) {
      return c.name === "actions.waitForResult" && c.ok;
    });
    report.discovered.actionOutput = waitCheck ? waitCheck.result : null;
    report.counts.finalCells = report.checks.find(function (c) {
      return c.name === "notebook.getCells (final)" && c.ok;
    }) ? report.checks.find(function (c) {
      return c.name === "notebook.getCells (final)" && c.ok;
    }).summary.count : 0;

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Phase: actions-getresult
  // Use the non-polling getResult to read an already-completed action.
  // ---------------------------------------------------------------------------

  async function auditActionsGetResult() {
    var runtime = window.__antithesisDebug;
    var report = makeReport("actions-getresult");

    var tag = window.__ANTITHESIS_DEBUG_AUDIT_TAG__ || "";

    report.checks.push(
      await runCheck("actions.getResult", function () {
        var result = runtime.actions.getResult(tag);
        // Not-yet-completed is a valid state, not an error.
        if (result && result.ok === false && result.completed === false) {
          return {
            ok: true,
            completed: false,
            authorized: result.authorized,
          };
        }
        return result;
      }, function (result) {
        return {
          ok: result.ok,
          completed: !!result.completed,
          statusLabel: result.statusLabel || null,
          eventCount: result.eventCount || 0,
        };
      }, { keepResult: true }),
    );

    return finalize(report);
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  if (!window.__antithesisDebug || typeof window.__antithesisDebug.info !== "function") {
    return {
      ok: false,
      error: "antithesis debug runtime is not loaded",
      url: window.location.href,
    };
  }

  var phase = window.__ANTITHESIS_DEBUG_AUDIT_PHASE__ || "notebook-load";

  if (phase === "notebook-load") return auditNotebookLoad();
  if (phase === "notebook-write") return auditNotebookWrite();
  if (phase === "actions-list") return auditActionsList();
  if (phase === "actions-inject") return auditActionsInject();
  if (phase === "actions-settle") return auditActionsSettle();
  if (phase === "actions-authorize") return auditActionsAuthorize();
  if (phase === "actions-result") return auditActionsResult();
  if (phase === "actions-getresult") return auditActionsGetResult();

  return {
    ok: false,
    error: "unsupported audit phase",
    phase: phase,
    url: window.location.href,
  };
})();
