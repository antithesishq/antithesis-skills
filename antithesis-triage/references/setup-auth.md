# Setup & Authentication

## Installing agent-browser

If `agent-browser` is not installed you can install it like so:

```
npm install -g agent-browser
agent-browser install
```

Alternatively tell the user to install `agent-browser` from the repo:
https://github.com/vercel-labs/agent-browser/

You should also make sure the `agent-browser` skill is available. If it is not available, install it like so:

```
npx skills add vercel-labs/agent-browser
```

## Tenant ID

Before continuing make sure you either have an Antithesis report url or a tenant id.

Report urls should start with `https://???.antithesis.com` where ??? is the tenant id.

The rest of these resources reference the tenant as `$TENANT`.

If the user already gave you a tokenized report URL (`...?auth=...`), you can
open that report directly without an interactive login step. Keep in mind that a
tokenized report URL gives you report-scoped access, not necessarily a general
tenant session.

## Session naming

Use a fixed persisted session name so `agent-browser` auto-manages saved auth
state for Antithesis. Hardcode `--session-name antithesis` in commands rather
than introducing another variable.

Use a fresh, unique browser session for each triage run so concurrent agents in
the same project do not collide:

```
SESSION="antithesis-triage-$(date +%s)-$$"
```

Replace `$SESSION` in all commands below.

## Checking existing authentication

Create the session with the shared persisted state name:

```
agent-browser --session "$SESSION" --session-name antithesis open "https://$TENANT.antithesis.com"
agent-browser --session "$SESSION" get url
```

If the url starts with `https://$TENANT.antithesis.com` then you are authenticated. If not, you need to authenticate before continuing.

When you need to run report queries, also verify that the current URL is on the
main report view and not a finding hash route.

After each successful `open` call or any other navigation, confirm that the URL
is on the page you expected with `agent-browser wait --fn`, inject the triage
runtime, then call the
appropriate `*.waitForReady()` method before calling
`window.__antithesisTriage` methods:

```bash
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
```

## Authenticating

If the shared `--session-name antithesis` state does not leave you
authenticated, run an interactive login flow. `agent-browser` will save the
session state automatically because you are using `--session-name`.

Authentication requires running `agent-browser` with `--headed` which allows
the user to sign in and handle 2FA themselves. Use the following commands to
open a browser window for login, then wait for the user to complete auth:

```
agent-browser --session "$SESSION" close
agent-browser --session "$SESSION" --session-name antithesis --headed open "https://antithesis.com/login/?redirect=home"
agent-browser --session "$SESSION" wait --url "**/home"
```

Once the wait command completes successfully, close the headed browser and
reopen the same session headless with the same `--session-name antithesis`
before continuing.

```
agent-browser --session "$SESSION" close
agent-browser --session "$SESSION" --session-name antithesis open "https://$TENANT.antithesis.com"
agent-browser --session "$SESSION" get url
cat assets/antithesis-triage.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Use checks like these:

- runs page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname === '/runs'"`
- report page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname.startsWith('/report/')"`
- logs page:
  `agent-browser --session "$SESSION" wait --fn "window.location.pathname === '/search' && new URLSearchParams(window.location.search).has('get_logs')"`

If the browser lands on a login page, Google auth page, or any other unexpected
URL, stop and reauthenticate before injecting the runtime.

## Cleanup

When triage is complete, or if you abort after opening a browser session, close
it explicitly:

```
agent-browser --session "$SESSION" close
```

Closing the live session is safe because the shared Antithesis authentication
state is managed separately by `--session-name antithesis`.
