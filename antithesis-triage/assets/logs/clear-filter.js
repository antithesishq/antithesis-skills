var filter = document.querySelector(".sequence_filter__input");
filter.value = "";
filter.dispatchEvent(new Event("input", { bubbles: true }));
