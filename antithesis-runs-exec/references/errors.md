# Common Errors

## Errors from the exec request

| Error | Meaning | Fix |
|---|---|---|
| 400 `unknown_moment`: "Moment not warm in the live run and no source_run_id provided" | The moment is real but isn't warm in the target, and the request named no source. On a new session, this also appears for the session's own launch moment while it loads. Passing `--source-run-id` turns the wait into a rewarm with progress, which is the recommended first call. | Add `--source-run-id` with the run the moment comes from. |
| 400 `invalid_vtime` | The hash and vtime are not a real moment. Each hash covers only a short span of vtime, and this vtime is outside it. | Take the hash and vtime together, as a pair, from one event that `snouty runs search` returns. |
| 400 "This run is not currently active or reachable" | The target run has finished and its live window has closed. A run stays reachable for only minutes after it ends. | Open a session with `snouty debug`, then exec against the session's run id. |
| 400 "Invalid root end" | The source run is not the run the moment comes from. | Set `--source-run-id` to the moment's own run. |
| 400 "rewarm did not reach the target moment: N/M inputs replayed" | Replaying the run up to a cold moment stopped partway. N of M inputs were replayed. The server suggests the guest was slow or exited. This is separate from `--timeout`, which doesn't apply to rewarms. | Retry once. If it fails again, pick an earlier moment, especially if it's close to a crash or shutdown where the guest may have exited. If it keeps failing, open a new debugging session closer to the moment. |
| "command timed out after Ns", or "command timed out after the server's default timeout … set a longer timeout with --timeout" | The script ran longer than its timeout: the `--timeout` you set (first form), or the server's 10m default when you set none (second form). It may have taken effect before it was stopped. | Search the run for the script's output (`snouty runs search`) before retrying, especially for scripts that change state. Then raise `--timeout`, or make the script faster. |
| 404 "Resource not found" | One of three things: the tenant doesn't have the feature, the session isn't ready yet, or the source id doesn't exist. | Check the tenant release (64.0 or newer). Check the source id. |
| 500 "An unexpected error occurred" | Seen when a live run is finishing. | Retry. If the run has finished, use a session instead. |

## Client-side errors from snouty

| Error | Meaning | Fix |
|---|---|---|
| "No Antithesis credentials found" | snouty can't find an API key. | Run `snouty login` or set `ANTITHESIS_API_KEY`. |
| Script exits with code 125: `no container with name or ID ... found` | The container named in `--container` doesn't exist. On a Kubernetes test, no name works. | Check the name with `podman ps` on the host. On Kubernetes, leave out `--container` and use `kubectl exec` in the script. |
