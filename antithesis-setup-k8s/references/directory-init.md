# Directory Initialization

How to initialize the antithesis working directory.

## Steps

1. Create `antithesis/` at the repo root (or user-specified location).
2. Create `antithesis/config/manifests/` as the subdirectory that will contain a collection of raw manifests for the SUT.
3. Create `antithesis/scratchbook/k8s-minimization/working.md` to store progress of the minimization of the Kubernetes SUT.
4. Fill out `antithesis/scratchbook/k8s-minimization/working.md` with template:

    # K8s Minimization Working File

    ## Application Overview
    <!-- What the SUT is, in a few sentences. Seed from antithesis-research's sut-analysis.md if present; otherwise ask the user. -->

    ## Horizontal classification

    ### Component classification
    - **<component>** - <SUT | Dependency-real | Dependency-stub | Out-of-scope>
        - Status: <Confirmed | Defaulted | Open>
        - Reasoning: <one or two sentences>

    ### Reverse dependencies (descriptive)
    <!-- Things that call the SUT in prod: trigger, payload shape, schedule. Facts, not test-driver prescriptions. -->

    ### Open questions & answers
    - Q: <question asked of the user>
      A: <answer, or "unanswered - proceeding with default x">
    
    ## Component inventory
    <!-- Filled during vertical classification - one entry per KEPT component -->