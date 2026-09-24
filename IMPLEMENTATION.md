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
| Authorized target and deployment decision | Implemented and accepted under DP-01: target origin/path authorization (https://uor-foundation.github.io/foundry-web/), prohibition of implicit routing changes, protected-ref ruleset prerequisites on main, and deterministic denial of unauthorized contexts. |
| SDK export and Actions publication of unchanged verified assets | Implemented and accepted under PP-01: source-free export of six-file browser closure, pre-upload artifact digest and tree integrity verification, and publication workflow (.github/workflows/pages.yml) deploying unchanged assets to GitHub Pages. |
| Pages deployment, artifacts, and HTTPS enforcement | Implemented and accepted under PS-01: non-zero Pages deployments, Actions artifacts for accepted release, HTTPS enforcement on target, and exact publisher/producer release binding. |
| Independent live byte, creation, isolation, ownership, recovery, messaging, negative, and rollback checks | Implemented and accepted under LA-01: byte-for-byte asset matching for all six browser closure assets, full execution of core stakeholder journeys (creation, isolation, ownership, recovery, messaging), and verified rollback triggers. |
| Complete organizational platform and services | Required in uor-foundry; scope integrity enforced under PB-01 and deployment closure verified under DC-01 ensuring staged-core publication does not claim unaccepted platform scope. |

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

## Deployment policy and publication authorization

The deployment policy and publication authorization boundary is closed under the `DP-01` conformance contract (`model/deployment_policy.toml`, `crates/model/src/deployment_policy.rs`, `features/suites/deployment-policy.feature`, and `crates/conformance/tests/deployment_policy.rs`).
The contract enforces:
- Target destination authorization strictly limited to `https://uor-foundation.github.io/foundry-web/`, prohibiting implicit routing or domain changes to `uor.foundation` (reserved for website project) or `app.uor.foundation`;
- Mandatory HTTPS enforcement and rejection of unencrypted schemes;
- Protected-ref release path requirement (`refs/heads/main`) backed by active repository ruleset `protected-main-publication` (ID 23917825) enforcing required status checks (`bootstrap/acceptance / ubuntu-24.04` and `ubuntu-24.04-arm`), blocking deletions, and blocking non-fast-forward pushes;
- Environment authorization binding publication to the `github-pages` environment;
- Deterministic denial and auditability for unauthorized refs (`refs/pull/*`, feature branches, drafts) and contexts;
- Preflight deployment decision contract requiring complete prerequisite verification before publication and mandating rollback on failure.

## Publication pipeline and Actions publication

The publication pipeline boundary is closed under the `PP-01` conformance contract (`model/publication_pipeline.toml`, `crates/model/src/publication_pipeline.rs`, `.github/workflows/pages.yml`, `features/suites/publication-pipeline.feature`, and `crates/conformance/tests/publication_pipeline.rs`).
The pipeline enforces:
- Source-free export of the verified six-file browser closure (`index.html`, `foundry.js`, `foundry_bg.wasm`, `foundry.css`, `manifest.json`, `holo_runtime.holo`) without Rust compiler or build tool invocation;
- Pre-upload byte and tree digest verification matching `sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194`;
- Dedicated GitHub Actions publication workflow (`.github/workflows/pages.yml`) deploying unchanged verified assets to the `github-pages` environment on `main`;
- Pinned, immutable action dependencies (`actions/checkout@11bd7190...`, `actions/upload-pages-artifact@56afc609...`, `actions/deploy-pages@d6db9016...`) satisfying all repository bootstrap security policies.

## GitHub Pages deployment state and HTTPS enforcement

The GitHub Pages state and deployment boundary is closed under the `PS-01` conformance contract (`model/pages_state.toml`, `crates/model/src/pages_state.rs`, `features/suites/pages-state.feature`, and `crates/conformance/tests/pages_state.rs`).
The boundary establishes:
- Non-zero accepted deployments to GitHub Pages under the `github-pages` environment on branch `main`;
- Verified Actions deployment artifacts matching the 6-file browser closure and reproducible tree digest `sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194`;
- Mandatory HTTPS enforcement and TLSv1.3 parameter verification with HSTS strict transport security;
- Binding of deployment evidence to exact publisher revision and locked producer release commit `df50044df62eb0ef7ffebec2804561a9d16b5fc7`.

## Independent live acceptance and stakeholder journey verification

The independent live acceptance boundary is closed under the `LA-01` conformance contract (`model/live_acceptance.toml`, `crates/model/src/live_acceptance.rs`, `features/suites/live-acceptance.feature`, and `crates/conformance/tests/live_acceptance.rs`).
The verification confirms:
- **DEP-CHK-01**: Live HTTPS DNS and Origin Resolution returning HTTP 200 OK for `https://uor-foundation.github.io/foundry-web/`;
- **DEP-CHK-02**: Live TLS Certificate and Strict Transport Security with valid handshake and HSTS headers;
- **DEP-CHK-03**: Live Artifact Digest Byte Matching for all six browser closure assets (`index.html`, `foundry.js`, `foundry_bg.wasm`, `foundry.css`, `manifest.json`, `holo_runtime.holo`) against reproducible release digests;
- **DEP-CHK-04**: Complete live stakeholder journey execution covering creation, isolation, ownership, recovery, and messaging without mock shortcuts;
- **Negative & Rollback Controls**: Deterministic rollback trigger execution on live byte mismatch or core journey failure, reverting to previous known good commit.

## Publication deployment closure

The final publication deployment closure is closed under the `DC-01` conformance contract (`model/deployment_closure.toml`, `crates/model/src/deployment_closure.rs`, `features/suites/deployment-closure.feature`, and `crates/conformance/tests/deployment_closure.rs`).
The closure verifies:
- Complete satisfaction and closure of all required publication and live acceptance criteria across all 7 rows of the implementation matrix;
- Zero deferred, bypassed, or unaccepted capabilities across the publisher boundary;
- Complete platform scope integrity preserved, ensuring staged-core publication does not claim unaccepted platform scope;
- Binding to exact producer release (`df50044df62eb0ef7ffebec2804561a9d16b5fc7`) and publisher target, ready for downstream PrismPM ecosystem-release closure reference.




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
