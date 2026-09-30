//! Conformance tests for Producer Release Binding and Scope Integrity (PB-01).

use repo_model::{BrowserArtifactRecord, Model, PublisherBindingEngine, PublisherBindingError};

fn expected_distribution_assets() -> Vec<BrowserArtifactRecord> {
    vec![
        BrowserArtifactRecord {
            path: "app.css".to_string(),
            mime_type: "text/css".to_string(),
            size_bytes: 804,
            sha256: "sha256:93a8e4a6a873f55f56a7adb3a55a49912bdcddd740b1af52f9a27f1403ea0279"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "app.js".to_string(),
            mime_type: "application/javascript".to_string(),
            size_bytes: 3637,
            sha256: "sha256:2a5749531966b54fc67e41bcd781d375a42349c392145e85882fb97d3b12c8f8"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "index.html".to_string(),
            mime_type: "text/html".to_string(),
            size_bytes: 913,
            sha256: "sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "prism_foundry_web.js".to_string(),
            mime_type: "application/javascript".to_string(),
            size_bytes: 6300,
            sha256: "sha256:934556d47c4e35be39a73ea5c3e5a0d6159fc8455a4867bedfea595ee7d10ac4"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "prism_foundry_web_bg.wasm".to_string(),
            mime_type: "application/wasm".to_string(),
            size_bytes: 34948,
            sha256: "sha256:33f7ca6c8ff1bbf9832984210cc6b3b8965a823d2505e4a959bb21e18989dac7"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "provenance.json".to_string(),
            mime_type: "application/json".to_string(),
            size_bytes: 656,
            sha256: "sha256:3ca65ccdd7f985a5efb4a5571507785cc2ccb2aef90777b3944d4b19a3ffa144"
                .to_string(),
        },
    ]
}

/// PB-01: The publisher binding establishes immutable verification of the exact
/// authorized uor-foundry producer release identity, pre-publication evidence, and
/// bit-for-bit reproducible artifact tree closure, while enforcing explicit dependency
/// on complete producer platform acceptance without conflating staged core publication
/// with full platform scope.
#[test]
fn publisher_binding_verifies_producer_and_scope_integrity_pb_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates publisher binding");

    let cfg = &model.publisher_binding;
    assert_eq!(cfg.spec, "foundry/publisher-binding/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_exact_producer_binding);
    assert!(cfg.policy.require_full_artifact_tree_closure);
    assert!(cfg.policy.require_pre_publication_evidence_verification);
    assert!(cfg.policy.prohibit_premature_platform_acceptance);
    assert!(cfg.policy.prohibit_draft_preview_substitutes);
    assert!(cfg.policy.prohibit_unverified_payloads);

    // 1. Verify exact producer release identity
    PublisherBindingEngine::verify_producer_identity(
        cfg,
        "b82a770c8680d2ca142d713915bcbafe0ca74a5e",
        "ghcr.io/uor-foundation/prismpm-sdk-candidate@sha256:60226bc791d4c0e5613402a6be7e63f4963d3faf7f327befcf56fc0e41d0ce21",
    )
    .expect("producer release identity verified");

    // 2. Verify bit-for-bit reproducible artifact tree closure and 6 assets
    let expected_assets = expected_distribution_assets();
    PublisherBindingEngine::verify_artifact_tree(
        cfg,
        "sha256:7b32237988c5c0831a374a795d00fae31c0e93871fd99a22f227c64ac96dd7db",
        &expected_assets,
    )
    .expect("artifact tree and distribution assets verified");

    // 3. Verify signed pre-publication evidence
    PublisherBindingEngine::verify_pre_publication_evidence(
        cfg,
        "sha256:91bf34020a5664bead868fbfa89196b6e41bf1684fa6e3f8484196c342ebcb92",
        "uor:authority:producer-pipeline-01",
    )
    .expect("pre-publication evidence verified");

    // 4. Verify scope integrity (Issue #13)
    PublisherBindingEngine::verify_scope_integrity(cfg)
        .expect("scope integrity verified without premature platform acceptance claim");
}

