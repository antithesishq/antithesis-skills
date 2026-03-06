JSON.stringify(
  Array.from(
    document.querySelectorAll(".presentation_environment__source_image"),
  ).map(function (img) {
    var title = img.querySelector(".source_image__title");
    var digest = img.querySelector(".click_to_copy_text_element");
    return {
      name: title ? title.childNodes[0].textContent.trim() : "",
      digest: digest ? digest.textContent.trim() : "",
    };
  }),
);
