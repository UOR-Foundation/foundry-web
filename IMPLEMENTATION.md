# Publication status

No Foundry portal deployment is accepted. The complete product requirements
and implementation work are owned by
[uor-foundry](https://github.com/UOR-Foundation/uor-foundry/blob/main/SPEC.md).
[SPEC.md](SPEC.md) defines this repository's publication boundary.

| Required work | Status |
| --- | --- |
| Accepted immutable SDK and template binding | Blocked: production dependency closure cannot resolve `uor-hologram`; draft PR #3 is not acceptance |
| Complete producer model, services, controls, and pre-publication evidence | Required in uor-foundry; no producer-ready full portal release exists |
| SDK acquisition and verification of the exact producer release/artifact closure | Required; existing OCI transport is not evidence of complete publisher integration |
| Approved target and authorized deployment decision | Required; requested domain routing is not configured |
| Actions upload/deploy of unchanged verified assets | Required; no draft-preview deployment substitutes for the product |
| Independent live identity, byte, role/journey, negative, and rollback checks | Required; final acceptance cannot precede these |

The draft binds development candidate index `sha256:60226bc791d4c0e5613402a6be7e63f4963d3faf7f327befcf56fc0e41d0ce21`
from PrismPM `d0174e1d64339f73091fe4c59d5d6bf532a37d1f`, using template policy
`a21a5426c290aeac92df1c0b1c63d9701420ae68`. Independent signature/provenance
verification and actual never-started image captures match for AMD64 and ARM64.
The SDK's normal template and lock checks pass; template update reports no
change. These establish the binding, not producer or production acceptance.

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
