# Foundry Web

The publication repository for the
[Foundry](https://github.com/UOR-Foundation/uor-foundry) organizational platform.
`uor-foundry` owns the complete model, services, workflows, and stakeholder
Views; this repository publishes its verified, authorized output without
duplicating application logic. Organizations, including the UOR Foundation,
are created through normal modeled workflows. No organization, account, or
UOR-specific authority is preseeded.

The initial Pages deployment will use GitHub Actions under `/foundry-web/`.
The default address is `https://uor-foundation.github.io/foundry-web/`;
the requested `https://uor.foundation/foundry-web/` routing is not established.
The future `app.uor.foundation` address is not required for this deployment.

## Status

Created from
[UOR template](https://github.com/UOR-Foundation/template/tree/e0e11ecb1b38e202116d9806887363848629d439).
No full producer release or production deployment is accepted yet.
The authorized first functional release contains identity, roles, shared
workspaces, persistence, and messaging, not a draft preview. It is not yet
implemented or accepted. All other producer-defined services and controls
remain required and unaccepted; application roles do not establish legal
identity or organizational appointment.
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
