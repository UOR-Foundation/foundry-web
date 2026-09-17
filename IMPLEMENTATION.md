# Publication status

No Foundry portal deployment is accepted. The complete product requirements
and implementation work are owned by
[uor-foundry](https://github.com/UOR-Foundation/uor-foundry/blob/main/SPEC.md).
[SPEC.md](SPEC.md) defines this repository's publication boundary.

| Required work | Status |
| --- | --- |
| Accepted immutable SDK and template binding | Blocked: production dependency closure cannot resolve `uor-hologram`; development integration is not production acceptance |
| Complete producer model, services, controls, and pre-publication evidence | Required in uor-foundry; no producer-ready full portal release exists |
| SDK acquisition and verification of the exact producer release/artifact closure | Required; existing OCI transport is not evidence of complete publisher integration |
| Approved target and authorized deployment decision | Required; requested domain routing is not configured |
| Actions upload/deploy of unchanged verified assets | Required; no draft-preview deployment substitutes for the product |
| Independent live identity, byte, role/journey, negative, and rollback checks | Required; final acceptance cannot precede these |

The SDK already supports immutable `pull` and `verify-release` without local
application source. It lacks a public, verified deployment-artifact exporter;
its Pages lifecycle path currently rejects execution with `PP7101`. Complete
the producer-modeled artifact manifest, confined atomic export, readiness and
target-authorization validation in PrismPM. The publisher must consume that
contract, not extract arbitrary files or reuse the producer build workflow.

The development binding selects candidate index `sha256:60226bc791d4c0e5613402a6be7e63f4963d3faf7f327befcf56fc0e41d0ce21`
from PrismPM `d0174e1d64339f73091fe4c59d5d6bf532a37d1f`, using template policy
`0f1245367d317d439e6752be277047eef76a9e90`. Independent signature/provenance
verification and actual never-started image captures match for AMD64 and ARM64.
The SDK's normal template and lock checks pass; template update reports no
change. These establish the binding, not producer or production acceptance.

The complete current scaffold `just vv` passed on native AMD64 at
`2c92874ba5d9ff30a9516cd3a1671adf57984834` in that exact SDK, including
formatting, template/model checks, tests, Clippy, all-feature compilation, and
dependency advisories. Log SHA-256:
`3166cff729f90eb82037fd71216c413fa0a6e2cd351a79f5361751b0de72d344`.
The register contains zero publisher/product capabilities; this pass does not
establish portal publication. ARM64 CI and every publication requirement above
remain separate checks. No reduced release gate was introduced.

The reviewed template update separates ephemeral private Buildx state from
read-only credentials. Full native AMD64 `just vv` passed again with that
update in the same exact SDK; log SHA-256:
`0c3de0c13f7aa94a3de608ed972a11f883781193bae585521f82aea4be214e76`.
[Hosted bootstrap 35107315049](https://github.com/UOR-Foundation/foundry-web/actions/runs/35107315049)
passed the complete scaffold gate on AMD64 and ARM64 at
`0211c38ea7bb358a86bb9742b23c3521a3ee222e`, including actual Buildx execution.
This confirms the workflow correction, not product or publication acceptance.

On 16 September 2026, the application model and 19 source/configuration/test
files moved byte-for-byte to `uor-foundry`, together with the application
register and gate. The publisher no longer owns draft-preview semantics or
claims. This is an ownership correction, not product acceptance.

GitHub's Pages API reports Actions deployment and no repository custom domain.
Its default URL is `https://uor-foundation.github.io/foundry-web/`.
`uor.foundation` is attached to the separate `website` project, so the requested
`https://uor.foundation/foundry-web/` needs an explicit routing decision.
Both Foundry URLs currently return HTTP 404. No existing website configuration
was changed; `app.uor.foundation` is not required for bootstrap.

The inherited complete `just vv` gate remains active. Missing SDK locks and
missing producer acceptance are not bypassed by an empty publisher register.

## Main-branch repair

SDK binding and dependency repairs are integrated on `main`.
[Bootstrap 35177709316](https://github.com/UOR-Foundation/foundry-web/actions/runs/35177709316)
passed the complete scaffold gate on AMD64 and ARM64 at
`92d34236bbfa7d230dc35a179950859f61dec1f4`. PRs #1 and #3 are merged.

Project-owned dependency maintenance adopts the reviewed guard from template
`1bea460bac6ea50bae53a7eeb674589d7900e6cb`. Only the SDK action and byte-bound
bootstrap workflow use the SDK/template update flow; ordinary weekly Actions
and Cargo updates remain enabled. Universal policy and SDK lock bytes are
unchanged. Full native AMD64 `just vv`, including 22 Rust tests and two Node
tests without skips, passed in the locked SDK; its log is
`target/maintenance-full-vv.log`. The owning guard's negative tests reject
broader or missing exclusions and disabled maintenance.

On 17 September 2026 UTC, the Pages API still reported no deployments and
the default HTTPS URL returned 404. No accepted producer release or Pages
publication workflow exists. These main-branch repairs do not constitute
portal deployment or product acceptance.
