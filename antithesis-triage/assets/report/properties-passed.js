(async function () {
  var TARGET = "passed";

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

  function activateTab(kind) {
    return click(
      document.querySelector(
        kind === "failed" ? "a-tab._failing" : "a-tab._passing",
      ),
    );
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
    var style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function nameOf(container) {
    return (
      container
        .querySelector(":scope > .property .property__name_label")
        ?.textContent?.trim() || ""
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

  function isGroup(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._parent_group, :scope > .property .property__expander .expander__icon._group",
    );
  }

  function isExpanded(container) {
    return !!container.querySelector(
      ":scope > .property .property__expander._expanded, :scope > .property__details._unfolded",
    );
  }

  function directChildren(container) {
    return container.querySelectorAll(":scope > .property__details > .property-container")
      .length;
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

      if (click(container.querySelector(":scope > .property .property__expander-button"))) {
        changed = true;
      }
    });

    return changed;
  }

  activateTab(TARGET);
  await new Promise(function (resolve) {
    setTimeout(resolve, 300);
  });

  for (var i = 0; i < 8; i++) {
    if (!expandVisibleGroups()) break;
    await new Promise(function (resolve) {
      setTimeout(resolve, 250);
    });
  }

  return JSON.stringify({
    filter: TARGET,
    properties: Array.from(document.querySelectorAll(".property-container"))
      .filter(function (container) {
        return (
          isVisible(container) &&
          stateFromStatus(
            container.querySelector(":scope > .property .property__status"),
          ) === TARGET &&
          !container.querySelector(":scope > .property__details > .property-container")
        );
      })
      .map(function (container) {
        return {
          group: groupPath(container),
          name: nameOf(container),
          status: stateFromStatus(
            container.querySelector(":scope > .property .property__status"),
          ),
        };
      })
      .filter(function (property) {
        return property.name;
      }),
  });
})();
