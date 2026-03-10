---
name: antithesis-workload
description: Create a synthetic workload and add Antithesis assertions to exercise and validate the system under test. Run after antithesis-bootstrap.
---

# Antithesis Workload

## Purpose and Goal

Use this skill to add a synthetic workload and Antithesis assertions to a project that has already been bootstrapped with the `antithesis-bootstrap` skill.

Success means the user has:

- A workload that exercises the critical code paths of the system under test.
- Antithesis SDK assertions embedded in the workload and/or the SUT code.
- A working `docker-compose.yaml` that includes the workload container.

## Prerequisites

The `antithesis-bootstrap` skill must have been run first. The `antithesis/` directory must exist with a working compose file that brings up the SUT.

## Definitions and Concepts

- Workload: A synthetic workload designed to exercise the SUT.
- Timeline: A single linear execution of the SUT + Workload. Antithesis runs many timelines in parallel, and arbitrarily branches timelines to search for interesting new behaviors.
- Branch: Rather than starting each timeline from scratch, Antithesis often branches existing timelines near interesting points to more efficiently exercise the SUT. By doing this Antithesis can spend a lot more CPU on "interesting" areas of the code which are more likely to contain bugs.

## Recommended Requirements

Make sure you can access current documentation through the `antithesis-documentation` skill.

## Documentation Grounding

The following documentation pages contain the most relevant content and should be used to ground your understanding before integration begins.

- SDK reference: `https://antithesis.com/docs/using_antithesis/sdk.md`
- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`
- Optimize for testing: `https://antithesis.com/docs/best_practices/optimizing.md`

Do not get confused by mentions of the Test Composer, which is a way of writing workloads. You must not use it, and instead write a custom workload.

## Step-by-Step Workflow

Perform each of the following steps in order, revisiting the previous steps as needed until you're satisfied with the outcome.

1. Analyse critical code paths
2. Add reachability assertions
3. Create workload
4. Rebuild and verify

As you perform each step record plans, notes, and tasks in the `antithesis/notebook` directory created during bootstrap. Refer to the notebook to build on previous decisions.

### 1. Analyse critical code paths

Read the notebook from bootstrap to understand what has been set up. Identify the most critical code paths in the system — these are the paths most likely to contain bugs or where correctness matters most.

- Writes to disk which persist state
- Atomic operations which guarantee ordering or control visibility
- State machines which need to reach a final state

Determine safety properties you want to validate: bad thing never-ever happens.
Figure out how best to reach these code paths. Usually this involves some form of RPC.

IMPORTANT: If in doubt, ask the user which interface you should use to test the system.

**Output of this step:**

Document the critical code paths and properties in the notebook directory.
Include what RPC mechanism you will use.

### 2. Add reachability assertions to system under test

For each of the properties you identified in step 1, add Antithesis SDK reachable / unreachable to the system under test.
Do not add more specialised assertions for now.

Ensure the system under test compiles and that the docker compose setup works.

### 3. Create workload

Pick a language for the workload. Consider SDK availability (Go, Python, Java, C, C++, Rust) and prefer the project's primary language when an SDK exists for it.

Write code that exercises the critical code paths identified in step 1. The workload should:

- Drive the SUT through its API/protocol (HTTP, gRPC, database queries, etc.)
- Include SDK assertions for the most important invariants.
- Handle all forms of temporary network faults — read the Fault injection documentation to learn which faults your code needs to handle.
- Be simple and focused. Code in the antithesis directory should never make it to production.

The workload container will typically emit `setup_complete`.

Here is how a workload is commonly structured:

```
func main() {
  checkThatSystemIsReady() // for example, try executing a simple RPC until it succeeds

  emitSetupComplete()

  for {
    op = chooseRandomOperation(opA, opB, ...)
    op(args)
  }
}

var knowledgeAboutTheSystem

func opA() {
  err = someRPC()
  if err {
    // Do not assert unreachable: may be reached due to fault injection.
    return
  }

  // Include assertions
  // Update knowledgeAboutSystem, for example by recording key / value pairs.
}

func opB() {
  result, err = otherRPC()
  if err {
    return
  }

  // Assert that result does not violate knowledgeAboutTheSystem
}
```

Use the SDK for all randomness to ensure correct integration with the platform.

### 4. Rebuild and verify

Update `antithesis/config/docker-compose.yaml` to add the workload container.

Run `compose up --build` and iterate until everything works. Update `antithesis/test.sh` to run test commands after the SUT starts.

Once everything passes, audit the deployment and guide the user to run via `snouty run`:

```sh
snouty run --webhook basic_test \
  --config ./antithesis/config \
  --test-name "<project>" \
  --duration 30 \
  --recipients "$(git config user.email)"
```

Make sure you write down any discovered issues to the notebook to prevent them in the future.

## Key outputs

- A workload which exercises critical code paths the SUT, including assertions. Probably emitting `setup_complete`.
- Reachability assertions in the SUT.
- A working compose setup
