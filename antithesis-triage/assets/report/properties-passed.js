(async function () {
  var TARGET = "passed";

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

  function isVisible(el) {
    if (!el) return false;
    var style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
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

  function isLeaf(container) {
    return directChildren(container) === 0;
  }

  function isExpanded(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._expanded, :scope > .property__details._unfolded",
    );
  }

  function expanderButton(container) {
    return container.querySelector(":scope > .property .property__expander-button");
  }

  function visiblePropertyContainers() {
    return Array.from(document.querySelectorAll(".property-container")).filter(
      isVisible,
    );
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

  function expandVisibleTargetGroups() {
    var changed = false;

    visiblePropertyContainers().forEach(function (container) {
      if (!isVisible(container)) {
        return;
      }

      var status = stateFromStatus(
        container.querySelector(":scope > .property .property__status"),
      );
      var hasChildren = !!expanderButton(container);
      var expanded = isExpanded(container);

      if (status === TARGET && hasChildren && !expanded) {
        if (click(expanderButton(container))) {
          changed = true;
        }
      }
    });

    return changed;
  }

  var passingTab =
    document.querySelector("a-tab._passing") || tabByPattern(/\bpassed\b/);

  for (var tabAttempt = 0; tabAttempt < 12; tabAttempt++) {
    click(passingTab);
    await new Promise(function (resolve) {
      setTimeout(resolve, 250);
    });

    var expected = countFromTab(passingTab);
    if (
      isSelected(passingTab) &&
      (visiblePropertyContainers().some(function (container) {
        return (
          stateFromStatus(
            container.querySelector(":scope > .property .property__status"),
          ) === TARGET
        );
      }) || expected === 0)
    ) {
      break;
    }
  }

  for (var i = 0; i < 16; i++) {
    var before = visiblePropertyContainers().filter(function (container) {
      return (
        isLeaf(container) &&
        stateFromStatus(
          container.querySelector(":scope > .property .property__status"),
        ) === TARGET
      );
    }).length;
    if (!expandVisibleTargetGroups()) {
      break;
    }
    await new Promise(function (resolve) {
      setTimeout(resolve, 300);
    });
    var after = visiblePropertyContainers().filter(function (container) {
      return (
        isLeaf(container) &&
        stateFromStatus(
          container.querySelector(":scope > .property .property__status"),
        ) === TARGET
      );
    }).length;
    if (after === before) {
      break;
    }
  }

  var properties = visiblePropertyContainers()
    .filter(function (container) {
      return (
        stateFromStatus(
          container.querySelector(":scope > .property .property__status"),
        ) === TARGET &&
        directChildren(container) === 0
      );
    })
    .map(function (container) {
      return {
        group: groupPath(container),
        name: nameOf(container),
        status: TARGET,
      };
    })
    .filter(function (property) {
      return property.name;
    });

  return JSON.stringify({
    filter: TARGET,
    expectedCount: countFromTab(passingTab),
    properties: properties,
  });
})();
