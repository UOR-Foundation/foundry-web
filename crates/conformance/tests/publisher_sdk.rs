//! Conformance tests for Publisher SDK and template binding (PW-01).

use repo_model::{Model, PublisherSdkEngine, PublisherSdkError};

/// PW-01: The publisher SDK and template boundary enforces immutable multi-architecture
/// OCI SDK verification across linux/amd64 and linux/arm64, approved export-browser
/// interfaces, offline dependency closure, and parity between local and CI execution
/// contracts without source integration or draft preview shortcuts.
#[test]
fn publisher_sdk_verifies_multi_arch_and_export_browser_pw_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates publisher SDK");

    let cfg = &model.publisher_sdk;
    assert_eq!(cfg.spec, "foundry/publisher-sdk/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_immutable_sdk_binding);
    assert!(cfg.policy.prohibit_source_integration);
    assert!(cfg.policy.prohibit_scaffold_only_acceptance);
    assert!(cfg.policy.require_multi_architecture_verification);
    assert!(cfg.policy.require_export_browser_interface);

    // 1. Multi-architecture manifest verification (linux/amd64 and linux/arm64)
    PublisherSdkEngine::verify_sdk_platform_parity(
        cfg,
        "linux/amd64",
        "sha256:c2e0e50437e13d9b2e382d3af4ae7a962b469721b9b80f14f215d9254e8ed78f",
    )
    .expect("linux/amd64 manifest matches");

    PublisherSdkEngine::verify_sdk_platform_parity(
        cfg,
        "linux/arm64",
        "sha256:2f82a04e8f8141636e03a219d3960e30d98a6f304828341dd47b553b3c23baeb",
    )
    .expect("linux/arm64 manifest matches");

    // 2. Export-browser interface verification (resolves PP7101)
    PublisherSdkEngine::verify_export_browser_support(cfg)
        .expect("export-browser is supported and action_ref is pinned");

    // 3. Offline dependency closure
    PublisherSdkEngine::verify_offline_closure(
        cfg,
        "sha256:21112a84d412b18aa2f8fe0eeea206b026771ef827798ce02f43bbefb33fa4fe",
    )
    .expect("Cargo.lock digest matches");
}

#[test]
fn unsupported_architecture_fails_parity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_sdk;

    let res = PublisherSdkEngine::verify_sdk_platform_parity(cfg, "windows/amd64", "sha256:0000");
    assert!(matches!(
        res,
        Err(PublisherSdkError::ArchitectureMismatch(_))
    ));
}

#[test]
fn manifest_mismatch_fails_parity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_sdk;

    let res = PublisherSdkEngine::verify_sdk_platform_parity(
        cfg,
        "linux/amd64",
        "sha256:bad0000000000000000000000000000000000000000000000000000000000000",
    );
    assert!(matches!(res, Err(PublisherSdkError::DigestMismatch(_))));
}

#[test]
fn disabled_export_browser_fails_verification() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.publisher_sdk.clone();
    cfg.sdk_binding.supports_export_browser = false;

    let res = PublisherSdkEngine::verify_export_browser_support(&cfg);
    assert!(matches!(
        res,
        Err(PublisherSdkError::ExportBrowserUnavailable(_))
    ));
}

#[test]
fn cargo_lock_mismatch_fails_closure() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_sdk;

    let res = PublisherSdkEngine::verify_offline_closure(cfg, "sha256:tampered_lock");
    assert!(matches!(res, Err(PublisherSdkError::DigestMismatch(_))));
}
