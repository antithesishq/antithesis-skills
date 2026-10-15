# gdb

- The host has gdb. The system-under-test image often does not. Make sure to omit `--container` flag and reach the process through `/proc/<pid>/root`.
- Point gdb at the container root, or every frame prints as `?? ()`:

  ```
  set sysroot /proc/<pid>/root
  file /proc/<pid>/root/path/to/binary
  attach <pid>
  ```

- On a Kubernetes test, get the container's PID with
  `crictl inspect <container id> | grep -m1 '"pid"'`. That is the container's
  entrypoint, which may be a shell; find the service under it with
  `pgrep -P <pid>` or `pgrep -f <binary>`, then attach as above.

- gdb warns that the target and the debugger are in different PID namespaces
  and calls itself unreliable. Expect that warning.
