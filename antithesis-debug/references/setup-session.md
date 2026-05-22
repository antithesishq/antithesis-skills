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

## Launching an MVD session

Before opening a debugger URL, you may need to launch the session first.
`snouty debug` is the launch command. The interface is in flux: feature-detect
by inspecting `snouty debug --help` before deciding which flow to run.

### Step 1: detect the supported parameter

```bash
snouty debug --help
```

Look for `run_id` or `session_id` in the parameter list.

### Step 2a — if `run_id` is supported (preferred path)

Launch the session directly given the run + moment:

```bash
snouty debug \
  --antithesis.debugging.run_id "$RUN_ID" \
  --antithesis.debugging.input_hash "$INPUT_HASH" \
  --antithesis.debugging.vtime "$VTIME" \
  --antithesis.debugging.description "$DESCRIPTION" \
  --antithesis.report.recipients "$EMAIL"
```

Always pass a `description`, and make it **unique and findable later**
(e.g., include the property name, a date stamp, or a ticket id). You'll
use this string to locate the session in the list of debugging sessions
when you (or a teammate) want to come back to it.

Snouty returns the debugging-session URL on success; proceed to "Opening a
debugger URL" below.

### Step 2b — if only `session_id` is supported (current state)

`session_id` and `run_id` are not interchangeable. Until `snouty debug` gains
`run_id` support, ask the user to:

1. Start the MVD session manually from the triage report (or however they
   normally launch).
2. Paste the resulting debugging-session URL back to you.

Then proceed with "Opening a debugger URL" using that URL. This is a temporary
fallback; once snouty supports `run_id`, this step goes away.

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

Then verify auth deterministically by checking the URL the browser landed on:

```bash
agent-browser --session "$SESSION" get url
```

If the URL still starts with `https://$TENANT.antithesis.com/...` you are
authenticated and can proceed. If it redirected to `accounts.google.com`
(or any other login domain), authentication is needed — defer to the
`antithesis-agent-browser` skill's `references/setup-auth.md` for the
interactive login flow. Use the same `--session-name antithesis` so auth
state is shared.

> **The `?auth=v2.public...` token in a debugger URL is NOT a session
> token.** It scopes access to a specific report; a session cookie from a
> full login is still required. Even a fresh PASETO token in the URL
> won't bypass the SSO redirect on first contact. Plan to run the
> interactive login flow once per `--session-name`.

> **Auth domain note:** the `antithesis-agent-browser` `setup-auth.md`
> directs the user to `https://antithesis.com/login/?redirect=home`. That
> establishes auth at the central domain; for tenant subdomains
> (`$TENANT.antithesis.com`) the cookies propagate in the same browser
> session-name, so after login you can re-open the tenant URL headless.

## Injecting the runtime

After the page loads, inject the debugger runtime. This is required for **both**
simplified and advanced modes:

```bash
cat assets/antithesis-debug.js \
  | agent-browser --session "$SESSION" eval --stdin
```

This registers methods on `window.__antithesisDebug` with three namespaces:
`simplified`, `notebook`, and `actions`.

If `window.__antithesisDebug` is missing after a navigation or page reload,
reinject `assets/antithesis-debug.js` and retry.

## Detecting and switching modes

The debugger usually opens in simplified mode, but some tenants may default to
advanced mode. After injecting the runtime, check which mode is active:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.getMode()"
```

Returns `"simplified"` or `"advanced"`. To switch:

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.switchMode("simplified")'
```

## Waiting for readiness

For simplified mode:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.waitForReady()"
```

For advanced mode (notebook):

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.waitForReady()"
```

Both wait methods poll for up to 60 seconds and return a result object with
`ok`, `ready`, `attempts`, and `waitedMs`. On timeout, the result also includes
`details`.

## Snapshot for orientation

After the page is ready, take a snapshot for visual context:

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
