# Change Log

All notable changes to this project will be documented in this file. Entries
are grouped by date (UTC) with newest first.

## 2026-06-18

- workload: eventually cancels anytime commands; finally waits for all commands to complete ([PR #161](https://github.com/antithesishq/antithesis-skills/pull/161))
- fix: gate agent-browser interactive auth on user confirmation ([PR #167](https://github.com/antithesishq/antithesis-skills/pull/167))

## 2026-06-12

- docs: clarify first_ selection and when test commands should exit non-zero ([PR #164](https://github.com/antithesishq/antithesis-skills/pull/164))

## 2026-06-11

- docs: explain why assertion property names must be inline, constant, and unique ([PR #160](https://github.com/antithesishq/antithesis-skills/pull/160))

## 2026-06-03

- workload exit/state guidance; snouty doctor as triage preflight ([PR #158](https://github.com/antithesishq/antithesis-skills/pull/158))

## 2026-06-01

- update rust instrumentation guidance ([PR #157](https://github.com/antithesishq/antithesis-skills/pull/157))

## 2026-05-28

- python 3.9 compat ([PR #155](https://github.com/antithesishq/antithesis-skills/pull/155))
- improve triage url handling ([PR #154](https://github.com/antithesishq/antithesis-skills/pull/154))

## 2026-05-23

- docs: clarify triage preflight checks and repo guidelines ([PR #153](https://github.com/antithesishq/antithesis-skills/pull/153))

## 2026-05-22

- BREAKING CHANGE: Triage skill using snouty API ([PR #152](https://github.com/antithesishq/antithesis-skills/pull/152))

## 2026-05-21

- antithesis-setup: require full Go instrumentation and CGO ([PR #151](https://github.com/antithesishq/antithesis-skills/pull/151))

## 2026-05-20

- bring setup et al more inline with Antithesis best practices ([PR #134](https://github.com/antithesishq/antithesis-skills/pull/134))

## 2026-05-15

- Make workload fault-tolerance mindset explicit ([PR #150](https://github.com/antithesishq/antithesis-skills/pull/150))

## 2026-05-14

- Add guidance for choosing interesting input values in workloads ([PR #148](https://github.com/antithesishq/antithesis-skills/pull/148))
- Improve randomness usage when creating workloads ([PR #147](https://github.com/antithesishq/antithesis-skills/pull/147))

## 2026-05-13

- Use `snouty launch` instead of `snouty run` ([PR #146](https://github.com/antithesishq/antithesis-skills/pull/146))

## 2026-05-12

- Recommend a simple property first ([PR #145](https://github.com/antithesishq/antithesis-skills/pull/145))
- Recommend one property at a time, don't dump the full catalog ([PR #144](https://github.com/antithesishq/antithesis-skills/pull/144))

## 2026-05-06

- Add antithesis-k8s-onboarding-assistance skill ([PR #142](https://github.com/antithesishq/antithesis-skills/pull/142))

## 2026-05-05

- Ask about external references and record artifact provenance ([PR #141](https://github.com/antithesishq/antithesis-skills/pull/141))
- Surface open questions in property catalog overview ([PR #140](https://github.com/antithesishq/antithesis-skills/pull/140))

## 2026-04-29

- Fix pass/fail count extraction for off-screen and summary-scoped properties ([PR #136](https://github.com/antithesishq/antithesis-skills/pull/136))
- Add multi-test-directories reference doc to workload skill ([PR #137](https://github.com/antithesishq/antithesis-skills/pull/137))

## 2026-04-20

- improve guidance to avoid musl based images ([PR #133](https://github.com/antithesishq/antithesis-skills/pull/133))

## 2026-04-17

- Declare environment requirements in skill frontmatter via compatibility field ([PR #130](https://github.com/antithesishq/antithesis-skills/pull/130))
- Improve descriptions for triage and skills-feedback skills ([PR #128](https://github.com/antithesishq/antithesis-skills/pull/128))

## 2026-04-15

- add flowchart to readme, documented permissions, improved setup skill prereqs ([PR #125](https://github.com/antithesishq/antithesis-skills/pull/125))

## 2026-04-14

- Add design principles to workload skill ([PR #123](https://github.com/antithesishq/antithesis-skills/pull/123))
- Add quiet period guidance to workload skill ([PR #122](https://github.com/antithesishq/antithesis-skills/pull/122))
- Add deterministic randomness cross-reference to test command guidance ([PR #119](https://github.com/antithesishq/antithesis-skills/pull/119))
- Improve test command guidance in workload skill reference ([PR #118](https://github.com/antithesishq/antithesis-skills/pull/118))
- Setup skill: add mid-workflow re-evaluation prompt between implementation phases ([PR #116](https://github.com/antithesishq/antithesis-skills/pull/116))

## 2026-04-10

- rename test composer -> antithesis/test template ([PR #113](https://github.com/antithesishq/antithesis-skills/pull/113))
- Updated fault model to track all supported fault windows ([PR #110](https://github.com/antithesishq/antithesis-skills/pull/110))
- Triage skill: make the skill more reliable by consolidating dom mutation ([PR #111](https://github.com/antithesishq/antithesis-skills/pull/111))

## 2026-04-09

- Add fault documentation to research skill ([PR #109](https://github.com/antithesishq/antithesis-skills/pull/109))
