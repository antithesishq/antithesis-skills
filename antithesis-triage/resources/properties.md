# Properties

On some reports, a fresh page load only exposes top-level property groups.

Use this eval to reveal either `failed` or `passed` properties via the tabs and
then dump only the visible leaf properties for that filter.

Set `TARGET` to `"failed"` or `"passed"`.

```js
(async function () {
  var TARGET = "failed"; // or "passed"

  function activateTab(kind) {
    var tab = document.querySelector(
      kind === "failed" ? "a-tab._failing" : "a-tab._passing",
    );
    if (!tab) return false;

    ["pointerdown", "mousedown", "mouseup", "click"].forEach(function (type) {
      tab.dispatchEvent(
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

  function isLeaf(container) {
    var details = container.querySelector(":scope > .property__details");
    return !details || !details.querySelector(":scope > .property-container");
  }

  function groupPath(container) {
    var path = [];
    var parent = container.parentElement
      ? container.parentElement.closest(".property-container")
      : null;

    while (parent) {
      var n = nameOf(parent);
      if (n) path.unshift(n);
      parent = parent.parentElement
        ? parent.parentElement.closest(".property-container")
        : null;
    }

    return path;
  }

  activateTab(TARGET);
  await new Promise(function (r) {
    setTimeout(r, 250);
  });

  return JSON.stringify({
    filter: TARGET,
    properties: Array.from(document.querySelectorAll(".property-container"))
      .filter(function (p) {
        return isVisible(p) && isLeaf(p);
      })
      .map(function (p) {
        return {
          group: groupPath(p),
          name: nameOf(p),
          status: stateFromStatus(
            p.querySelector(":scope > .property .property__status"),
          ),
        };
      })
      .filter(function (p) {
        return p.name && p.status === TARGET;
      }),
  });
})();
```
