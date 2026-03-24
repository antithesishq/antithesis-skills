(function () {
  var VERSION = "1.1.0";

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

  function waitForReady(checkFn, detailsFn, options) {
    var timeoutMs =
      options && typeof options.timeoutMs === "number" ? options.timeoutMs : 60000;
    var intervalMs =
      options && typeof options.intervalMs === "number" ? options.intervalMs : 1000;
    var startedAt = Date.now();
    var deadline = startedAt + timeoutMs;
    var attempts = 0;

    return (async function () {
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
    })();
  }

  // ---------------------------------------------------------------------------
  // Cell helpers — the notebook renders each reactive unit as a div.cell
  //
  // Action cells contain:
  //   a-button.action_auth        — the authorize button
  //   .action_status_label        — exit code text after completion
  //   .sequence_printer_wrapper   — output container (same widget as logs)
  //   .sequence_toolbar__items-counter — "N items" count
  //   .event                      — individual output rows
  //
  // Non-action cells may contain direct output text or nothing.
  // ---------------------------------------------------------------------------

  function cellActionButton(cell) {
    return cell.querySelector("a-button.action_auth");
  }

  function cellIsActionAuthorized(cell) {
    var btn = cellActionButton(cell);
    return btn ? btn.hasAttribute("disabled") : false;
  }

  function cellStatusLabel(cell) {
    var el = cell.querySelector(".action_status_label");
    return el ? clean(el.innerText || el.textContent) : null;
  }

  function cellItemCount(cell) {
    var el = cell.querySelector(".sequence_toolbar__items-counter");
    return el ? clean(el.innerText || el.textContent) : null;
  }

  function cellEvents(cell) {
    return Array.from(cell.querySelectorAll(".event")).map(function (ev) {
      return clean(ev.innerText || ev.textContent);
    });
  }

  function cellOutput(cell) {
    var statusLabel = cellStatusLabel(cell);
    var itemCount = cellItemCount(cell);
    var events = cellEvents(cell);

    if (!statusLabel && events.length === 0) return null;

    return {
      statusLabel: statusLabel,
      itemCount: itemCount,
      eventCount: events.length,
      events: events,
    };
  }

  function cellButtonLabel(cell) {
    var btn = cellActionButton(cell);
    if (!btn) return null;
    // The button contains <a-icon>, <label>, and <a-tooltip>. Use <label>
    // to avoid doubling from the tooltip's duplicate text.
    var label = btn.querySelector("label");
    return label ? clean(label.textContent) : clean(btn.innerText);
  }

  function cellHasCompleted(cell) {
    // An action cell has completed when the button is disabled and the
    // status label indicates a terminal state — not still running.
    if (!cellIsActionAuthorized(cell)) return false;
    var status = cellStatusLabel(cell);
    if (!status) return false;
    // "RUNNING: ..." means the command is still executing.
    return !/^running\b/i.test(status);
  }

  // ---------------------------------------------------------------------------
  // Notebook API — interact with the Monaco editor and notebook cells
  // ---------------------------------------------------------------------------

  var notebookApi = {
    loadingFinished: function () {
      return !!(
        window.editor &&
        typeof window.editor.getValue === "function" &&
        window.editor.getValue().length > 0 &&
        document.querySelectorAll(".cell").length > 0
      );
    },

    loadingStatus: function () {
      return {
        url: window.location.href,
        title: document.title,
        hasEditor: !!(window.editor && typeof window.editor.getValue === "function"),
        hasEditorNotebook: !!window.editor_notebook,
        editorContentLength:
          window.editor && typeof window.editor.getValue === "function"
            ? window.editor.getValue().length
            : 0,
        cellCount: document.querySelectorAll(".cell").length,
        visibleCells: Array.from(document.querySelectorAll(".cell")).filter(isVisible).length,
        windowKeys: Object.keys(window).filter(function (k) {
          return /editor|notebook|multiverse|debug/i.test(k);
        }),
      };
    },

    waitForReady: function (options) {
      return waitForReady(
        function () {
          return notebookApi.loadingFinished();
        },
        function () {
          return notebookApi.loadingStatus();
        },
        options,
      );
    },

    getSource: function () {
      if (!window.editor || typeof window.editor.getValue !== "function") {
        return { error: "editor not available" };
      }

      return {
        ok: true,
        source: window.editor.getValue(),
        length: window.editor.getValue().length,
      };
    },

    setSource: function (code) {
      if (!window.editor || typeof window.editor.setValue !== "function") {
        return { error: "editor not available" };
      }

      window.editor.setValue(code);
      return { ok: true, length: code.length };
    },

    appendSource: function (code) {
      if (
        !window.editor ||
        typeof window.editor.getValue !== "function" ||
        typeof window.editor.setValue !== "function"
      ) {
        return { error: "editor not available" };
      }

      var current = window.editor.getValue();
      var separator = current.endsWith("\n") ? "" : "\n";
      var newSource = current + separator + code;
      window.editor.setValue(newSource);
      return { ok: true, length: newSource.length, appended: code.length };
    },

    getCells: function () {
      var cells = Array.from(document.querySelectorAll(".cell"));
      return cells.map(function (cell, index) {
        var hasAction = !!cellActionButton(cell);

        return {
          index: index,
          text: clean(cell.innerText || cell.textContent).substring(0, 500),
          hasAction: hasAction,
          actionAuthorized: hasAction ? cellIsActionAuthorized(cell) : null,
          actionCompleted: hasAction ? cellHasCompleted(cell) : null,
          statusLabel: hasAction ? cellStatusLabel(cell) : null,
          output: cellOutput(cell),
          visible: isVisible(cell),
        };
      });
    },

    getCellCount: function () {
      return document.querySelectorAll(".cell").length;
    },
  };

  // ---------------------------------------------------------------------------
  // Actions API — authorize and read shell action cells
  // ---------------------------------------------------------------------------

  function findCellByContent(textMatch) {
    return Array.from(document.querySelectorAll(".cell")).find(function (cell) {
      return (cell.innerText || cell.textContent || "").includes(textMatch);
    });
  }

  var actionsApi = {
    getAll: function () {
      var cells = Array.from(document.querySelectorAll(".cell"));
      var actions = [];

      cells.forEach(function (cell, index) {
        var btn = cellActionButton(cell);
        if (!btn) return;

        actions.push({
          cellIndex: index,
          buttonText: cellButtonLabel(cell),
          authorized: cellIsActionAuthorized(cell),
          completed: cellHasCompleted(cell),
          statusLabel: cellStatusLabel(cell),
          visible: isVisible(btn),
        });
      });

      return actions;
    },

    authorizeByIndex: function (cellIndex) {
      var cells = Array.from(document.querySelectorAll(".cell"));
      if (cellIndex < 0 || cellIndex >= cells.length) {
        return { error: "cell index out of range", count: cells.length };
      }

      var cell = cells[cellIndex];
      var btn = cellActionButton(cell);
      if (!btn) {
        return { error: "no action button in cell", cellIndex: cellIndex };
      }

      return { clicked: click(btn), cellIndex: cellIndex };
    },

    authorizeByContent: function (textMatch) {
      var target = findCellByContent(textMatch);

      if (!target) {
        return { error: "no cell matching text", query: textMatch };
      }

      var btn = cellActionButton(target);
      if (!btn) {
        return {
          error: "matching cell has no action button",
          query: textMatch,
        };
      }

      return { clicked: click(btn), query: textMatch };
    },

    authorizeAll: async function () {
      var cells = Array.from(document.querySelectorAll(".cell"));
      var authorized = 0;

      for (var i = 0; i < cells.length; i++) {
        var btn = cellActionButton(cells[i]);
        if (btn && !btn.hasAttribute("disabled") && click(btn)) {
          authorized++;
          await wait(500);
        }
      }

      return { authorized: authorized, totalCells: cells.length };
    },

    getResult: function (textMatch) {
      var target = findCellByContent(textMatch);
      if (!target) {
        return { error: "no cell matching text", query: textMatch };
      }

      if (!cellHasCompleted(target)) {
        return {
          ok: false,
          completed: false,
          authorized: cellIsActionAuthorized(target),
          query: textMatch,
        };
      }

      var output = cellOutput(target);
      return {
        ok: true,
        completed: true,
        statusLabel: output ? output.statusLabel : null,
        itemCount: output ? output.itemCount : null,
        eventCount: output ? output.eventCount : 0,
        events: output ? output.events : [],
        query: textMatch,
      };
    },

    waitForResult: async function (textMatch, options) {
      var timeoutMs =
        options && typeof options.timeoutMs === "number" ? options.timeoutMs : 30000;
      var intervalMs =
        options && typeof options.intervalMs === "number" ? options.intervalMs : 1000;
      var startedAt = Date.now();
      var deadline = startedAt + timeoutMs;
      var attempts = 0;

      while (Date.now() <= deadline) {
        attempts += 1;

        var target = findCellByContent(textMatch);
        if (target && cellHasCompleted(target)) {
          var output = cellOutput(target);
          return {
            ok: true,
            statusLabel: output ? output.statusLabel : null,
            itemCount: output ? output.itemCount : null,
            eventCount: output ? output.eventCount : 0,
            events: output ? output.events : [],
            attempts: attempts,
            waitedMs: Date.now() - startedAt,
          };
        }

        if (Date.now() + intervalMs > deadline) break;
        await wait(intervalMs);
      }

      return {
        ok: false,
        error: "timed out waiting for result",
        query: textMatch,
        authorized: target ? cellIsActionAuthorized(target) : false,
        attempts: attempts,
        waitedMs: Date.now() - startedAt,
      };
    },
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  var api = {
    __version: VERSION,
    notebook: notebookApi,
    actions: actionsApi,
    info: function () {
      return {
        ok: true,
        version: VERSION,
        description: "Antithesis multiverse debugger runtime",
        namespaces: {
          notebook: Object.keys(notebookApi).sort(),
          actions: Object.keys(actionsApi).sort(),
        },
      };
    },
  };

  window.__antithesisDebug = api;
  return api.info();
})();
