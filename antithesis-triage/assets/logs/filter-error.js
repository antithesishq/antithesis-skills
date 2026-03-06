var filter = document.querySelector(".sequence_filter__input");
filter.value = "error";
filter.dispatchEvent(new Event("input", { bubbles: true }));
