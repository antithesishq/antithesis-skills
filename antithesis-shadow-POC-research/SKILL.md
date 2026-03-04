---
name: antithesis-shadow-poc-research
description: Performing deep research to understand an open source system to understand its system guarantees, invariants and how to use Antithesis to test it. This is after we already 
---

# Antithesis Research 

## Purpose and Goal

Use this skill to perform initial research into a system 

Success means the user is able to:

- Understand how the system work (For example, this is a specialized database that works with special types of data).
- Provide some examples of similar systems.
- Understand the system guarantees or "invariants" of the system, specifically paying attention to the ones that can be easily tested by Antithesis.
- Provide insight into how to test for the system invariants. What type of workload is required.
- Based on the understanding of Antithesis, find any relevant known issues (bugs) that Antithesis can easily help reproduce.

## Recommended Requirements

Make sure the user has either the `antithesis-documentation` skill OR the `Antithesis Documentation MCP` installed so you can easily access up to date documentation. See [this reference](references/install-docs-mcp.md) for installation instructions.

## Additional Reading

The following reading can help you better understand Antithesis and how to use it for software testing

- Property-based testing primer: `https://antithesis.com/resources/property_based_testing/`
- Deterministic simulation testing: `https://antithesis.com/resources/deterministic_simulation_testing/`
- Autonomous testing primer: `https://antithesis.com/resources/autonomous_testing/`
- Writing better software tests: `https://antithesis.com/resources/testing_techniques/`
- Reliability glossary: `https://antithesis.com/resources/reliability_glossary/`

## Sanity check

Make sure that you check the system against the requirement to run in Antithesis. If the system cannot be run in the Antithesis platform, report back the suspected reasons and stop any additional research activities.

- How Antithesis Works: `https://antithesis.com/docs/introduction/how_antithesis_works`
- The Antithesis Environment: `https://antithesis.com/docs/environment/the_antithesis_environment`

## Output

The research output should consist of the following:

1. A short brief (1 to 2 pages) of how the system work, this should consist of text, diagram and relevant source links/URLs
2. A list of similar systems, a short description of why they are similar and a reference link.
3. A list of system guarantees/invariants, for each system guarantee find out if there are existing tests that can help discover them or provide some suggestions of type of workload/tests that can help validate them. For this seciton, please create citations of where you found the information about the system guarantees (e.g. documentation, source code) and reference them at the end of the document.
4. A list of issues Antithesis can help resolve. This should be a brief description of the issue, how Antithesis can help discovery this easily and a link to the original issue. Prioritize open issues but also list previously fixed issues that Antithesis can help find easily.