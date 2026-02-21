---
name: antithesis-bootstrap
description: Bootstrap a minimal Antithesis-ready deployment by preparing the system under test, wiring up Antithesis SDK/instrumentation, packaging Docker images, setting up docker-compose.yaml, and designing a test workload.
---

# Antithesis Bootstrap

## Purpose and Goal

Use this skill to setup a project to run in Antithesis. To learn about Antithesis use the `Antithesis Documentation` skill or directly query the Antithesis Documentation MCP: https://antithesis.com/docs/mcp

Success means the user has:

- One or more pre-built Linux x86-64 Docker images for their system under test and dependencies.
- A `docker-compose.yaml` that can run hermetically (no internet).
- At least one test composer scenario.
- A reliable `setup_complete` signal to let Antithesis know when it can start running scenarios.
- A config image containing the `docker-compose.yaml` and related configuration files.

## Definitions and Concepts

- SUT: System under test. Do not expose this term to users, just used within this file. Refers to the project as a whole that the user wants to run in Antithesis.
- Workload: A synthetic workload designed to exercise the SUT.
- Test Composer: An Antithesis framework which comprises a set of "Test Templates", each containing one or more "Test Command".
- Test Template: A Test Template is a folder of "Test Commands" located at `/opt/antithesis/test/v1/{name}/` possibly distributed or copied across multiple containers. There may be more than one test template. Each timeline will only execute "Test Commands" from a single Test Template.
- Test Command: An executable file in a Test Template with a valid prefix in its name. Valid prefixes are: `parallel_driver_, singleton_driver_, serial_driver_, first_, eventually_, finally_, anytime_`. Prefixes constrain when and how the Test Composer will compose different commands together in a single timeline.
- Timeline: A single linear execution of the SUT + Workload. Antithesis runs many timelines in parallel, and arbitrarily branches timelines to search for interesting new behaviors.
- Branch: Rather than starting each timeline from scratch, Antithesis often branches existing timelines near interesting points to more efficiently exercise the SUT. By doing this Antithesis can spend a lot more CPU on "interesting" areas of the code which are more likely to contain bugs.

## Recommended Requirements

Make sure the user has either the `antithesis-documentation` skill OR the `Antithesis Documentation MCP` installed so you can easily access up to date documentation. See [this reference](references/install-docs-mcp.md) for installation instructions.

## Documentation Grounding

The following documentation pages contain the most relevant content and should be used to ground your understanding before integration begins.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup.md`
- Test Composer commands: `https://antithesis.com/docs/test_templates/test_composer_reference.md`
- SDK reference: `https://antithesis.com/docs/using_antithesis/sdk.md`
- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Instrumentation overview: `https://antithesis.com/docs/instrumentation.md`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Optimize for testing: `https://antithesis.com/docs/best_practices/optimizing.md`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`

## Step-by-Step Workflow

Perform each of the following steps in order, revisiting the previous steps as needed until you're satisfied with the outcome.

1. Create a working directory for Antithesis
2. Understand the System Under Test
3. Plan the System Under Test
4. Implement components
5. Add Antithesis assertions
6. Create test templates and test commands
7. Setup images and `docker-compose.yaml`
8. Audit and prepare for deployment

As you perform each step record plans, notes, and tasks in the notebook directory you will create in step 1. You may want to also write down useful information you've learned in the Antithesis documentation for quick reference later on.

### 1. Create a working directory for Antithesis

Create a directory called `antithesis` at the repository root, unless the user specifies otherwise. This directory will contain Antithesis configuration, entrypoints, workloads, and scripts.

Initialize the directory with the files in assets/antithesis (relative to this skill). Read `AGENTS.md` to familiarize yourself with the purpose of the files in the directory.

The `antithesis` directory contains a subdirectory called `notebook`. Use this directory as persistent memory of what you have learned, planned, and decided as you work. Refer to the notebook directory as needed to reference previous decisions or parallelize your work using subagents.

### 2. Understand the System Under Test

Begin with a comprehensive analysis of the system to determine what we can test + what would benefit the most from testing.

Once you have an understanding of the system come up with a set of properties we want to validate in Antithesis. Generally useful test properties fall into two categories:

- Safety (a.k.a. correctness): bad thing never-ever happens
- Liveness (a.k.a. progress): good thing eventually happens

Next, figure out what the SUT looks like when deployed to Antithesis. Generally, we recommend putting components in separate images where possible.

A simple client-server project might be as simple as this:

```text
+--------------------+      +--------------------+      +--------------------+
| workload client    | ---> | app server         | ---> | database           |
| (test driver)      | <--- | (SUT entrypoint)   | <--- | (dependency)       |
+--------------------+      +--------------------+      +--------------------+
                requests/responses           queries/results
