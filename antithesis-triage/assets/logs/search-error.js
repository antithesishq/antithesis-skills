var search = document.querySelector(".sequence_search__input");
search.value = "error";
search.dispatchEvent(new Event("input", { bubbles: true }));
search.dispatchEvent(
  new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
);
