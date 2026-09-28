# Publication verification — 28 September 2026

Not production-accepted. No replacement application was deployed.

## Bounded live-asset observation

LA-01 now streams selected assets within their exact SDK size; the unselected
negative audit retains the 64-MiB ceiling. Real HTTP tests cover the complete
maximum, excess/truncated bodies, gzip expansion, redirects, timeout and socket
cleanup. The new behavior test first failed before implementation; three actual
source mutants then failed the bound, EOF and hashing checks.

The locked SDK passed all 218 publication tests, normal model write/readback,
template/lock checks, formatting and Clippy. Complete `just vv` still fails the
unchanged DC-01 `production_deployment_accepted` assertion. These transport
checks are diagnostic infrastructure, not application or deployment acceptance.

## Corrected boundaries

- PS-01/PP-01 policy no longer supplies invented asset digests, producer commit,
  certificate authority or HSTS observations. Closed schemas reject those fields.
- Selection rejects unknown authority fields and non-string release references.
- Pages observations bind the Action URL, publisher SHA, run/attempt, latest
  deployment/status and independently fetched successful publisher job.
- Real HTTP/TLS capture, end-of-capture metadata rechecks and post-audit
  reobservation remain separate from SDK byte integrity and product acceptance.
- Parsed YAML verification binds the complete reviewed workflow graph; skipped
  checks, changed privileges, substituted outputs and extra commands fail.

## Falsification and verification

Inside the locked SDK devcontainer:

| Check | Result |
| --- | --- |
| Selection mutants before correction | Five invalid selections incorrectly passed; all rejected after correction |
| Publisher-job mutants before correction | Ten missing/substituted jobs incorrectly passed; all rejected after correction |
| Pages/pipeline fabricated-evidence tests | Failed before correction; closed policy tests pass |
| `npm test` | 210 passed, zero skipped |
| Model and PS-01/PP-01 Rust slices | Nine model tests and six integration tests passed |
| Model regeneration/readback, formatting, Clippy | Passed |
| Complete `just vv` | Failed at DC-01: `production_deployment_accepted` is false |

Process doubles exercise refusal/wiring only; they are not production evidence.
The workflow oracle includes 49 independently changed source mutations plus
duplicate-key, alias and multi-document rejection. Independent adversarial
review required actual job lookup, partial-failure retention, complete workflow
wiring and final freshness checks; those corrections are included.

## Live observations

At `2026-09-28T04:22:50Z`, the default Pages endpoint returned HTTPS 200 with an
authenticated TLS 1.3 connection, but HTTP also returned 200 without a redirect.
The Pages API reported `https_enforced: false`. Enabling enforcement returned
404, `The certificate does not exist yet`; no domain configuration was changed.
The observer rejected this state. The live publisher remains
`6e86c87c74b441a3f530e1cde9354d11417f6000`.

`model/publication.json` selects no accepted producer release. Complete modeled
core/SDK verification, an authorized immutable producer release, correct Pages
transport, independent live journeys and final acceptance remain required.

## 27 September verification record

The 27 September audit does not accept the deployed application. Its Wasm and
Holo assets are each eight-byte fallbacks. No immutable accepted producer is
selected in `model/publication.json`. All product obligations in `SPEC.md` remain.

### Reproduced defects

Inside the locked devcontainer:

- The four initial tests in `tests/publication/source-free-export.test.mjs`
  failed against exporter revision `6e86c87`: missing authority still produced
  six files and reported success. With the fallback removed, those tests pass.
- The extended suite executes the actual wrapper with isolated process doubles
  and rejects SDK failure, unverified/candidate/wrong-release trust, changed
  model/build/tree, missing/extra/duplicate files, links, traversal and byte
  substitution. These doubles verify orchestration only, never product acceptance.
- `npm run audit:deployed` observed 20 failures across Chromium, Firefox and
  WebKit, including empty Wasm, forged Holo, mutable authority state, locally
  manufactured mailbox proof and accessibility violations in two views. It
  saves raw observations/screenshots in ignored `reports/deployed-audit/`.
- The locked SDK's `prismpm export-browser --help` fails because that immutable
  image does not contain the command. A locally built executable is not a
  substitute for issuing and locking an accepted SDK.

### Required release closure

`scripts/export_browser.sh` delegates to the locked SDK. It cannot create an
application or select a neighboring build. Null selection, existing destination,
failed signature replay or changed bytes prevents upload. The accepted-only
guard currently permits no first publication: initial producer-ready admission
must be implemented in PrismPM with real pre-publication evidence and target/ref
authorization, separately from post-publication acceptance. Merely allowing a
candidate signature would weaken the gate and is prohibited.

The Pages workflow reuses completed bootstrap for the exact current main SHA,
instead of deploying in parallel with it or rerunning it. Export has no Pages
write/signing authority. The protected deployment job executes no repository
script. A live audit follows deployment, but cannot replace required real
independent-user journeys, byte verification, rollback and final acceptance.

`tests/e2e/audit-deployed.mjs` is a negative diagnostic, not the complete oracle.
The removed `run-portal-e2e.mjs` and `verify-live.mjs` accepted a simulation;
their original bytes remain in Git at `6e86c87`, not as runnable acceptance
commands. Complete positive acceptance must exercise generated
behavior, actual mailbox evidence, independent peers and durable recovery,
without private test-state injection or fabricated verification success.

The existing DC-01 full-acceptance assertion must remain red until the actual
required product and live evidence exist. Changing that test to expect success
from synthetic metadata, ignoring it, or removing its obligation is prohibited.

On the correction branch, the complete locked-devcontainer `just vv` passes
template/SDK checks, model validation, formatting and warnings-denied Clippy,
then fails DC-01 because production acceptance is false. The publication unit
suite passes 10/10 Rust cases. Both actual-wrapper suites now pass 60 cases.
Pinned actionlint accepts all workflows. These results do not close DC-01.

Independent review identified output-root symlink substitution and a main-ref
advance during export. A planted root-symlink process double first made the
wrapper accept the substituted directory; the explicit directory check rejects
it. Deployment rechecks current main immediately before the privileged action.
These guards do not claim an atomic transaction with GitHub branch updates.

The live-byte wrapper invokes the existing SDK `verify-browser-publication`
contract, not an HTTP-200 or caller-receipt substitute. It independently pulls
and replays the selected release, then binds observed model/build/tree/target
and the complete file inventory. The first 24 process-boundary cases failed
with the wrapper absent. Independent review then exposed six accepted
substitutions: valid-looking changed file digests/sizes and extra acceptance or
file fields. Those planted defects fail the repaired guard. The complete 32 live
and 28 export cases pass, using the SDK's actual six-file profile, closed
receipt shape and canonical inventory digest. Doubles establish orchestration
only. The immutable SDK update,
real producer and full live journeys remain required.

Pages currently reports HTTPS enforcement disabled. Direct HTTP observation
returned 200 without redirect. An enforcement request failed with GitHub's
`The certificate does not exist yet` response; no setting or DNS was changed.
The negative deployed audit now records actual HTTP upgrade behavior, not the
static `pages_state.toml` TLS claims.

The repeated three-engine audit records 21 failures with HTTP enforcement
included. CI uses the SDK-selected artifact inventory; the unbound manual
diagnostic retains the legacy deployment inventory only. Neither mode signs
acceptance. Publication containers run as the checkout owner; the CI checkout
is made non-group/world-writable to satisfy the SDK export filesystem contract.
The locked SDK lock check and all 60 wrapper cases also pass as a non-root user.
