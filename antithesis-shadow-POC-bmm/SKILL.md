---
name: antithesis-shadow-poc-bmm
description: Generate a test setup that can be used by Antithesis to reproduce a known issue from a system.
---

# Brown M&M bug hunt 

## Purpose and Goal

Use this skill to generate an initial SUT in Antithesis to reproduce the known issue supplied

Success means the user is able to:

- Run this SUT locally with docker-compose for sanity check
- Able to iterate on the SUT (docker-compose, system configuration related) easily.
- Able to iterate on the workload for reproducing the issue easily

## Definitions and Concepts

- SUT: System under test. Do not expose this term to users, just used within this file. Refers to the project as a whole that the user wants to run in Antithesis.
- Workload: A synthetic workload designed to exercise the SUT.

## Recommended Requirements

Make sure the user has either the `antithesis-documentation` skill OR the `Antithesis Documentation MCP` installed so you can easily access up to date documentation. See [this reference](references/install-docs-mcp.md) for installation instructions.

## Documentation Grounding

The following documentation pages contain the most relevant content and should be used to ground your understanding before integration begins.

- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup.md`
- Test Composer commands: `https://antithesis.com/docs/test_templates/test_composer_reference.md`
- SDK reference: `https://antithesis.com/docs/using_antithesis/sdk.md`
- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Instrumentation overview: `https://antithesis.com/docs/instrumentation.md`
- Code Coverage Instrumentation: `https://antithesis.com/docs/instrumentation/coverage_instrumentation.md`
- Handling external dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Optimize for testing: `https://antithesis.com/docs/best_practices/optimizing.md`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`

## Additional Reading

The following reading can help you better understand Antithesis and how to use it for software testing

- Property-based testing primer: `https://antithesis.com/resources/property_based_testing/`
- Deterministic simulation testing: `https://antithesis.com/resources/deterministic_simulation_testing/`
- Autonomous testing primer: `https://antithesis.com/resources/autonomous_testing/`
- Writing better software tests: `https://antithesis.com/resources/testing_techniques/`
- Reliability glossary: `https://antithesis.com/resources/reliability_glossary/`

## Reference

A previous research summary should be supplied to provide relevant information on and can be used to validate the approach taken here is consistent with previous research.

## Step by step workflow

Some general considerations when you build things, Antithesis uses podman instead of docker. Also make sure that `docker-compose` command is used, not `docker compose`

### 1. Create the scaffolding for the SUT

1. Create a directory called `config` in the root directory, it will house the `docker-compose.yaml` file, a `config.Dockerfile` for building the config image and other relevant assets needed.

2. Create a directory called `sut` in the root directory, it will house any `Dockerfile` required to build the container image if necessary 

3. Create a directory called `workload` in the root directory, it will house the source code for the workload to run in this SUT as well as the `workload.Dockerfile` to build the workload container image.

4. On the root directory, we should have a `makefile` that can help to build the container images (config, SUT, workload), run various `docker-compose` commands to help test this locally. 

**The output from this setup should be the described directories and other assets created**

### 2. Container image for the SUT

1. For the container image for the SUT, please try the following in preferential order: a. find an existing container image from an available image registry (e.g. docker hub), b. Find an existing Dockerfile available to build the specific version of the SUT for reproducing the issue, use that Dockerfile and supply the `makefile` in the root directory with instructions on how to build for the specific software version, c. The last resort will be to create a Dockerfile that will be able to build the sut.

1a. If you are doing the last resort, you can also try to provide an additional `sut.inst.Dockerfile` file that adds code coverage instrumentation to the build. 

**The output from this step should be either Dockerfiles created in the corresponding directory from step 1 that can be built using the make command or a reference to the container image publically avaiable in the step below**

### 3. The workload container image

The workload container image exercises the SUT with relevant work to reproduce the issue supplied. It should wait for the SUT to be ready/health before starting. 

**Important: when building the workload make sure you are using a client/library version that matches the system we are testing. It is very likely we cannot use the latest client/library version because we are reproducing an older issue**

#### Requirement for the workload
There are a few principles when building a workload to reproduce the issue supplied:
1. The workload should run indefinitely with a combination of actions that would trigger the issue
2. Each time an iteration of the work is completed we should implement an Antithesis sometimes SDK assertion
3. We should implement Antithesis SDK assertion (e.g. always) to check for the invariant violation.
4. Remember when checking for the invariant violation, use retry logic combined with a backoff algorithm since the Antithesis environment is chaotic and hostile.
5. Use Antithesis random SDK to randomize the workload. (For example, randomly connect to a node in the cluster)

#### Additional considerations for the workload
1. Keep the workload as simple as possible, if possible it should not need to keep state and store data and check off against it.
2. Make clear comment on how it works.
3. Implement the workload in the preference of Python, Golang if possible unless the system we are testing have a strong preference of using another programming language.
4. Any configurable parameters for the workload should be exposed as environment variables so they can be set at the `docker-compose.yaml` level

#### Output for the workload container image
We should generate the following:
1. A workload that can connect to the docker-compose setup (e.g. a client that can connect to a cluster)
2. A `workload.Dockerfile` that can be used to run and build both the workload and the workload container image
3. A `make` target in the `makefile` in the root directory to build the workload, it should build the workload with a prefix of the system, e.g. acme-workload
4. Make sure curl is installed in the workload image for debugging.
5. A readme with an explanation of how does the workload work in the `/workload` directory

### 4. The config image

At this point we should be able to assemble a `docker-compose.yaml` that contains the architecture/topology of the SUT. The docker-compose should have all the necessary service to run the SUT and the workload. We should be able to run `docker-compose up` or use a make target from the `makefile` to run this setup locally.

#### Considerations

1. When possible, the services in the `docker-compose.yaml` should perform health checks and we should orchestrate the containers with proper dependency chain. (For example, the workload should be started after the SUT is healthy)
2. When the SUT is ready, emit a ready signal (https://antithesis.com/docs/getting_started/setup#add-a-ready-signal-for-fuzzing) from the workload when possible (using the Antithesis SDK), alternatively it can be done by adding a service using buzybox or similar and emitting a JSONL message.
3. Be as explict as possible in the `docker-compose.yaml`, specify all the environment variable with comment of what they do, etc. 
4. When referencing container images from public registry, please include the full url. For example, docker.io/antithesishq/demo-go-vault:antithesis.
5. We should never include `build` in the docker-compose directive in the `docker-compose.yaml` file

**The output from this step should be a docker-compose.yaml, possibly a .env file for storing environment variables and any other resources required to run the docker-compose.yaml. make target can also be added for starting the docker-compose.yaml, checking the existence of $ANTITHESIS_OUTPUT_DIR/sdk.jsonl for the ready signal and other relevant command**

### 5. Putting it all together

Please make sure to create a readme on the root directory to describe the setup, 
