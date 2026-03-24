# Authorizing & Reading Actions

Action cells render custom `a-button.action_auth` elements, not normal HTML
buttons. Clicking the visible generic element is unreliable. The runtime
provides methods that trigger the actual action button in the DOM.

## Action cell anatomy

Each action cell contains:
- `a-button.action_auth` — the authorize button (disabled after authorization)
- `.action_status_label` — status text after execution (e.g., "EXIT CODE 0", "RUNNING: ...", "Unknown start Moment")
- `.sequence_printer_wrapper` — output container with the same widget as the logs page
- `.sequence_toolbar__items-counter` — item count (e.g., "3 items")
- `.event` elements — individual output rows

An action is **authorized** when the button has the `disabled` attribute.
An action is **completed** when it is authorized AND the status label is present
AND it does not start with "RUNNING".

## Listing action cells

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.getAll()"
```

Returns an array of `{ cellIndex, buttonText, authorized, completed, statusLabel, visible }`.

## Authorizing a specific action

By cell index:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.authorizeByIndex(5)"
```

By matching text content in the cell:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.authorizeByContent('pwd && ls -la /')"
```

Both return `{ clicked: true/false }`.

## Authorizing all actions

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.authorizeAll()"
```

Clicks every un-authorized action button sequentially with a 500ms pause
between each. Returns `{ authorized, totalCells }`.

## Reading a result (non-polling)

After authorizing an action, check if the result is available:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.getResult('pwd && ls -la /')"
```

Returns `{ ok, completed, statusLabel, itemCount, eventCount, events }` if
completed, or `{ ok: false, completed: false, authorized }` if still running.

## Waiting for a result (polling)

Poll until the action completes:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.waitForResult('pwd && ls -la /')"
```

Polls for up to 30 seconds (default). Returns
`{ ok, statusLabel, itemCount, eventCount, events, attempts, waitedMs }` on
completion, or `{ ok: false, error, authorized }` on timeout.

Pass options for a different timeout:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.actions.waitForResult('pwd && ls -la /', { timeoutMs: 60000 })"
```

**Important:** `waitForResult` runs inside a single `eval` call. Keep
`timeoutMs` under the agent-browser CDP timeout (usually ~30 seconds) to avoid
a CDP timeout error. For longer waits, call `getResult` in a loop from the
shell side.

## Full authorize-and-read pattern

1. Inject a debug cell (see `references/notebook.md`)
2. Wait briefly for notebook recalculation (~3 seconds, or take a snapshot)
3. Authorize the action:
   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.actions.authorizeByContent('pwd && ls -la /')"
   ```
4. Wait for the result:
   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.actions.waitForResult('pwd && ls -la /', { timeoutMs: 20000 })"
   ```
5. If the result is truncated or you need more detail, re-read the cell:
   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.actions.getResult('pwd && ls -la /')"
   ```

## Direct DOM fallback

If the runtime methods do not find the expected elements, you can fall back to
direct DOM queries:

```bash
agent-browser --session "$SESSION" eval '(() => {
  const cell = [...document.querySelectorAll(".cell")]
    .find(e => (e.innerText || "").includes("pwd && ls -la /"));
  const btn = cell && cell.querySelector("a-button.action_auth");
  if (btn) {
    btn.click();
    return { clicked: true };
  }
  return { clicked: false };
})()'
```
