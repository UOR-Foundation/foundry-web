# Implementation status

The required scope is [SPEC.md](SPEC.md). No application capability is
accepted. The template scaffold is not a running Foundry service.

| Required work | Owner | Status |
| --- | --- | --- |
| Accepted public compiler/runtime dependency closure and Prism SDK | Upstream repositories | Blocked: package gate cannot resolve `uor-hologram`; no accepted SDK lock |
| SDK/template locks, devcontainer, and full acceptance CI | template, foundry-web | Blocked on accepted SDK |
| Complete OSCAL bindings, profile resolution, inheritance, assessments, and oracles | PrismPM, prism-stdlib | Required |
| Complete browser-resident SDK, compilers, oracles, and provider-independent signing | PrismPM and compiler/runtime repositories | Required |
| Foundation, Foundry, stakeholder, authority, and organizational models | uor-foundry | Required |
| Approved standards editions, policies, rights, and assessment inputs | Foundation/model owners | Required; mission alone does not supply these |
| Human-centred design, accessible authoring and user journeys, brands, and presentation | prism-stdlib, foundry-web | Required |
| Browser Kappa services, authorization, durable events, queries, and provenance | kappa-registry, PrismPM | Required |
| Faculty/participant browser networking, discovery, peer replication, recovery, and measured availability | Kappa/runtime models, foundry-web | Required |
| Exact-release Pages bootstrap and authorized independence/rollback lifecycle | PrismPM, foundry-web | Required |
| Git, CI, hosting, scheduling, Prism pipeline, and publication adapters | PrismPM, foundry-web | Required |
| AI inference, agent harnesses, notebooks, and knowledge management | PrismPM, foundry-web | Required |
| Text/multimedia messaging, collaboration, and content creation | PrismPM, foundry-web | Required |
| Administration, governance, change management, and improvement | uor-foundry, foundry-web | Required |
| Business plan, operating procedures, finances, and payments | uor-foundry, foundry-web | Required |
| Learning, assessment, certification, and authority lifecycle | uor-foundry, foundry-web | Required |
| Complete oracle coverage, mutation evidence, browser journeys, fault/recovery and live deployment verification | All implementing repositories | Required |

Each implementation increment must add its modeled capability, behavioral
scenario, failing test, complete implementation, and verification evidence.
Only then may its conformance register claim the evidenced capability.
No row is a deferral, exclusion, or reduced definition of done.

## Verification of the bootstrap

- Whitespace checks passed; inherited agent policy, bootstrap workflow, and
  generated conformance document remain byte-identical to the template.
- [CI at a006253](https://github.com/UOR-Foundation/foundry-web/actions/runs/34928559731)
  failed on both architectures because `prismpm.lock` is absent. No gate was
  disabled and no SDK or application acceptance was claimed.
- The PrismPM source devcontainer's `cargo xtask package-api` fails to resolve
  `uor-hologram`. The last real upstream
  [publication attempt](https://github.com/Hologram-Technologies/hologram/actions/runs/34018837931)
  failed with a publishing-permission error; later successful dry runs do not
  demonstrate publication. The upstream owner must establish authorized
  publication before the SDK dependency closure can be accepted.
