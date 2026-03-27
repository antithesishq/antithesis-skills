## Logs Page — Investigating Failures

**CRITICAL:** Use the full `logsUrl` from `getFailedPropertyExamples()` — it includes `get_logs_event_desc` which centers the viewer on the assertion event. Without it, the viewer starts at the beginning and you can't scroll to the failure.

1. Get examples: `getFailedPropertyExamples()` on the report page
2. Open the full `logsUrl` (not a stripped version)
3. Wait for `/search` path with `get_logs` param, inject runtime, call `logs.waitForReady()`
4. `logs.findHighlightedEvent()` — shows events around the assertion
5. `logs.filter('query')` / `logs.clearFilter()` — filter events (pipe `|` for OR)
6. `logs.readVisibleEvents()` — read visible events (virtual scroll, ~50-70 rows)

**IMPORTANT:** `filter()` and `search()` do NOT scroll the virtual list. They only filter/highlight within the currently loaded viewport. To find errors that aren't in the visible window, use the bulk DOM extraction method below.

## Bulk Extraction of All Visible Event Data

When `readVisibleEvents()` shows empty text (especially for ducktape output and fault_injector events), extract the raw DOM content. This gets BOTH the structured `varying-part` data AND the `output_text` content:

```javascript
Array.from(document.querySelectorAll(".event"))
  .map((e) => {
    const vp = e.querySelector(".event__varying-part");
    if (!vp) return null;
    let data = "";
    for (const child of vp.childNodes) {
      if (child.nodeType === 3) data += child.textContent;
    }
    const ot = vp.querySelector(".event__output_text");
    const otText = ot ? ot.textContent.trim() : "";
    data = data.trim();
    if (!data && !otText) return null;
    const vtime = e.querySelector(".event__vtime");
    const t = vtime ? vtime.textContent.replace(/[^0-9.]/g, "") : "";
    return {
      vtime: t,
      data: data.substring(0, 300),
      output: otText.substring(0, 300),
    };
  })
  .filter(Boolean);
```

This produces a large JSON array. Save to file then grep for errors:

```
grep -i "error\|traceback\|exception\|fail\|assert\|timeout\|raise" output.txt
```

This is how we found the actual root cause (`AssertionError: Node root@rp-4: did not stop within the specified timeout of 150 seconds`) that `readVisibleEvents()` couldn't surface.

## Extracting Fault Injection Events

The fault_injector events have **empty text** in `readVisibleEvents()` because the data is in a text node inside `event__varying-part`, not in `event__output_text`. Extract them with:

```javascript
Array.from(document.querySelectorAll(".event"))
  .map((e) => {
    const vp = e.querySelector(".event__varying-part");
    if (!vp) return null;
    let data = "";
    for (const child of vp.childNodes) {
      if (child.nodeType === 3) data += child.textContent;
    }
    data = data.trim();
    if (!data || !data.startsWith("{")) return null;
    const vtime = e.querySelector(".event__vtime");
    const t = vtime ? vtime.textContent.replace(/[^0-9.]/g, "") : "";
    return { vtime: t, data: data.substring(0, 500) };
  })
  .filter(Boolean);
```

Fault event format examples:

- **Network clog**: `{fault:{affected_nodes:[rp-1,rp-2,...],details:{disruption_type:Slowed,drop_rate:0,latency:{deviation:383,mean:768}},max_duration:5.56,name:clog,type:network}}`
- **Network partition**: `{fault:{affected_nodes:[ALL],details:{asymmetric:false,disruption_type:Slowed,...,partitions:[[group1],[group2]]},name:partition,type:network}}`
- **Node kill**: `{fault:{affected_nodes:[rp-3],max_duration:1.77,name:kill,type:node}}`
- **Restore**: `{fault:{affected_nodes:[ALL],name:restore,type:network}}`
