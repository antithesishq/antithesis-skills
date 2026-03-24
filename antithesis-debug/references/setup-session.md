# Setup & Session

## Prerequisites

If `agent-browser` is not installed you can install it like so:

```
npm install -g agent-browser
agent-browser install
```

You should also make sure the `agent-browser` skill is available. If it is not available, install it like so:

```
npx skills add vercel-labs/agent-browser
```

## Session naming

Use a fresh, unique browser session for each debugging run so concurrent agents
do not collide:

```
SESSION="antithesis-debug-$(date +%s)-$$"
```

Always pair with `--session-name antithesis` so `agent-browser` manages shared
authentication state automatically.

Replace `$SESSION` in all commands below.

## Opening a debugger URL

Open the provided URL:

```bash
agent-browser --session "$SESSION" --session-name antithesis open "$URL"
agent-browser --session "$SESSION" wait --load networkidle
```

Then verify the page loaded:

```bash
agent-browser --session "$SESSION" eval 'document.title'
```

If the page title indicates a login page or error, authentication is needed.
Defer to the `antithesis-triage` skill's `references/setup-auth.md` for the
interactive login flow. Use the same `--session-name antithesis` so auth state
is shared.

## Injecting the runtime

After the page loads, inject the debugger runtime:

```bash
cat assets/antithesis-debug.js \
  | agent-browser --session "$SESSION" eval --stdin
```

This registers methods on `window.__antithesisDebug`. Call those methods with
`agent-browser eval`.

Then wait for the notebook to be ready:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.waitForReady()"
```

The wait method polls for up to 60 seconds and returns a result object with
`ok`, `ready`, `attempts`, and `waitedMs`. On timeout, the result also includes
`details`.

If `window.__antithesisDebug` is missing after a navigation or page reload,
reinject `assets/antithesis-debug.js` and retry.

## Snapshot for orientation

After the runtime is ready, take a snapshot for visual context:

```bash
agent-browser --session "$SESSION" snapshot -i -C
```

## Cleanup

When debugging is complete, or if you abort after opening a browser session,
close it explicitly:

```bash
agent-browser --session "$SESSION" close
```

Closing the live session is safe because the shared Antithesis authentication
state is managed separately by `--session-name antithesis`.
