# Template repository verification

This repository's `just vv` instantiates the universal verification policy in
`VERIFICATION.md` for the empty template itself.

| `just` recipe | Enforces | ID classes |
| --- | --- | --- |
| `just fmt-check` | the diff is reviewable | --- |
| `just model` | R1, R4, R5 | `CM-01` |
| `just lint` | clippy at `-D warnings` | --- |
| `just test` | the workspace suite | --- |
| `just features` | every optional feature compiles, with its tests | --- |
| `just bdd` | R3 and R2's behavioral half | `CM-02`, `CM-03` |
| `just deny` | R6 over the dependency graph | --- |
| `just template-check` | immutable SDK selection, template drift, and bootstrap least privilege | --- |

The register is empty, so its anti-vacuity check is armed rather than claiming
that features exist. It becomes an error as soon as an ID, scenario, or test is
added without the other two.

## Planted defects

| Gate | Planted defect | Result |
| --- | --- | --- |
| `check-model` | `CONFORMANCE.md` disagrees with the register | rejected |
| `audit-deferral` | a deferral marker in a crate and in the gate's own source | both rejected |
| honesty meta-gate | an ID with no test | armed by the empty register |
| `audit-bootstrap` | a floating/copied action, mutable SDK tag, changed universal file, narrowed boundary, shallow/credential-retaining checkout, copied project renderer, omitted standards lock, acceptance bypass, deploy-job signing privilege, or incomplete release lifecycle | all rejected |

`audit-deferral` reads every crate and `xtask`, including itself. Its token
construction therefore cannot exempt the very gate in which a deferral could
otherwise be hidden.

## Initial SDK policy binding preparation

This source-only proposal imports the seven reviewed bootstrap, renderer,
contract and native-audit files byte-for-byte from
`UOR-Foundation/template@a21a5426c290aeac92df1c0b1c63d9701420ae68`.
It is based on Foundry main
`2530e40be1c831f5288295b1b0b4376818f7ca54`, independently of application work.
No application capability, SDK lock or standards selection is introduced.

Component checks ran offline as UID 1000 in the existing local SDK image ID
`sha256:a6ca6a0ef68697755ee7aa109e4d240dba6b386b9290639ebd48340aea59578f`:
all 11 `xtask` tests (including absent/matching/different standards-lock cases),
all-target Clippy at `-D warnings`, shell/Node syntax, and `check-model` passed.
The model remains the empty scaffold with zero claimed application IDs.
These checks are not a published SDK identity or this repository's full
`just vv` acceptance. Before merge, render the real candidate image inventory
and locks on this branch using the exact template revision above, run the
complete scaffold `just vv` inside that selected image, and require its CI.
