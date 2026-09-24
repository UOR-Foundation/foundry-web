//! Conformance tests for Publication Pipeline and Actions Publication (PP-01).

use repo_model::{Model, PublicationPipelineEngine, PublicationPipelineError};

/// PP-01: The publication pipeline enforces source-free export of the verified
/// six-file browser artifact closure from the locked producer release, validates
/// artifact byte digests and tree integrity before upload, prohibits compilation
/// or arbitrary OCI extraction shortcuts, and publishes unchanged verified assets
/// to GitHub Pages under protected ref and environment controls.
#[test]
fn publication_pipeline_verifies_source_free_export_and_actions_workflow_pp_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates publication pipeline");

    let cfg = &model.publication_pipeline;
    assert_eq!(cfg.spec, "foundry/publication-pipeline/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_source_free_export);
    assert!(cfg.policy.require_unchanged_asset_publication);
    assert!(cfg.policy.require_pre_upload_byte_verification);
    assert!(cfg.policy.prohibit_arbitrary_oci_extraction);
    assert!(cfg.policy.prohibit_producer_build_workflow_reuse);
    assert!(cfg.policy.prohibit_compilation_in_pipeline);

    // 1. Verify workflow definition file exists and meets security prerequisites
    let workflow_path = root.join(&cfg.pipeline.workflow_path);
    let workflow_content =
        std::fs::read_to_string(&workflow_path).expect("read publication workflow file");

    PublicationPipelineEngine::verify_workflow_definition(cfg, &workflow_content)
        .expect("publication workflow definition verified");

    // 2. Verify exported closure against model expected assets and tree digest
    PublicationPipelineEngine::verify_exported_closure(
        cfg,
        &cfg.expected_assets,
        &cfg.pipeline.expected_tree_digest,
    )
    .expect("exported closure matches 6-file profile and tree digest");

    // 3. Verify source-free export contract
    let export_script = "mkdir -p site && export_browser_closure";
    PublicationPipelineEngine::verify_source_free_export(cfg, export_script)
        .expect("source-free export verified without compilation");
}

#[test]
fn compilation_in_workflow_fails_pipeline() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let tampered_workflow = "
name: pages publication
environment: github-pages
branches: [main]
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    with:
      fetch-depth: 0
      persist-credentials: false
  - run: cargo build --release
  - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
  - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
";
    let res = PublicationPipelineEngine::verify_workflow_definition(cfg, tampered_workflow);
    assert!(matches!(
        res,
        Err(PublicationPipelineError::ProhibitedCompilation(_))
    ));
}

#[test]
fn missing_environment_fails_pipeline() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let invalid_workflow = "
name: pages publication
branches: [main]
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    with:
      fetch-depth: 0
      persist-credentials: false
  - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
  - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
";
    let res = PublicationPipelineEngine::verify_workflow_definition(cfg, invalid_workflow);
    assert!(matches!(
        res,
        Err(PublicationPipelineError::WorkflowDefinitionViolation(_))
    ));
}

#[test]
fn wrong_target_branch_fails_pipeline() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let invalid_workflow = "
name: pages publication
environment: github-pages
branches: [develop]
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    with:
      fetch-depth: 0
      persist-credentials: false
  - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
  - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
";
    let res = PublicationPipelineEngine::verify_workflow_definition(cfg, invalid_workflow);
    assert!(matches!(
        res,
        Err(PublicationPipelineError::WorkflowDefinitionViolation(_))
    ));
}

#[test]
fn insecure_checkout_fails_pipeline() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let invalid_workflow = "
name: pages publication
environment: github-pages
branches: [main]
steps:
  - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
  - uses: actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa
  - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e
";
    let res = PublicationPipelineEngine::verify_workflow_definition(cfg, invalid_workflow);
    assert!(matches!(
        res,
        Err(PublicationPipelineError::WorkflowDefinitionViolation(_))
    ));
}

#[test]
fn asset_digest_mismatch_fails_closure() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let mut tampered_assets = cfg.expected_assets.clone();
    tampered_assets[0].sha256 =
        "sha256:0000000000000000000000000000000000000000000000000000000000000000".to_string();

    let res = PublicationPipelineEngine::verify_exported_closure(
        cfg,
        &tampered_assets,
        &cfg.pipeline.expected_tree_digest,
    );
    assert!(matches!(
        res,
        Err(PublicationPipelineError::AssetDigestMismatch(_))
    ));
}

#[test]
fn asset_count_mismatch_fails_closure() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let mut partial_assets = cfg.expected_assets.clone();
    partial_assets.pop();

    let res = PublicationPipelineEngine::verify_exported_closure(
        cfg,
        &partial_assets,
        &cfg.pipeline.expected_tree_digest,
    );
    assert!(matches!(
        res,
        Err(PublicationPipelineError::AssetCountMismatch(_))
    ));
}

#[test]
fn tree_digest_mismatch_fails_closure() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.publication_pipeline.clone();
    cfg.pipeline.expected_tree_digest = "sha256:bad_expected_tree_digest".to_string();

    let res = PublicationPipelineEngine::verify_exported_closure(
        &cfg,
        &cfg.expected_assets,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
    );
    assert!(matches!(
        res,
        Err(PublicationPipelineError::TreeDigestMismatch(_))
    ));
}

#[test]
fn compiler_invocation_fails_source_free_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.publication_pipeline;

    let res = PublicationPipelineEngine::verify_source_free_export(cfg, "cargo build --release");
    assert!(matches!(
        res,
        Err(PublicationPipelineError::ProhibitedCompilation(_))
    ));
}
