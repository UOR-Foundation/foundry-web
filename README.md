# Foundry Web

The publication repository for the
[UOR Foundry](https://github.com/UOR-Foundation/uor-foundry) PrismPM portal.
`uor-foundry` owns the complete model, services, workflows, and stakeholder
Views; this repository publishes its verified, authorized output without
duplicating application logic. The UOR Foundation is dedicated to the
democratization of technology for the well-being of humanity and operates
under the Citizen Gardens model through a network of Foundries. The first
Foundry is also the Foundation's headquarters.

The initial Pages deployment will use GitHub Actions under `/foundry-web/`.
The default address is `https://uor-foundation.github.io/foundry-web/`;
the requested `https://uor.foundation/foundry-web/` routing is not established.
The future `app.uor.foundation` address is not required for this deployment.

## Status

Created from
[UOR template](https://github.com/UOR-Foundation/template/tree/e0e11ecb1b38e202116d9806887363848629d439).
No full producer release or production deployment is accepted yet.
The publication contract is in [SPEC.md](SPEC.md); remaining work is tracked in
[IMPLEMENTATION.md](IMPLEMENTATION.md).

The SDK/template binding selects an authenticated development candidate.
Reviewed development infrastructure belongs on `main` after the complete
repository gate passes. Main-branch integration does not qualify the SDK or
portal for production release; publication retains its separate acceptance
requirements. Source checkouts and host tools are not substitutes for the
locked SDK.

Application source and acceptance belong in `uor-foundry`, including the
unaccepted draft-preview increment moved out of this repository.
Repository policy is in [AGENTS.md](AGENTS.md) and
[TEMPLATE-CONTRACT.md](TEMPLATE-CONTRACT.md).
