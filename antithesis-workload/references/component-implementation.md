# Component Implementation

## Goal

Implement only the workload-side components the existing code cannot already provide.

## Approach

This is the most open-ended part of the skill. Start with the simplest component that can exercise the target behavior.

## Production Isolation Principles

- Code in the antithesis directory should never make it to production.
- Edits outside that directory should be surgical and walled off or compiled away.
- Antithesis-only code does not need heavy configuration. Prefer simple, explicit logic.

## Common Patterns

- **Client wrappers:** Write thin wrappers around the project's client APIs or protocols when the existing clients do not fit Antithesis workloads cleanly.
- **Mock services:** Replace unimportant dependencies when they add state space without helping test the behavior you care about.

## Fault Tolerance in Workload Code

If you are writing code that connects to a service over the network (e.g., test commands), ensure it handles all forms of temporary network faults. Read the Fault injection documentation to learn which faults your code needs to handle:

- Process kill/restart
- Network partition (full and partial)
- Clock skew
- I/O delays/stalls