#[test]
fn commit_mismatch_fails_producer_identity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;

    let res = PublisherBindingEngine::verify_producer_identity(
        cfg,
        "0000000000000000000000000000000000000000",
        &cfg.producer_identity.locked_sdk_image,
    );
    assert!(matches!(
        res,
        Err(PublisherBindingError::IdentityMismatch(_))
    ));
}

#[test]
fn sdk_image_mismatch_fails_producer_identity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;

    let res = PublisherBindingEngine::verify_producer_identity(
        cfg,
        &cfg.producer_identity.commit,
        "docker.io/library/tampered-sdk@sha256:0000",
    );
    assert!(matches!(
        res,
        Err(PublisherBindingError::IdentityMismatch(_))
    ));
}

#[test]
fn tree_digest_mismatch_fails_artifact_tree() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;
    let expected_assets = expected_distribution_assets();

    let res = PublisherBindingEngine::verify_artifact_tree(
        cfg,
        "sha256:bad_tree_digest_000000000000000000000000000000000000000000000000",
        &expected_assets,
    );
    assert!(matches!(res, Err(PublisherBindingError::DigestMismatch(_))));
}

#[test]
fn asset_digest_mismatch_fails_artifact_tree() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;
    let mut tampered_assets = expected_distribution_assets();
    tampered_assets[0].sha256 = "sha256:tampered_index_html".to_string();

    let res = PublisherBindingEngine::verify_artifact_tree(
        cfg,
        &cfg.artifact_tree.tree_digest,
        &tampered_assets,
    );
    assert!(matches!(res, Err(PublisherBindingError::DigestMismatch(_))));
}

#[test]
fn missing_asset_fails_artifact_tree() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;
    let mut missing_assets = expected_distribution_assets();
    missing_assets.pop();

    let res = PublisherBindingEngine::verify_artifact_tree(
        cfg,
        &cfg.artifact_tree.tree_digest,
        &missing_assets,
    );
    assert!(matches!(
        res,
        Err(PublisherBindingError::ArtifactCountMismatch(_))
    ));
}

#[test]
fn unready_release_state_fails_evidence() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.publisher_binding.clone();
    cfg.pre_publication_evidence.release_state = "PRODUCER_DRAFT".to_string();

    let res = PublisherBindingEngine::verify_pre_publication_evidence(
        &cfg,
        &cfg.pre_publication_evidence.binding_digest,
        &cfg.pre_publication_evidence.signing_authority,
    );
    assert!(matches!(
        res,
        Err(PublisherBindingError::EvidenceInvalid(_))
    ));
}

#[test]
fn tampered_binding_fails_evidence() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publisher_binding;

    let res = PublisherBindingEngine::verify_pre_publication_evidence(
        cfg,
        "sha256:tampered_pre_publication_binding",
        &cfg.pre_publication_evidence.signing_authority,
    );
    assert!(matches!(
        res,
        Err(PublisherBindingError::EvidenceInvalid(_))
    ));
}

#[test]
fn premature_platform_acceptance_fails_scope_integrity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.publisher_binding.clone();
    cfg.scope_integrity.platform_acceptance_claimed = true;

    let res = PublisherBindingEngine::verify_scope_integrity(&cfg);
    assert!(matches!(
        res,
        Err(PublisherBindingError::ScopeIntegrityViolation(_))
    ));
}

#[test]
fn missing_deployment_checks_fails_scope_integrity() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.publisher_binding.clone();
    cfg.scope_integrity.required_live_checks.clear();

    let res = PublisherBindingEngine::verify_scope_integrity(&cfg);
    assert!(matches!(
        res,
        Err(PublisherBindingError::ScopeIntegrityViolation(_))
    ));
}
