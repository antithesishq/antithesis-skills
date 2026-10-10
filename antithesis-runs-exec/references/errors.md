# Common Errors

## Errors from the exec request

| Error | Meaning | Fix |
|---|---|---|
| 400 `unknown_moment`: "Moment not warm in the live run and no source_run_id provided" | The moment is real but isn't warm in the target, and the request named no source. On a new session, this also appears for the session's own launch moment while it loads. Passing `--source-run-id` turns the wait into a rewarm with progress, which is the recommended first call. | Add `--source-run-id` with the run the moment comes from. |
| 400 `invalid_vtime` | The hash and vtime are not a real moment. Each hash covers only a short span of vtime, and this vtime is outside it. | Take the hash and vtime together, as a pair, from one event that `snouty runs search` returns. |
| 400 "This run is not currently active or reachable" | The target run has finished and its live window has closed. A run stays reachable for only minutes after it ends. | Open a session with `snouty debug`, then exec against the session's run id. |
| 400 "Invalid root end" | The source run is not the run the moment comes from. | Set `--source-run-id` to the moment's own run. |
| "command timed out after Ns", or "command timed out after the server's default timeout … set a longer timeout with --timeout" | The command hit its timeout: the `--timeout` you set (first form), or the server's 10m default when you set none (second form). If the output showed rewarm progress, the rewarm ran out of time. Otherwise the script was still running and may have taken effect. | If it was rewarming, raise `--timeout` (for example `--timeout 30m`) and retry. Otherwise, search the run for the script's output (`snouty runs search`) before retrying, especially for scripts that change state. |
| 404 "Resource not found" | One of three things: the tenant doesn't have the feature, the session isn't ready yet, or the source id doesn't exist. | Check the tenant release (64.0 or newer). Check the source id. |
| 500 "An unexpected error occurred" | Seen when a live run is finishing. | Retry. If the run has finished, use a session instead. |

## Client-side errors from snouty

| Error | Meaning | Fix |
|---|---|---|
| "No Antithesis credentials found" | snouty can't find an API key. | Run `snouty login` or set `ANTITHESIS_API_KEY`. |
| Script exits with code 125 | The container named in `--container` doesn't exist.| Check the container name, for example with `podman ps` on the host. |
