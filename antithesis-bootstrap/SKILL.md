---
name: antithesis-bootstrap
description: Collaboratively bootstrap a minimal Antithesis-ready deployment by selecting a small test target, wiring SDK/instrumentation, packaging pre-built Docker images, composing dependencies, and emitting setup_complete.
---

# Antithesis Bootstrap

## Purpose
Use this skill to get a user's project to a first Antithesis run quickly and safely. Favor a small, high-value slice of the system first, then expand.

Success means the user has:
- One or more pre-built Linux x86-64 Docker images for their system under test and dependencies.
- A `docker-compose.yaml` that can run hermetically (no internet).
- An executable test template at `/opt/antithesis/test/v1/quickstart/singleton_driver_<name>`.
- A reliable `setup_complete` signal (SDK-based preferred; JSONL fallback acceptable).
- A config image that includes orchestration/config files for submission.

## Documentation Grounding
Base recommendations on Antithesis docs, prioritizing:
- Docker Compose setup guide: `https://antithesis.com/docs/getting_started/setup.md`
- Setup guide index: `https://antithesis.com/docs/getting_started.md`
- SDK reference: `https://antithesis.com/docs/using_antithesis/sdk.md`
- Instrumentation overview: `https://antithesis.com/docs/instrumentation.md`
- External dependencies: `https://antithesis.com/docs/reference/dependencies.md`
- Docker best practices: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
- Fallback lifecycle (`setup_complete` JSONL format): `https://antithesis.com/docs/using_antithesis/sdk/fallback/lifecycle.md`

If docs are unavailable, proceed with clearly labeled best-effort guidance.

## Collaboration Rules
- Start by narrowing scope. Ask which single workflow or integration path is most important to test first.
- Prefer the smallest deployable subset over full-system migration.
- Confirm language/runtime per service before choosing SDK/instrumentation steps.
- Use existing integration tests as first test templates when possible.
- Ask only for decisions that materially change architecture (e.g., real dependency vs mock).

## Step-by-Step Workflow

### 1. Choose the first target under test
Drive a short discovery:
- Entry service/process to test first.
- One core behavior to validate (for example: API write + read round trip).
- Minimal dependency set required for that behavior (DB, queue, object store, auth mock, etc).

Output of this step:
- A small "system under test" boundary with named containers.

### 2. Pick SDK and instrumentation approach
For each in-scope service:
- Identify language and runtime.
- Add Antithesis SDK dependency for that language.
- Choose instrumentation path from docs (language-specific instrumentor/tooling where available).
- Ensure build produces Linux x86-64 artifacts.

Guidance:
- Prefer SDK + language-native instrumentation for best coverage/debugging.
- If SDK integration is temporarily blocked, use lifecycle JSONL fallback for `setup_complete` and continue.

### 3. Containerize all required services
Create or adjust Dockerfiles so that:
- Images are pre-built (do not rely on compose-time `build:` in final submission manifests).
- Startup does not fetch internet resources.
- Runtime includes test template location if test driver lives in that image.

Best practices to encode:
- Use `init: true` in compose services when appropriate.
- Use explicit image tags/digests.
- Avoid custom logging drivers.
- Avoid underscores in hostnames.

### 4. Build `docker-compose.yaml` for hermetic execution
Compose should:
- Include the target service(s) and required dependencies (real services or mocks such as MinIO/LocalStack).
- Use `depends_on` and health checks to enforce startup order where needed.
- Use env vars from a `.env` file when applicable.
- Avoid internet-dependent behavior at runtime.

### 5. Add a quickstart test template
Provide at least one executable:
- Path: `/opt/antithesis/test/v1/quickstart/`
- Name: `singleton_driver_<test_name>.<ext>`
- The test should exercise the selected "small first" behavior.

Verify locally with `docker compose exec` before submission.

### 6. Emit `setup_complete` correctly
Preferred:
- Call lifecycle `setup_complete` through the language SDK once the system and workload are truly ready.

Fallback when SDK lifecycle is unavailable:
- Write one JSONL line to `$ANTITHESIS_OUTPUT_DIR/sdk.jsonl`:
`{"antithesis_setup": { "status": "complete", "details": {"message": "Set up complete - ready for testing!" }}}`

Rules:
- Emit only after readiness is real.
- First signal wins; duplicates are ignored.
- Do not let containers exit non-zero before ready signal.

### 7. Prepare submission artifacts
Produce:
- Tagged images for all services (SUT + dependencies + test container if separate).
- Config image (commonly `FROM scratch`) containing `docker-compose.yaml` and required config files.
- A short runbook listing image names/tags and how to trigger a test run.

## Expected Deliverables From This Skill
When this skill is executed well, provide:
- A concrete, minimal test scope statement.
- `Dockerfile` changes for instrumentation/SDK integration.
- `docker-compose.yaml` ready for Antithesis-style hermetic execution.
- Quickstart test driver at the required path and naming pattern.
- `setup_complete` implementation (SDK or JSONL fallback).
- Config image recipe.

## Guardrails
- Do not attempt to test the entire production topology first.
- Do not leave required dependencies unspecified; either containerize or mock each one.
- Do not rely on public internet access from containers at runtime.
- Do not claim readiness signaling is complete without an explicit `setup_complete` path.
- Do not end with vague guidance; end with concrete files, commands, and ownership of next decisions.
