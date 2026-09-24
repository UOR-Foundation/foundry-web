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
| Accepted immutable SDK and template binding | Implemented and accepted under PW-01: multi-architecture OCI SDK verification across linux/amd64 and linux/arm64, approved export-browser interface support resolving PP7101, and offline dependency closure from Cargo.lock. |
| Complete core model, five services, applicable controls, and pre-publication evidence | Implemented and accepted in uor-foundry (PR-01, IC-01); producer functional core bound under PB-01. |
| Exact producer release, identity, evidence, and complete artifact-tree binding | Implemented and accepted under PB-01: exact producer identity, six distribution assets, bit-for-bit reproducible tree digest, and signed pre-publication evidence. |
| Authorized target and deployment decision | Required; default Pages origin and `/foundry-web/` are allowed for bootstrap |
| SDK export and Actions publication of unchanged verified assets | Required; no Pages publication workflow exists |
| Independent live byte, creation, isolation, ownership, recovery, messaging, negative, and rollback checks | Required; scaffold checks do not establish these behaviors |
| Complete organizational platform and services | Required in uor-foundry; scope integrity enforced under PB-01 ensuring staged-core publication does not claim unaccepted platform scope. |

## SDK boundary

The publisher SDK and template boundary is closed under the `PW-01` conformance contract (`model/publisher_sdk.toml`, `crates/model/src/publisher_sdk.rs`, `features/suites/publisher-sdk.feature`, and `crates/conformance/tests/publisher_sdk.rs`).
The boundary model enforces:
- Verification of the immutable multi-architecture OCI SDK index (`ghcr.io/uor-foundation/prismpm-sdk-candidate@sha256:60226bc791d4c0e5613402a6be7e63f4963d3faf7f327befcf56fc0e41d0ce21`) across `linux/amd64` manifest `sha256:c2e0e504...` and `linux/arm64` manifest `sha256:2f82a04e...`;
- Resolution of the `PP7101` blocker by adopting the reviewed Action pin (`0c85c1f465c1b2b38f149d461992694faadacbfe`) supporting the source-free `export-browser` interface;
- Complete offline dependency closure matching `Cargo.lock` (`sha256:21112a84...`);
- Strict enforcement of local and CI parity without source integration or draft preview shortcuts.

## Producer release and scope integrity binding

The producer release and scope integrity boundary is closed under the `PB-01` conformance contract (`model/publisher_binding.toml`, `crates/model/src/publisher_binding.rs`, `features/suites/publisher-binding.feature`, and `crates/conformance/tests/publisher_binding.rs`).
The binding enforces:
- Exact authorized producer identity (`uor-foundry-producer` 0.1.0 at commit `df50044df62eb0ef7ffebec2804561a9d16b5fc7`, compiler `rustc 1.83.0`, architecture `x86_64-unknown-linux-gnu`, locked SDK `docker.io/library/uor-foundry-sdk@sha256:c2e0e504...`);
- Full distribution artifact tree closure (`sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194`) with bit-for-bit identical reproducible build equality covering all six browser distribution assets (`index.html`, `foundry.js`, `foundry_bg.wasm`, `foundry.css`, `manifest.json`, `holo_runtime.holo`);
- Signed pre-publication evidence in `PRODUCER_READY` state with binding digest `sha256:91bf34020a5664bead868fbfa89196b6e41bf1684fa6e3f8484196c342ebcb92` signed by `uor:authority:producer-pipeline-01`;
- Explicit scope integrity enforcement preventing premature claims of complete platform acceptance (`platform_acceptance_claimed = false`), retaining staged-core boundaries, and tracking the four required live deployment checks (`DEP-CHK-01` through `DEP-CHK-04`).


[SDK integration PR 2](https://github.com/UOR-Foundation/PrismPM/pull/2)
adds source-free HTTPS artifact-byte verification. Its scope excludes producer
readiness, target authorization and service acceptance; it is not in this
repository's locked SDK. Foundry also requires a public effectful application
and browser-system profile. Internal browser primitives and typed transitions
do not enable effects in the existing capability-free application profiles.

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

On 20 September 2026, the Pages API still reported zero deployments and
`https_enforced: false`. Enabling HTTPS through the Pages API failed with
`404: The certificate does not exist yet`; no setting changed. Require HTTPS
and verify the actual target after GitHub provisions its certificate. This
does not authorize a preview or change the five-service publication gate.

The inherited complete `just vv` gate remains required. No empty register,
development SDK, draft preview, or green scaffold substitutes for producer
readiness, authorized publication, and independent live acceptance.
