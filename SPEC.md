# Foundry publication requirements

The complete product contract belongs to
[uor-foundry](https://github.com/UOR-Foundation/uor-foundry/blob/main/SPEC.md).
This repository publishes that product; it is not a second Foundation model.

## Ownership

`uor-foundry` owns organizational and site definitions, controls, services,
workflows, permissions, stakeholder Views, and product acceptance. It builds
the complete portal with the PrismPM SDK and prism-stdlib.

`foundry-web` owns immutable producer/SDK release bindings, approved target
configuration, publication, and independent deployed-artifact verification.
It must not duplicate application source, maintain handwritten UI or service
logic, redefine organizational controls, or patch generated assets.

Reusable artifact acquisition, trust verification, and deployment adapters
belong upstream in PrismPM. No vendored SDK, Git/path dependency substitute,
or workflow-only implementation may bypass its public contract.

## Release boundary

The SDK must acquire an exact verified `uor-foundry` release, not a moving
branch, tag, arbitrary build directory, or unchecked workflow artifact.
The release and verification evidence bind:

- producer repository and exact source revision;
- authoritative model identity and complete service/dependency closure;
- controls, inherited obligations, assessments, and release-state evidence;
- locked SDK, compiler, runtime, and oracle identities; and
- exact generated portal artifact tree and approved deployment configuration.

Verify artifact integrity, producer identity, authorization, evidence validity,
and acceptance independently. A signed SDK, valid digest, signature count,
or passing schema cannot establish full Foundry acceptance. Reject partial
or draft-preview releases, missing evidence, and mismatched model or artifacts.

The producer must pass all pre-publication product gates before a separately
authorized deployment. Record the exact live checks that can run only after
deployment; no other unfinished work may enter that state. Final acceptance
requires all those checks and remaining operational assessments to pass for
the exact deployed release. This follows the producer's explicit
producer-ready, deployment-authorized, and accepted states, without inventing
a first-release exception or claiming deployment evidence before it exists.

Publish verified, authorized bytes without rebuilding or rewriting them.
If a target requires changed assets or application behavior, the change returns
to the producer model and its complete acceptance gate. The publisher must not
weaken or replace the producer's acceptance requirements.

## Pages bootstrap

GitHub Actions publishes the verified portal under `/foundry-web/`.
Assets, links, navigation, browser storage, and complete stakeholder journeys
must work at that subpath without an `app.uor.foundation` dependency.

The owner requested `https://uor.foundation/foundry-web/`. On 16 September
2026, GitHub associated `uor.foundation` with the separate `website` project;
the Pages API listed this repository's default address as
`https://uor-foundation.github.io/foundry-web/`. The deployment address must
be confirmed before release. Existing website routing must not be changed
implicitly. The future `app.uor.foundation` address is not a prerequisite.

Pages distributes the producer's verified, authorized bootstrap closure;
it does not supply application backends, peer transport, or proof of
browser-network independence. The complete product's browser-only service, replication,
recovery, and authorized migration requirements remain in force.

## Publication acceptance

Use the template's immutable SDK/devcontainer and complete `just vv` boundary.
Publisher tests must demonstrate rejection of substituted producer/model
identities, absent or state-inappropriate evidence, incomplete or changed
artifact trees, unauthorized targets, unsafe paths, and stale deployment results.

Upload only the verified, authorized artifact closure. Deploy it without a
second build, under the authorized environment and credentials. Bind the
deployment result to the exact publisher revision and producer release.

Verify the actual HTTPS URL, redirect destinations, complete asset bytes,
and generated application's stakeholder journeys after deployment. URLs must
remain within approved origins and paths; a successful deployment API response
or HTTP 200 alone does not establish correctness. Failed live verification
does not become accepted by updating expected bytes or omitting failed tests.

Rollback selects another authorized, accepted producer release through the
same checks. Data migration and service recovery remain modeled product
operations, not ad hoc publisher changes.

Keep generated/cache output untracked. Preserve template policy and use atomic
Conventional Commits, pushing to main where permitted and PRs where required.
