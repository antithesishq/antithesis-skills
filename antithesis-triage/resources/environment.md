# Environment

The Environment section (`section.section_container` containing "Environment" title) shows the Docker images used in this run.

## Get source images

```js
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
```
