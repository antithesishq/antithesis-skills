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
