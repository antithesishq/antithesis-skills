# Run Metadata

Extract high-level information about a triage repor

```js
var title = document.querySelector(".branded_title");
var meta = document.querySelector(".branded_metadata");
JSON.stringify({
  title: title ? title.textContent.trim() : "",
  metadata: meta ? meta.textContent.trim() : "",
});
```
