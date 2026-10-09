# Virtual Time

- A **moment** is an immutable snapshot: an input hash plus a vtime. Each
  `exec` branches from it, so calls never affect each other.
- The same script from the same moment gives the same result. Repeating it
  does not sample new timings.
- Between calls nothing runs. Virtual time advances only **while your script
  runs**
- So a probe sees the state slightly after its moment. A transient event can
  be gone by the time the probe looks.
- To see state at vtime X, exec from an earlier moment. Take that hash and
  vtime pair from an earlier event. Don't just subtract from the vtime: the
  result may fall outside the hash's span (`invalid_vtime`).
- Keep probes short, and take one snapshot at the right moment instead of
  polling. Long or repeated probes shift the timing you are trying to observe.
- If a bug disappears when you probe closely, the probe may be perturbing it.
  That points to a timing-sensitive race.
- To carry state from one exec to the next (a file written, a process started,
  time passed), exec from the previous call's end moment: the `end moment:
  HASH VTIME` line on stderr, or `end_moment` in the `--json` result.
- To let the system run forward, put `sleep N` in the script, then exec from
  its end moment.
- Branches from the same moment replay identically, so PIDs and addresses
  match across calls. A PID found in one probe works in the next, though
  `pgrep` inside the script is simpler.
