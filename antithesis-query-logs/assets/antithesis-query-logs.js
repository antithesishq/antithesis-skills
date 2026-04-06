(function () {
  var VERSION = "0.2.0";

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
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

  function setTextareaValue(textarea, value) {
    if (!textarea) return false;
    textarea.value = value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function findLabelByText(text) {
    return Array.from(document.querySelectorAll("label")).find(function (l) {
      return clean(l.textContent) === text;
    });
  }

  function findClickableByText(text) {
    var candidates = Array.from(
      document.querySelectorAll("label, button, a, span, div"),
    );
    return candidates.find(function (el) {
      var ownText = "";
      for (var child of el.childNodes) {
        if (child.nodeType === 3) ownText += child.textContent;
      }
      return clean(ownText) === text;
    });
  }

  // -------------------------------------------------------------------------
  // Page detection
  // -------------------------------------------------------------------------

  function isLogsExplorerPage() {
    return (
      window.location.pathname === "/search" &&
      !/[?&]get_logs=true\b/.test(window.location.search)
    );
  }

  function requireLogsExplorer() {
    if (!isLogsExplorerPage()) {
      return {
        error: "expected Logs Explorer page (not per-example log viewer)",
        url: window.location.href,
      };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // URL construction helpers (preferred approach)
  // -------------------------------------------------------------------------

  /**
   * Build a query condition object.
   * @param {string} field - e.g. "assertion.message", "assertion.status"
   * @param {string} operator - "contains", "matches", "excludes", "regex"
   * @param {string} value - the search value
   * @param {boolean} [caseSensitive=false]
   */
  function cond(field, operator, value, caseSensitive) {
    return {
      c: caseSensitive === true,
      f: field,
      o: operator,
      v: value,
    };
  }

  /**
   * Build a condition group (wraps conditions in the h/o structure).
   * @param {Array} conditions - array of condition objects from cond()
   * @param {string} [joinOp="or"] - how conditions within this group join
   */
  function condGroup(conditions, joinOp) {
    return {
      h: conditions,
      o: joinOp || "or",
    };
  }

  /**
   * Build a row group (wraps condition groups in the r/h/o structure).
   * @param {Array} groups - array of condition group objects
   * @param {string} [joinOp="and"] - how groups are joined ("and" or "or")
   */
  function rowGroup(groups, joinOp) {
    return {
      r: {
        h: groups,
        o: joinOp || "and",
      },
    };
  }

  /**
   * Build a complete query JSON object.
   * @param {Object} options
   * @param {string} options.sessionId - the run session ID
   * @param {Array} options.conditions - array of {field, op, value} objects
   *   for the main WHERE block
   * @param {string} [options.temporalType="none"] - "none",
   *   "preceded_by", "not_preceded_by", "followed_by", "not_followed_by"
   * @param {Array} [options.temporalConditions] - array of {field, op, value}
   *   objects for the temporal block (required if temporalType != "none")
   */
  /**
   * Map the caller-facing temporal type to the platform's p-block encoding.
   *
   * Platform format (discovered 2026-04-03 against platform 50-6):
   *   q.n.y is always "none" — even for temporal queries.
   *   q.p.y is "preceding" or "following".
   *   q.p.t.g encodes the negation: true = NOT, false = positive.
   */
  var TEMPORAL_MAP = {
    preceded_by:       { y: "preceding",  negate: false },
    not_preceded_by:   { y: "preceding",  negate: true },
    followed_by:       { y: "following",  negate: false },
    not_followed_by:   { y: "following",  negate: true },
  };

  function buildQuery(options) {
    var mainGroups = options.conditions.map(function (c) {
      return condGroup([cond(c.field, c.op, c.value)]);
    });

    var query = {
      q: {
        n: Object.assign(rowGroup(mainGroups), {
          t: { g: false, m: "" },
          y: "none",
        }),
      },
      s: options.sessionId,
    };

    if (
      options.temporalType &&
      options.temporalType !== "none" &&
      options.temporalConditions
    ) {
      var mapping = TEMPORAL_MAP[options.temporalType];
      if (!mapping) {
        // Unknown temporal type — fall back to legacy encoding
        mapping = { y: options.temporalType, negate: false };
      }

      var temporalGroups = options.temporalConditions.map(function (c) {
        return condGroup([cond(c.field, c.op, c.value)]);
      });

      query.q.p = Object.assign(rowGroup(temporalGroups), {
        t: { g: mapping.negate, m: "" },
        y: mapping.y,
      });
    }

    return query;
  }

  /**
   * Encode a query object into the URL search parameter value.
   * @param {Object} query - the query JSON from buildQuery()
   * @returns {string} - the encoded string (v5v + base64)
   */
  function encodeQuery(query) {
    var json = JSON.stringify(query);
    var b64 = btoa(json).replace(/=+$/, "");
    return "v5v" + b64;
  }

  /**
   * Build a full search URL.
   * @param {Object} query - the query JSON from buildQuery()
   * @param {string} [tenant] - tenant hostname; defaults to current page hostname
   * @returns {string} - the full URL
   */
  function buildSearchUrl(query, tenant) {
    var host = tenant || window.location.hostname;
    return (
      "https://" + host + "/search?search=" + encodeQuery(query)
    );
  }

  /**
   * Decode the search parameter from the current page URL.
   * @returns {Object|null} - the decoded query JSON, or null
   */
  function decodeCurrentQuery() {
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

  /**
   * Extract the session ID from the current page URL.
   * @returns {string|null}
   */
  function extractSessionId() {
    var decoded = decodeCurrentQuery();
    return decoded ? decoded.s : null;
  }

  // -------------------------------------------------------------------------
  // Standalone URL builder — available without full runtime or page context
  // -------------------------------------------------------------------------

  window.__antithesisQueryBuilder = {
    buildQuery: function (options) {
      return buildQuery(options);
    },
    encodeQuery: function (query) {
      return encodeQuery(query);
    },
    buildSearchUrl: function (queryOrOptions, tenant) {
      var query = queryOrOptions;
      if (queryOrOptions && queryOrOptions.sessionId) {
        query = buildQuery(queryOrOptions);
      }
      return buildSearchUrl(query, tenant);
    },
    buildFailureQueryUrl: function (sessionId, assertionMessage, tenant) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
      });
      return buildSearchUrl(query, tenant);
    },
    buildNotPrecededByUrl: function (sessionId, assertionMessage, precededByField, precededByValue, tenant) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
        temporalType: "not_preceded_by",
        temporalConditions: [
          { field: precededByField, op: "contains", value: precededByValue },
        ],
      });
      return buildSearchUrl(query, tenant);
    },
    buildNotFollowedByUrl: function (sessionId, assertionMessage, followedByField, followedByValue, tenant) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
        temporalType: "not_followed_by",
        temporalConditions: [
          { field: followedByField, op: "contains", value: followedByValue },
        ],
      });
      return buildSearchUrl(query, tenant);
    },
  };

  // -------------------------------------------------------------------------
  // Query builder interactions (fallback UI approach)
  // -------------------------------------------------------------------------

  function getQueryTextareas() {
    return Array.from(document.querySelectorAll("textarea.textarea_component"));
  }

  function getFieldSelectors() {
    return Array.from(
      document.querySelectorAll(".select_container.query_select"),
    );
  }

  async function selectDropdownOption(selectContainer, optionText) {
    // Click to open the dropdown
    click(selectContainer);
    await wait(500);

    // Find and click the option
    var options = Array.from(
      document.querySelectorAll(
        ".select_option, [class*=select_option], [role=option]",
      ),
    );
    var target = options.find(function (el) {
      return clean(el.textContent).includes(optionText);
    });
    if (target) {
      click(target);
      await wait(300);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Search execution
  // -------------------------------------------------------------------------

  function clickSearch() {
    var searchLabel = findLabelByText("Search");
    if (searchLabel) {
      click(searchLabel);
      return true;
    }
    return false;
  }

  async function waitForResults(timeoutMs) {
    var deadline = Date.now() + (timeoutMs || 60000);
    while (Date.now() < deadline) {
      var resultsArea = document.querySelector(".event_search_results");
      if (!resultsArea) {
        await wait(1000);
        continue;
      }
      var text = clean(resultsArea.textContent);
      // Check if loading is done
      if (text.includes("matching events") || text.includes("No matching events")) {
        // Extract count
        var match = text.match(/(\d[\d,]*)\s*matching\s*events/);
        var count = match ? parseInt(match[1].replace(/,/g, ""), 10) : 0;
        return {
          ok: true,
          count: count,
          noResults: text.includes("No matching events"),
          text: text.substring(0, 200),
        };
      }
      await wait(1000);
    }
    return { ok: false, error: "timeout waiting for results" };
  }

  // -------------------------------------------------------------------------
  // Result reading
  // -------------------------------------------------------------------------

  function readResults(limit) {
    var maxItems = typeof limit === "number" && limit > 0 ? limit : 20;
    var resultsArea = document.querySelector(".event_search_results");
    if (!resultsArea) return [];

    // Results are rows with timestamp, source, container, and event text
    var rows = resultsArea.querySelectorAll("[class*=result], .event");
    var results = [];

    // Fallback: parse the text content directly
    var text = resultsArea.innerText;
    var lines = text.split("\n").filter(function (l) { return l.trim(); });

    // Parse results positionally: each result starts with a vtime line,
    // followed by source, container, and event text lines in order.
    var currentResult = null;
    var fieldIndex = 0;
    for (var i = 0; i < lines.length && results.length < maxItems; i++) {
      var line = lines[i].trim();
      // vtime pattern: digits with decimal
      if (/^\d+\.\d+$/.test(line)) {
        if (currentResult) results.push(currentResult);
        currentResult = { vtime: line, source: "", container: "", text: "" };
        fieldIndex = 0;
      } else if (currentResult) {
        if (line.startsWith("{")) {
          currentResult.text = line.substring(0, 500);
        } else if (fieldIndex === 0) {
          currentResult.source = line;
          fieldIndex = 1;
        } else if (fieldIndex === 1) {
          currentResult.container = line;
          fieldIndex = 2;
        }
      }
    }
    if (currentResult) results.push(currentResult);

    return results;
  }

  function getResultCount() {
    var resultsArea = document.querySelector(".event_search_results");
    if (!resultsArea) return null;
    var text = clean(resultsArea.textContent);
    var match = text.match(/(\d[\d,]*)\s*matching\s*events/);
    if (match) return parseInt(match[1].replace(/,/g, ""), 10);
    if (text.includes("No matching events")) return 0;
    return null;
  }

  // -------------------------------------------------------------------------
  // Temporal query controls (UI fallback)
  // -------------------------------------------------------------------------

  function clickPrecededBy() {
    var el = findClickableByText("Preceded by");
    if (el) {
      click(el);
      return true;
    }
    return false;
  }

  function clickFollowedBy() {
    var el = findClickableByText("Followed by");
    if (el) {
      click(el);
      return true;
    }
    return false;
  }

  async function switchToNotPrecededBy() {
    // After clicking Preceded by, a dropdown appears.
    // Find the dropdown that has "Preceded by" / "Not preceded by" options.
    var dropdowns = Array.from(
      document.querySelectorAll(".select_container"),
    );
    for (var d of dropdowns) {
      var text = clean(d.textContent);
      if (text.includes("Preceded by") && !text.includes("event_search_run")) {
        click(d);
        await wait(500);
        var options = Array.from(
          document.querySelectorAll(
            ".select_option, [class*=select_option]",
          ),
        );
        var notPreceded = options.find(function (el) {
          return clean(el.textContent) === "Not preceded by";
        });
        if (notPreceded) {
          click(notPreceded);
          await wait(300);
          return true;
        }
        break;
      }
    }
    return false;
  }

  async function switchToNotFollowedBy() {
    var dropdowns = Array.from(
      document.querySelectorAll(".select_container"),
    );
    for (var d of dropdowns) {
      var text = clean(d.textContent);
      if (text.includes("Followed by") && !text.includes("event_search_run")) {
        click(d);
        await wait(500);
        var options = Array.from(
          document.querySelectorAll(
            ".select_option, [class*=select_option]",
          ),
        );
        var notFollowed = options.find(function (el) {
          return clean(el.textContent) === "Not followed by";
        });
        if (notFollowed) {
          click(notFollowed);
          await wait(300);
          return true;
        }
        break;
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // High-level query methods
  // -------------------------------------------------------------------------

  var api = {

    // --- URL construction methods (preferred) ---

    // Extract the session ID from the current page URL
    extractSessionId: function () {
      return extractSessionId();
    },

    // Decode the current page's search query
    decodeCurrentQuery: function () {
      return decodeCurrentQuery();
    },

    // Build a search URL for a simple assertion failure query
    buildFailureQueryUrl: function (sessionId, assertionMessage) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
      });
      return buildSearchUrl(query);
    },

    // Build a search URL with a NOT PRECEDED BY temporal filter
    buildNotPrecededByUrl: function (sessionId, assertionMessage, precededByField, precededByValue) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
        temporalType: "not_preceded_by",
        temporalConditions: [
          { field: precededByField, op: "contains", value: precededByValue },
        ],
      });
      return buildSearchUrl(query);
    },

    // Build a search URL with a NOT FOLLOWED BY temporal filter
    buildNotFollowedByUrl: function (sessionId, assertionMessage, followedByField, followedByValue) {
      var query = buildQuery({
        sessionId: sessionId,
        conditions: [
          { field: "assertion.message", op: "contains", value: assertionMessage },
          { field: "assertion.status", op: "matches", value: "failing" },
        ],
        temporalType: "not_followed_by",
        temporalConditions: [
          { field: followedByField, op: "contains", value: followedByValue },
        ],
      });
      return buildSearchUrl(query);
    },

    // Build a fully custom query URL
    buildCustomQueryUrl: function (options) {
      var query = buildQuery(options);
      return buildSearchUrl(query);
    },

    // Low-level: build a query JSON (for inspection before encoding)
    buildQuery: function (options) {
      return buildQuery(options);
    },

    // Low-level: encode a query JSON to a URL parameter value
    encodeQuery: function (query) {
      return encodeQuery(query);
    },

    // --- UI interaction methods (fallback) ---

    // Set the value in a query textarea by index (0 = first row, etc.)
    setQueryValue: function (index, value) {
      var error = requireLogsExplorer();
      if (error) return error;
      var textareas = getQueryTextareas();
      if (index >= textareas.length) {
        return { error: "textarea index " + index + " out of range, have " + textareas.length };
      }
      setTextareaValue(textareas[index], value);
      return { ok: true, index: index, value: value };
    },

    // Execute the search and wait for results
    search: async function (timeoutMs) {
      var error = requireLogsExplorer();
      if (error) return error;
      clickSearch();
      await wait(1000);
      return waitForResults(timeoutMs || 60000);
    },

    // Get the current result count
    getResultCount: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      return { count: getResultCount() };
    },

    // Read search results
    readResults: function (limit) {
      var error = requireLogsExplorer();
      if (error) return error;
      return readResults(limit);
    },

    // Add a "Preceded by" temporal block
    addPrecededBy: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      return { ok: clickPrecededBy() };
    },

    // Add a "Followed by" temporal block
    addFollowedBy: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      return { ok: clickFollowedBy() };
    },

    // Switch the temporal mode to "Not preceded by"
    switchToNotPrecededBy: async function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var result = await switchToNotPrecededBy();
      return { ok: result };
    },

    // Switch the temporal mode to "Not followed by"
    switchToNotFollowedBy: async function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var result = await switchToNotFollowedBy();
      return { ok: result };
    },

    // Click the + AND button to add another condition row
    addAndRow: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var addBtn = findClickableByText("+ AND");
      if (!addBtn) addBtn = findClickableByText("AND");
      return { ok: addBtn ? click(addBtn) : false };
    },

    // Switch to Map view
    showMap: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var mapTab = findClickableByText("Map");
      return { ok: mapTab ? click(mapTab) : false };
    },

    // Switch to List view
    showList: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var listTab = findClickableByText("List");
      return { ok: listTab ? click(listTab) : false };
    },

    // Click Reset to clear the query
    reset: function () {
      var error = requireLogsExplorer();
      if (error) return error;
      var resetBtn = findClickableByText("Reset");
      return { ok: resetBtn ? click(resetBtn) : false };
    },

    // Get page info
    pageInfo: function () {
      return {
        isLogsExplorer: isLogsExplorerPage(),
        url: window.location.href,
        sessionId: extractSessionId(),
        resultCount: getResultCount(),
        textareaCount: getQueryTextareas().length,
        fieldSelectorCount: getFieldSelectors().length,
      };
    },
  };

  // -------------------------------------------------------------------------
  // Register
  // -------------------------------------------------------------------------

  window.__antithesisQueryLogs = api;

  return {
    ok: true,
    version: VERSION,
    description: "Antithesis Logs Explorer runtime",
    methods: Object.keys(api),
  };
})();
