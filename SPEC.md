# Foundry publication requirements

The complete product contract belongs to
[uor-foundry](https://github.com/UOR-Foundation/uor-foundry/blob/main/SPEC.md).
This repository publishes that organizational platform; it is not a second
application model.

## Authorized initial scope

The owner authorizes a first functional release of identity, roles, shared
workspaces, persistence, and messaging. All five must be implemented and pass
their complete producer and deployment gates; a mock or draft preview is not
an eligible release. All other services and controls in the complete producer
contract remain required and explicitly unaccepted. Publishing the core does
not establish complete platform implementation or standards compliance.

Foundry supports organizations created through its normal modeled workflows.
Initial product state contains no seeded organization, account, membership,
or UOR-specific authority. The UOR Foundation can be created through the same
flows as any other organization; its name or domain confers no privilege.
Anyone may enroll and create an organization without Foundation or name-owner
approval. Duplicate display names are allowed; distinct UOR-referenced
organization identities govern isolation and authority. Verified email
enrollment, login and recovery are required producer capabilities implemented
through PrismPM and the UOR Framework-native approach, not publisher-added
authentication logic or a requirement to select a hosted authentication vendor.

The producer defines identity, organization isolation, scoped ownership,
permissions, and recovery. Authentication or an application role does not
establish legal identity, organizational appointment, or standards compliance
without its required evidence. The publisher preserves these distinctions
and the exact declared stage.

## Ownership

`uor-foundry` owns the organizational platform model, controls, services,
workflows, permissions, stakeholder Views, and product acceptance, including
normal creation and management of organizations and their sites. It builds
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
- authorized stage, authoritative model identity and complete stage
  service/dependency closure;
- controls, inherited obligations, assessments, and release-state evidence;
- locked SDK, compiler, runtime, and oracle identities; and
- exact generated portal artifact tree and approved deployment configuration.

Verify artifact integrity, producer identity, authorization, evidence validity,
and acceptance independently. A signed SDK, valid digest, signature count,
or passing schema cannot establish core or full Foundry acceptance. Reject
incomplete stage capabilities, draft-preview releases, missing evidence,
scope substitutions, and mismatched model or artifacts.

The producer must pass all pre-publication gates for the entire authorized
stage before a separately authorized deployment. Record the exact live checks
that can run only after deployment; no other unfinished work within that stage
may enter that state. Final acceptance requires all those checks and applicable
operational assessments to pass for
the exact deployed stage. Other required services remain explicitly unaccepted,
not implicitly satisfied or waived. This follows the producer's explicit
producer-ready, deployment-authorized, and accepted states, without inventing
a first-release exception or claiming deployment evidence before it exists.

Publish verified, authorized bytes without rebuilding or rewriting them.
If a target requires changed assets or application behavior, the change returns
to the producer model and its complete acceptance gate. The publisher must not
weaken or replace the producer's acceptance requirements.

## Pages bootstrap

GitHub Actions publishes the verified portal under `/foundry-web/`.
Assets, links, navigation, browser storage, and complete stage stakeholder
journeys must work at that subpath without an `app.uor.foundation` dependency.

The owner requested `https://uor.foundation/foundry-web/`. On 16 September
2026, GitHub associated `uor.foundation` with the separate `website` project;
the Pages API listed this repository's default address as
`https://uor-foundation.github.io/foundry-web/`. The default address is allowed
for the initial release; authorization binds its exact origin and subpath.
Existing website routing must not be changed implicitly. The future
`app.uor.foundation` address is not a prerequisite.

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
and all five core capabilities' independent-user journeys after deployment,
including normal account and organization creation from empty product state,
duplicate-name organization isolation, verified email enrollment, scoped
ownership and role enforcement,
configured authorization quorums, account and ownership recovery, persistent
state, and message exchange. Demonstrate rejection of cross-organization and
unauthorized access with independent users and browser profiles. Neither a
seeded organization nor a privileged test account may substitute for these
journeys. URLs must remain within approved origins and paths; a successful
deployment API response or HTTP 200 alone does not establish correctness.
Failed live verification does not become accepted by updating expected bytes
or omitting failed tests.

Rollback selects another authorized, accepted producer release through the
same checks. Data migration and service recovery remain modeled product
operations, not ad hoc publisher changes.

Keep generated/cache output untracked. Preserve template policy and use atomic
Conventional Commits, pushing to main where permitted and PRs where required.
