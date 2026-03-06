(async function () {
  var TARGET = "failed";

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

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (!el) return false;
    var style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
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

  function nameOf(container) {
    return clean(
      container.querySelector(":scope > .property .property__name_label")
        ?.textContent,
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

  function directChildren(container) {
    return container.querySelectorAll(
      ":scope > .property__details > .property-container",
    ).length;
  }

  function isGroup(container) {
    return directChildren(container) > 0;
  }

  function isExpanded(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._expanded, :scope > .property__details._unfolded",
    );
  }

  function activateFailedTab() {
    return click(document.querySelector("a-tab._failing"));
  }

  function expandVisibleGroups() {
    var changed = false;

    Array.from(document.querySelectorAll(".property-container")).forEach(function (
      container,
    ) {
      if (!isVisible(container) || !isGroup(container) || isExpanded(container)) {
        return;
      }

      var status = stateFromStatus(
        container.querySelector(":scope > .property .property__status"),
      );
      if (status !== TARGET && directChildren(container) > 0) {
        return;
      }

      if (
        click(container.querySelector(":scope > .property .property__expander-button"))
      ) {
        changed = true;
      }
    });

    return changed;
  }

  function examplesRows(container) {
    return container.querySelectorAll(":scope > .property__details .examples_table__row")
      .length;
  }

  function expandVisibleLeaves() {
    var changed = false;

    Array.from(document.querySelectorAll(".property-container")).forEach(function (
      container,
    ) {
      if (!isVisible(container) || isGroup(container)) return;

      var status = stateFromStatus(
        container.querySelector(":scope > .property .property__status"),
      );
      if (status !== TARGET || examplesRows(container) > 0) return;

      if (
        click(container.querySelector(":scope > .property .property__expander-button"))
      ) {
        changed = true;
      }
    });

    return changed;
  }

  activateFailedTab();
  await wait(300);

  for (var i = 0; i < 8; i++) {
    var changed = false;
    if (expandVisibleGroups()) {
      changed = true;
      await wait(250);
    }
    if (expandVisibleLeaves()) {
      changed = true;
      await wait(250);
    }
    if (!changed) break;
  }

  var expanded = Array.from(document.querySelectorAll(".property-container"))
    .filter(function (container) {
      return (
        isVisible(container) &&
        !isGroup(container) &&
        stateFromStatus(
          container.querySelector(":scope > .property .property__status"),
        ) === TARGET &&
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

  return JSON.stringify({
    filter: TARGET,
    expandedProperties: expanded,
    totalExampleRows: expanded.reduce(function (sum, property) {
      return sum + property.exampleRows;
    }, 0),
  });
})();
