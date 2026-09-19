# Publication status

No Foundry portal deployment is accepted. The complete organizational platform
is owned by [uor-foundry](https://github.com/UOR-Foundation/uor-foundry/blob/main/SPEC.md).
[SPEC.md](SPEC.md) defines this repository's thin publication boundary.

The authorized initial release requires identity, roles, shared workspaces,
persistence, and messaging. It must support normal account and organization
creation, multi-organization isolation, scoped ownership, and recovery without
a seeded organization, account, or UOR-specific authority. UOR Foundation is
created normally; anyone may enroll and create organizations with arbitrary,
non-unique display names. Producer-owned UOR-native email enrollment/login/recovery
and saved-backup-code recovery must be implemented and verified through PrismPM,
including replay/rollback rejection and preservation of scoped authority.
Existing mail infrastructure does not own Foundry account-management logic.
All other producer-defined
services and controls remain required and explicitly unaccepted.

| Required work | Status |
| --- | --- |
| Accepted immutable SDK and template binding | Required; the development candidate is not a production acceptance |
| Complete core model, five services, applicable controls, and pre-publication evidence | Required in uor-foundry; no producer-ready functional core exists |
| Exact producer release, identity, evidence, and complete artifact-tree binding | Required; no publisher binding or registered publisher capability exists |
| Authorized target and deployment decision | Required; default Pages origin and `/foundry-web/` are allowed for bootstrap |
| SDK export and Actions publication of unchanged verified assets | Required; no Pages publication workflow exists |
| Independent live byte, creation, isolation, ownership, recovery, messaging, negative, and rollback checks | Required; scaffold checks do not establish these behaviors |
| Complete organizational platform and services | Required in uor-foundry; not implied by core publication |

## SDK boundary

The locked SDK index is
`sha256:60226bc791d4c0e5613402a6be7e63f4963d3faf7f327befcf56fc0e41d0ce21`,
from PrismPM `d0174e1d64339f73091fe4c59d5d6bf532a37d1f`. Its executable
supports `pull`, `verify-release`, and `inspect` for immutable release
references. On 18 September 2026, `export-browser --help` in that exact image
failed with an unrecognized subcommand.

PrismPM source provides integrity-only `export-browser` for the six generated
browser files of supported application profiles. The shared Action exposes it
from `0c85c1f465c1b2b38f149d461992694faadacbfe`; this repository's older pinned
Action and SDK do not. The Pages lifecycle path rejects execution with `PP7101`.
Adopt reviewed SDK interfaces and verify complete producer artifact coverage,
readiness, target authorization, and live acceptance before publication.
Neither arbitrary OCI extraction nor reuse of the producer build workflow
satisfies the publisher contract.

Foundry publication and verification precede first-party crates.io publication.
The accepted OCI SDK must therefore carry its complete offline dependency
closure, including the modeled Holo/1 implementation and validation oracles.
Development source integration does not establish package or SDK acceptance.

## Verified scaffold, absent deployment

[Bootstrap 35288375929](https://github.com/UOR-Foundation/foundry-web/actions/runs/35288375929)
passed the complete scaffold gate on AMD64 and ARM64 at
`c8d188467154775bd73eca0376d644e358f99e83`. The publisher register is empty;
this pass establishes no product or publication acceptance.

On 18 September 2026, GitHub reported no releases, deployments, or Actions
artifacts. Pages is configured for Actions with no repository custom domain;
its environment permits `main`. Main has no branch protection or ruleset, so
the inherited pipeline's protected-ref authorization would reject publication.
Publication needs its own reviewed authorization and target binding.

Both `https://uor-foundation.github.io/foundry-web/` and
`https://uor.foundation/foundry-web/` returned HTTP 404. `uor.foundation` remains
attached to the separate `website` project; existing routing must not be
changed implicitly. The default Pages URL is sufficient for bootstrap and
`app.uor.foundation` is not a prerequisite.

The inherited complete `just vv` gate remains required. No empty register,
development SDK, draft preview, or green scaffold substitutes for producer
readiness, authorized publication, and independent live acceptance.
