//! Conformance tests for Producer Release Binding and Scope Integrity (PB-01).

use repo_model::{BrowserArtifactRecord, Model, PublisherBindingEngine, PublisherBindingError};

fn expected_distribution_assets() -> Vec<BrowserArtifactRecord> {
    vec![
        BrowserArtifactRecord {
            path: "index.html".to_string(),
            mime_type: "text/html".to_string(),
            size_bytes: 4096,
            sha256: "sha256:7b52662c140dfaa60eefbc603cd7a7f457ffad04543ff32a5ec2c6a084c7a659"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "foundry.js".to_string(),
            mime_type: "application/javascript".to_string(),
            size_bytes: 81920,
            sha256: "sha256:a4b513bc759d57a9cfda598b049d5a6c38234dbb9b5fef729a4bb3c61304526d"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "foundry_bg.wasm".to_string(),
            mime_type: "application/wasm".to_string(),
            size_bytes: 524288,
            sha256: "sha256:e834608c0efee76a9117cf489e02e1b12b557b7f16f56e9c470a2f5bc289128d"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "foundry.css".to_string(),
            mime_type: "text/css".to_string(),
            size_bytes: 16384,
            sha256: "sha256:1a84f3df91753c1537e24bcf84ec758ffaa8b5cb3335bc45ecab076fa2e7f8cb"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "manifest.json".to_string(),
            mime_type: "application/manifest+json".to_string(),
            size_bytes: 1024,
            sha256: "sha256:4d603a1154c16a8d67ec1d90a5015b678ebaf29e313768b31a896cfab1844b20"
                .to_string(),
        },
        BrowserArtifactRecord {
            path: "holo_runtime.holo".to_string(),
            mime_type: "application/octet-stream".to_string(),
            size_bytes: 262144,
            sha256: "sha256:c986161476d05ca91d6c8230eeef2356c9d7494f1b49e1a90c0ef69c2ebf91b7"
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
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
        "docker.io/library/uor-foundry-sdk@sha256:c2e0e50437e13d9b2e382d3af4ae7a962b469721b9b80f14f215d9254e8ed78f",
    )
    .expect("producer release identity verified");

    // 2. Verify bit-for-bit reproducible artifact tree closure and 6 assets
    let expected_assets = expected_distribution_assets();
    PublisherBindingEngine::verify_artifact_tree(
        cfg,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
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
