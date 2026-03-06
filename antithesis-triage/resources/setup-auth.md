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

## Session naming

Pick a session name to use based on the current project. Default to `antithesis` if unknown. Replace the variable `$SESSION` with your selected session name in all `agent-browser` commands.

## Checking existing authentication

To check if you are logged in already, run the following commands:

```
agent-browser open --session-name $SESSION https://$TENANT.antithesis.com
agent-browser wait --session-name $SESSION --load networkidle
agent-browser get url --session-name $SESSION
```

If the url starts with `https://$TENANT.antithesis.com` then you are authenticated. If not, you need to authenticate before continuing.

## Authenticating

Authentication requires running `agent-browser` with `--headed` which allows the user to sign in and handle 2FA themselves. Use the following commands to open a browser window for login and then wait for the user to complete auth.

```
agent-browser open --session-name $SESSION --headed "https://antithesis.com/login/?redirect=home"
agent-browser wait --session-name $SESSION --url "**/home"
```

Once the wait command completes successfully, reopen the browser headless before continuing.

```
agent-browser close --session-name $SESSION
agent-browser open --session-name $SESSION https://$TENANT.antithesis.com
```
