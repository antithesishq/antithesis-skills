# Authentication

If the shared `--session-name antithesis` state does not leave you
authenticated, run an interactive login flow. `agent-browser` will save the
session state automatically because you are using `--session-name`.

Authentication requires running `agent-browser` with `--headed` which allows
the user to sign in and handle 2FA themselves. Use the following commands to
open a browser window for login, then ask the user to complete auth:

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
