(function () {
  var loadingTexts = Array.from(document.querySelectorAll("*"))
    .map(function (el) {
      return (el.textContent || "").replace(/\s+/g, " ").trim();
    })
    .filter(function (text) {
      return /^Loading/.test(text);
    });

  return !!(
    document.querySelector(".vscroll") &&
    document.querySelectorAll("a-row").length > 0 &&
    loadingTexts.length === 0
  );
})();
