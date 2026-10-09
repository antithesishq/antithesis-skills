# gdb

- The host has gdb. The system-under-test image often does not. Make sure to omit `--container` flag and reach the process through `/proc/<pid>/root`.
- Point gdb at the container root, or every frame prints as `?? ()`:

  ```
  set sysroot /proc/<pid>/root
  file /proc/<pid>/root/path/to/binary
  attach <pid>
  ```

- gdb warns that the target and the debugger are in different PID namespaces
  and calls itself unreliable. Expect that warning.
