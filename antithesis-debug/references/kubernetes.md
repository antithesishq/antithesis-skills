# Kubernetes Tests

`--container` doesn't work on a Kubernetes test. It looks containers up with podman, but the cluster runs them under k3s and containerd, so every name fails with exit 125 (`no container with name or ID ... found`). Leave out `--container` and use the cluster's tools on the host:

```bash
snouty runs exec "$TARGET" "$HASH" "$VTIME" 'kubectl get pods -A'
snouty runs exec "$TARGET" "$HASH" "$VTIME" \
  'kubectl exec -n <namespace> <pod> -c <container> -- ps aux'
```

`crictl ps` and `crictl exec <container id>` work too.

Event names map straight to pods: `source.container` in `runs search` or `runs logs`
output is `<pod>/<container>`. Get the namespace from `kubectl get pods -A`.

The set of pods changes over a run (scaling, restarts), so list pods at the
moment you exec, not once. `kubectl get events -A --sort-by=.lastTimestamp`
shows what changed recently.

To get a file out, print it through `kubectl exec`:

```bash
snouty runs exec "$TARGET" "$HASH" "$VTIME" \
  'kubectl exec -n <ns> <pod> -c <container> -- cat /path' > file
```

`kubectl` works on the host with no setup, including during network faults.
`podman ps` returns nothing on a Kubernetes test.

To attach gdb to a process in a pod, see `references/gdb.md`.
