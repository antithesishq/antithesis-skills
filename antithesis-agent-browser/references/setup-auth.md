# Authentication

If the shared `--session-name antithesis` state does not leave you
authenticated, run the interactive login flow below. It opens a real, visible
browser window for sign-in and 2FA; `agent-browser` saves the session
automatically because you pass `--session-name`.

## Pre-flight: confirm before opening a window

Never open the login window blind — an unannounced window reads as a security
scare, and a user who walked away (or closes it in annoyance) leaves you
waiting on a sign-in that never completes.

On Linux, check `DISPLAY` and `WAYLAND_DISPLAY`: if neither is set, this is
very likely a remote/headless machine where no window can be shown. On macOS
or elsewhere you cannot tell from the environment.

In every case, before opening anything, tell the user a window is about to
appear for sign-in and ask them to confirm they are present and ready — and to
report if no window shows up, so you stop instead of looping. Only open it once
they confirm. If they cannot see a browser or are not available, STOP: do not
open a window or retry; suggest running you on a machine with a display.

## Interactive login

Open the headed login window:

```sh
agent-browser --session "$SESSION" close
agent-browser --session "$SESSION" --session-name antithesis --headed open "https://antithesis.com/login/?redirect=home"
```

Once the user confirms they have completed authentication, close the headed
browser and reopen the same session headless with the same `--session-name
antithesis` before continuing.

```sh
agent-browser --session "$SESSION" close
agent-browser --session "$SESSION" --session-name antithesis open "https://$TENANT.antithesis.com"
agent-browser --session "$SESSION" get url
```

If this still redirects to a login page, the interactive auth did not
complete. Do NOT loop on the auth check — surface the failure to the user.
