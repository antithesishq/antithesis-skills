// Usage: set ROW_INDEX before evaluating, e.g.:
//   var ROW_INDEX = 2;
//   <paste this script>
//
// Or pipe via stdin after prepending: "var ROW_INDEX = N;\n" + script

(function () {
  var index = typeof ROW_INDEX !== "undefined" ? ROW_INDEX : 0;
  var rows = document.querySelectorAll(".examples_table__row");

  if (index < 0 || index >= rows.length) {
    return JSON.stringify({
      error: "Row index " + index + " out of range (0-" + (rows.length - 1) + ")",
    });
  }

  var row = rows[index];

  ["pointerdown", "mousedown", "mouseup", "click"].forEach(function (type) {
    row.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
      }),
    );
  });

  var cells = row.querySelectorAll("td");
  var status = cells[0] ? cells[0].textContent.trim() : "";
  var time = cells[1] ? cells[1].textContent.trim() : "";

  return JSON.stringify({
    selected: index,
    status: status,
    time: time,
  });
})();