```

Or you may have to build something more complex:

```text
                        +--------------------+
                        | stateful client    |
                        | (workload driver)  |
                        +---------+----------+
                                  |
                                  v
 +--------------------+   +--------------------+   +--------------------+
 | consensus node A   |<->| consensus node B   |<->| consensus node C   |
 +---------+----------+   +---------+----------+   +---------+----------+
           |                        |                        |
           +-----------+------------+------------+-----------+
                       |                         |
                       v                         v
             +--------------------+    +--------------------+
             | minio s3 storage   |    | redis cache        |
             +--------------------+    +--------------------+
```

The deployment topology for Antithesis should be the simplest topology in which you can validate and potentially find errors in the properties you have selected.

For example, if the project includes RAFT consensus, and you decide to validate that the RAFT implementation is correct under fault injection, then you should ensure that you are running at least 3 RAFT replicas.

On the other hand, if you just want to verify that a concurrent caching datastructure is safe under a heavy parallelized workload, a simple client/server deployment may be perfect.

The less you deploy to Antithesis while still covering the code you want to verify, the better the system will perform and find bugs.

**Output of this step:**

Document what you have planned with regard to the ideal System Under Test (SUT) for this project. Write this information to the notebook directory.

### 3. Plan the System Under Test

Now that you understand the SUT, next you need to plan the work required to deploy it to Antithesis. Break down the SUT into three groups: dependencies, services, and clients.

Dependencies are usually the simplest to prepare. You just need to track down a Docker image that runs, simulates, or mocks the dependency. For example, if the project depends on Postgres, then use the official Postgres Docker Image. Alternatively, if the project depends on AWS S3, you'll need to find a S3 compatible service such as Minio.

Services include all of the processes that make up the SUT. You only need to figure out how to package the services we actually plan to put under test. Consult the output of step 2 to determine which services we will need to prepare. Figure out how to split up services between containers, and either find existing Docker files in this project or create a new layered Dockerfile that can build all of the required services.

Client containers will contain the test-composer commands which will generate and run the workload used to exercise the SUT. You may need to write custom code which will run in the Client containers and wrap the Client APIs/protocols supported by the application. It's likely that the client container just emits setup_complete and then sleeps forever, allowing Antithesis to run Test Composer Commands to exercise the SUT.

In addition to figuring out which components make up the SUT, you will need to determine which components you will need to write and which you can re-use. In some situations you may need to write a custom version of a service in the project in order to remove dependencies or mock uninteresting components.

You also need to pick which Antithesis Language SDKs you will need, and learn how to instrument the software for Antithesis. Refer to the SDK reference and Instrumentation overview in the docs for more details.

**Output of this step:**

To complete this step document the different components composing the System Under Test (SUT) and write this information to the notebook directory.

### 4. Implement components

Step 3 documented the various components which make up the System Under Test. For this step, you will need to implement each component which can not be re-used from the existing code. This is the most 'open ended' step of this process, so you may want to start with the simplest thing that works.

While implementing components keep the following principles in mind:

- Code in the antithesis directory should never make it to production
- Edits to other portions of the code should not affect production, make sure to wall off (or ideally compile away) any code that exists outside of the Antithesis directory. Edits outside of the antithesis directory should be surgical.
- Code written which will only run within Antithesis does not need to be highly configurable. Err on the side of simplicity.

Additionally, if you are writing code which will run in Test Commands which connects to a service over the network, you will need to ensure the code handles all forms of temporary network faults. Read the Fault injection page in the documentation to learn which faults your code needs to handle.

### 5. Add Antithesis assertions

For each of the properties you came up with in step 2, figure out how to assert that those properties hold via adding Antithesis SDK assertions to the code. Some of the assertions may be in the workload you write, while others may be embedded deeply in the project's code.

Make sure to use the right assertion for the job.

Always/AlwaysOrUnreachable assertions should be used to validate an expression is always true.

Sometimes assertions should be used to validate that we see an expression is true at least once. These are very useful to verify we see rare codepaths or states, and perhaps want to spend more time exploring them.

Reachable/Unreachable assertions should be used to verify which portions of the code we end up reaching (or not reaching). Reachable assertions can be used to verify the workload is expressive enough, while Unreachable assertions can be used to verify we don't reach unexpected or critical failures.

### 6. Create test templates and test commands

Determine which Test Templates you need. If in doubt just create one Test Template for now. The name doesn't matter to Antithesis.

Then for each Test Template, create all the required Test Commands. Refer to the Test Composer reference to learn about the different prefixes you can use: https://antithesis.com/docs/test_templates/test_composer_reference.md

Refer to previous steps to figure out which commands you need and what the commands should do.

Best practices:

- Commands should eventually exit
- There is a default property which verifies Commands exit 0. Thus, ensure that if commands fail it is because something unexpected has occurred.
- Think of Commands like levers you are exposing to the Antithesis fuzzer. Exposing a suite of interesting commands can make it easier for the fuzzer to discover interesting and potentially erroneous system states.

**Output of this step:**

One or more Test Templates containing Test Command executables written to `antithesis/test-composer/...`.

### 7. Setup images and `docker-compose.yaml`

The goal of this step is to create a working Docker compose configuration in `antithesis/config/docker-compose.yaml`. To do this you will need to create or adjust Dockerfiles so that all required components in the SUT can either be pulled or built.

If you end up needing to create a Dockerfile, create one at `antithesis/Dockerfile` and use named layers to split out different services as needed.

Ensure that you copy the test-composer directory to `/opt/antithesis/test/v1` to at least one image (probably the client or workload image).

Ensure that at least one entrypoint ends up emitting the `setup-complete` event. You may use the `antithesis/setup-complete.sh` script or call the setup complete method on the SDK to accomplish this step. Setup complete should only be emitted once the system is healthy and ready to be tested.

Carefully follow the docker best practices guide here:
https://antithesis.com/docs/best_practices/docker_best_practices

If you need a reliable way to communicate between containers, mount a named volume to every container. This is very useful for sharing configuration files for example.

Once you have a working `docker-compose.yaml`, update `antithesis/test.sh` in order to test the environment locally. This step is not complete until you can fully test the deployment locally + run each Test Command. See the TODOs in `test.sh` for additional details.

**Output of this step:**

A working `docker-compose.yaml` that you can run and test locally. Possibly a new Dockerfile or careful modifications to existing Dockerfiles.

### 8. Audit and prepare for deployment

Carefully review all files in the antithesis deployment directory against this implementation plan. Ensure that the `antithesis/submit.sh` script is updated to build and push all of the required Docker images. Then notify the user that they may run their first Antithesis test.

Guide the user to setup the required env variables (ANTITHESIS_USERNAME, ANTITHESIS_PASSWORD, ANTITHESIS_TENANT, ANTITHESIS_REPO) and then run the submit script. Start with a short duration to verify that the SUT is working as expected. You may need to iterate with the user to fix any issues discovered during deployment. Make sure you write down any discovered issues to your notebook to prevent them in the future.

```sh
./antithesis/submit.sh \
    --registry $ANTITHESIS_REPO \
    --duration 30 --desc "first test run"
```
