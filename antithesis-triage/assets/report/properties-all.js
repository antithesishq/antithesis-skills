(async function () {
  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim();
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

  function isVisible(el) {
    if (!el) return false;
    var style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
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
      container.querySelector(":scope > .property .property__name_label")
        ?.textContent,
    );
  }

  function directChildren(container) {
    return container.querySelectorAll(
      ":scope > .property__details > .property-container",
    ).length;
  }

  function isExpanded(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._expanded, :scope > .property__details._unfolded",
    );
  }

  function expanderButton(container) {
    return container.querySelector(":scope > .property .property__expander-button");
  }

  function isLeaf(container) {
    return directChildren(container) === 0;
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
    return clean(tab?.textContent).toLowerCase();
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

  async function activateAllTab() {
    var tab = tabByPattern(/\ball\b/);
    if (!tab) return null;

    for (var attempt = 0; attempt < 12; attempt++) {
      click(tab);
      await wait(250);

      var expected = countFromTab(tab);
      if (
        isSelected(tab) &&
        (visiblePropertyContainers().length > 0 || expected === 0)
      ) {
        return tab;
      }
    }

    return tab;
  }

  async function expandVisibleGroups() {
    var changed = false;

    visiblePropertyContainers().forEach(function (container) {
      if (!expanderButton(container) || isExpanded(container)) return;

      if (click(expanderButton(container))) {
        changed = true;
      }
    });

    if (changed) {
      await wait(250);
    }

    return changed;
  }

  function leafProperties() {
    return visiblePropertyContainers()
      .filter(function (container) {
        return isLeaf(container) && nameOf(container);
      })
      .map(function (container) {
        return {
          group: groupPath(container),
          name: nameOf(container),
          status: containerStatus(container),
        };
      });
  }

  var tab = await activateAllTab();

  for (var i = 0; i < 24; i++) {
    var before = leafProperties().length;
    var changed = await expandVisibleGroups();
    var after = leafProperties().length;

    if (!changed && after === before) {
      break;
    }
  }

  var properties = leafProperties();
  var counts = properties.reduce(function (acc, property) {
    acc[property.status] = (acc[property.status] || 0) + 1;
    return acc;
  }, {});

  return JSON.stringify({
    filter: "all",
    expectedCount: countFromTab(tab),
    counts: counts,
    properties: properties,
  });
})();
