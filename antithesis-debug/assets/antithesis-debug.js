(function () {
  var VERSION = "2.0.0";

  // ---------------------------------------------------------------------------
  // Shared utilities
  // ---------------------------------------------------------------------------

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

  function setNativeValue(el, value) {
    var proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
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
  // Mode detection — works regardless of which mode is active
  // ---------------------------------------------------------------------------

  function detectMode() {
    // The Monaco editor is visible with substantial dimensions only in
    // advanced mode.  In simplified mode it is either absent or hidden.
    var editors = document.querySelectorAll(".monaco-editor");
    for (var i = 0; i < editors.length; i++) {
      var rect = editors[i].getBoundingClientRect();
      if (rect.width > 200 && rect.height > 200) return "advanced";
    }
    // If a simplified-mode container is present, we are in simplified mode.
    if (document.querySelector(".simple_multiverse_debugging_container")) {
      return "simplified";
    }
    return null;
  }

  function switchMode(target) {
    var current = detectMode();
    if (current === target) return { ok: true, mode: target, switched: false };

    // Open the three-dot menu first — the mode buttons are hidden inside it.
    var dotsBtn = document.querySelector(
      '.ceres_timeline_action_button_wrapper a-button[icon="dots-vertical"]',
    );
    if (dotsBtn) click(dotsBtn);

    var cls =
      target === "simplified"
        ? ".ceres_presentation_mode_simple_button"
        : ".ceres_presentation_mode_advanced_button";

    // The menu may take a frame to open. Try clicking the button immediately,
    // and if it is not yet visible, schedule a retry after a short delay.
    var btn = document.querySelector(cls);
    if (!btn) return { ok: false, error: "mode button not found: " + target };

    function tryClick() {
      var r = btn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        click(btn);
        return true;
      }
      return false;
    }

    if (tryClick()) return { ok: true, mode: target, switched: true };

    // Return a promise that retries after the menu renders.
    return wait(200).then(function () {
      if (tryClick()) return { ok: true, mode: target, switched: true };
      // Last resort: click even if not visually rendered.
      click(btn);
      return { ok: true, mode: target, switched: true, forced: true };
    });
  }

  // ---------------------------------------------------------------------------
  // Simplified API — interact with the simplified debugger view
  // ---------------------------------------------------------------------------

  function requireSimplifiedMode() {
    var mode = detectMode();
    if (mode === "simplified") return null;
    if (mode === "advanced") return { error: "page is in advanced mode, not simplified" };
    return { error: "cannot detect debugger mode" };
  }

  function findSendButton() {
    // The Send button lives inside .ceres_main, which distinguishes it from
    // any other "Send" button elsewhere on the page.
    var container = document.querySelector(".ceres_main");
    if (!container) return null;
    var btns = container.querySelectorAll("a-button");
    for (var i = 0; i < btns.length; i++) {
      if (clean(btns[i].textContent) === "Send") return btns[i];
    }
    return null;
  }

  function findOutputSections() {
    return Array.from(document.querySelectorAll(".ceres_output"));
  }

  function readOutputSection(el) {
    var header = el.querySelector(".ceres_output_item_header_text");
    var lines = el.querySelectorAll(".event__output_text");
    var link = el.querySelector('a[href^="blob:"]');

    return {
      header: header ? clean(header.textContent) : null,
      lines: Array.from(lines).map(function (l) {
        return clean(l.textContent);
      }),
      lineCount: lines.length,
      downloadLink: link
        ? { text: clean(link.textContent), href: link.href }
        : null,
    };
  }

  var simplifiedApi = {
    loadingFinished: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return false;
      // The simplified view is ready when the log view has rendered items
      // and the command textarea exists.
      var hasLogItems =
        document.querySelectorAll(".sized_item.vscroll__item").length > 0;
      var hasTextarea = !!document.querySelector(
        'textarea[placeholder*="Enter bash script"]',
      );
      return hasLogItems && hasTextarea;
    },

    loadingStatus: function () {
      return {
        url: window.location.href,
        title: document.title,
        mode: detectMode(),
        logItemCount:
          document.querySelectorAll(".sized_item.vscroll__item").length,
        hasTextarea: !!document.querySelector(
          'textarea[placeholder*="Enter bash script"]',
        ),
        hasSendButton: !!findSendButton(),
        outputCount: findOutputSections().length,
      };
    },

    waitForReady: function (options) {
      return waitForReady(
        function () {
          return simplifiedApi.loadingFinished();
        },
        function () {
          return simplifiedApi.loadingStatus();
        },
        options,
      );
    },

    getMoment: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var input = document.querySelector("input.input_input");
      if (!input) return { error: "moment input not found" };
      return { ok: true, vtime: input.value };
    },

    getContainer: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var target = document.querySelector(".select_component_target");
      if (!target) return { error: "container selector not found" };
      return { ok: true, container: clean(target.textContent) };
    },

    getContainers: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var listbox = document.querySelector('[role="listbox"]');
      if (!listbox) return { error: "container listbox not found" };
      var items = listbox.querySelectorAll(
        '[role="option"], a-button, div[tabindex]',
      );
      var names = [];
      var seen = {};
      items.forEach(function (el) {
        var name = clean(el.textContent);
        if (name && !seen[name]) {
          seen[name] = true;
          names.push(name);
        }
      });
      return { ok: true, containers: names };
    },

    runCommand: function (script) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var ta = document.querySelector(
        'textarea[placeholder*="Enter bash script"]',
      );
      if (!ta) return { error: "command textarea not found" };
      var sendBtn = findSendButton();
      if (!sendBtn) return { error: "send button not found" };
      setNativeValue(ta, script);
      var countBefore = findOutputSections().length;
      click(sendBtn);
      return { ok: true, sent: true, script: script, outputCountBefore: countBefore };
    },

    extractFile: async function (path) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;

      // Toggle the extract file input if not already visible
      var pathInput = document.querySelector(
        'input[placeholder="/path/to/file_to_extract.ext"]',
      );
      if (!pathInput || !isVisible(pathInput)) {
        var container = document.querySelector(".ceres_main");
        var btns = container
          ? container.querySelectorAll("a-button")
          : document.querySelectorAll("a-button");
        var toggleBtn = null;
        for (var i = 0; i < btns.length; i++) {
          if (clean(btns[i].textContent) === "Extract file") {
            toggleBtn = btns[i];
            break;
          }
        }
        if (!toggleBtn) return { error: "extract file button not found" };
        click(toggleBtn);
        // Wait for the input to appear after toggle
        await wait(300);
      }

      // Re-query after toggle
      pathInput = document.querySelector(
        'input[placeholder="/path/to/file_to_extract.ext"]',
      );
      if (!pathInput) return { error: "extract file input not found after toggle" };

      var sendBtn = findSendButton();
      if (!sendBtn) return { error: "send button not found" };

      setNativeValue(pathInput, path);
      var countBefore = findOutputSections().length;
      click(sendBtn);
      return { ok: true, sent: true, path: path, outputCountBefore: countBefore };
    },

    getOutputCount: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      return { ok: true, count: findOutputSections().length };
    },

    getLastOutput: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var outputs = findOutputSections();
      if (outputs.length === 0) return { ok: false, error: "no output sections" };
      var last = outputs[outputs.length - 1];
      var result = readOutputSection(last);
      result.ok = true;
      result.index = outputs.length - 1;
      return result;
    },

    getOutputHeaders: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var headers = document.querySelectorAll(".ceres_output_item_header_text");
      return {
        ok: true,
        headers: Array.from(headers).map(function (h) {
          return clean(h.textContent);
        }),
      };
    },

    getOutput: function (index) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var outputs = findOutputSections();
      if (index < 0 || index >= outputs.length) {
        return { error: "output index out of range", count: outputs.length };
      }
      var result = readOutputSection(outputs[index]);
      result.ok = true;
      result.index = index;
      return result;
    },

    waitForNewOutput: async function (countBefore, options) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var timeoutMs =
        options && typeof options.timeoutMs === "number"
          ? options.timeoutMs
          : 30000;
      var intervalMs =
        options && typeof options.intervalMs === "number"
          ? options.intervalMs
          : 1000;
      var startedAt = Date.now();
      var deadline = startedAt + timeoutMs;
      var attempts = 0;

      while (Date.now() <= deadline) {
        attempts += 1;
        var outputs = findOutputSections();
        if (outputs.length > countBefore) {
          var last = outputs[outputs.length - 1];
          // Check that the output has finished loading (has lines or a link)
          var lines = last.querySelectorAll(".event__output_text");
          var link = last.querySelector('a[href^="blob:"]');
          if (lines.length > 0 || link) {
            var result = readOutputSection(last);
            result.ok = true;
            result.index = outputs.length - 1;
            result.attempts = attempts;
            result.waitedMs = Date.now() - startedAt;
            return result;
          }
        }
        if (Date.now() + intervalMs > deadline) break;
        await wait(intervalMs);
      }

      return {
        ok: false,
        error: "timed out waiting for new output",
        outputCount: findOutputSections().length,
        countBefore: countBefore,
        attempts: attempts,
        waitedMs: Date.now() - startedAt,
      };
    },

    filterLogs: function (query) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var filterInput = document.querySelector(
        'input[placeholder="Filter rows by text"]',
      );
      if (!filterInput) return { error: "filter input not found" };
      setNativeValue(filterInput, query);
      return { ok: true, query: query };
    },

    clearFilter: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var filterInput = document.querySelector(
        'input[placeholder="Filter rows by text"]',
      );
      if (!filterInput) return { error: "filter input not found" };
      setNativeValue(filterInput, "");
      return { ok: true };
    },

    clickLogRow: function (index) {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var items = document.querySelectorAll(".sized_item.vscroll__item");
      if (index < 0 || index >= items.length) {
        return { error: "log row index out of range", count: items.length };
      }
      items[index].click();
      return { ok: true, index: index };
    },

    getVisibleLogRows: function () {
      var modeError = requireSimplifiedMode();
      if (modeError) return modeError;
      var items = document.querySelectorAll(".sized_item.vscroll__item");
      var visible = [];
      items.forEach(function (el, i) {
        var rect = el.getBoundingClientRect();
        if (rect.height > 0 && rect.y >= 0 && rect.y < 600) {
          visible.push({
            index: i,
            text: clean(el.textContent).substring(0, 200),
            isAnchor: !!el.closest(".vscroll_anchor_row"),
          });
        }
      });
      return { ok: true, rows: visible, totalCount: items.length };
    },
  };

  // ---------------------------------------------------------------------------
  // Cell helpers — advanced mode notebook cells
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
    var label = btn.querySelector("label");
    return label ? clean(label.textContent) : clean(btn.innerText);
  }

  function cellHasCompleted(cell) {
    if (!cellIsActionAuthorized(cell)) return false;
    var status = cellStatusLabel(cell);
    if (!status) return false;
    return !/^running\b/i.test(status);
  }

  // ---------------------------------------------------------------------------
  // Notebook API (advanced mode) — interact with the Monaco editor
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
        mode: detectMode(),
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
  // Actions API (advanced mode) — authorize and read shell action cells
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
    getMode: detectMode,
    switchMode: switchMode,
    simplified: simplifiedApi,
    notebook: notebookApi,
    actions: actionsApi,
    info: function () {
      return {
        ok: true,
        version: VERSION,
        mode: detectMode(),
        description: "Antithesis multiverse debugger runtime",
        namespaces: {
          simplified: Object.keys(simplifiedApi).sort(),
          notebook: Object.keys(notebookApi).sort(),
          actions: Object.keys(actionsApi).sort(),
        },
      };
    },
  };

  window.__antithesisDebug = api;
  return api.info();
})();
