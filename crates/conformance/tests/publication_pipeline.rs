//! PP-01 publisher boundary regressions, not producer or deployment acceptance.

use repo_model::Model;

#[test]
fn publication_pipeline_policy_preserves_source_free_requirements() {
    let model = Model::load_from_repo_root().expect("model loads");
    model
        .check()
        .expect("desired publication policy is consistent");
    let cfg = &model.publication_pipeline;
    assert_eq!(cfg.spec, "foundry/publication-pipeline/1");
    assert_eq!(cfg.stage, "staged-core");
    assert_eq!(cfg.pipeline.artifact_count, 6);
    assert!(cfg.policy.require_source_free_export);
    assert!(cfg.policy.require_unchanged_asset_publication);
    assert!(cfg.policy.require_pre_upload_byte_verification);
    assert!(cfg.policy.prohibit_arbitrary_oci_extraction);
    assert!(cfg.policy.prohibit_producer_build_workflow_reuse);
    assert!(cfg.policy.prohibit_compilation_in_pipeline);
}

/// Actual wrapper execution rejects absent or substituted authority. Process
/// doubles test the boundary only; no fixture can accept a producer or deployment.
#[test]
fn actual_exporter_and_selection_boundary_regressions_pp_01() {
    let dependencies = std::process::Command::new("npm")
        .args([
            "ci",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--cache",
            "/tmp/foundry-publisher-npm",
        ])
        .current_dir(repo_model::repo_root())
        .status()
        .expect("the locked SDK supplies npm for pinned verification dependencies");
    assert!(
        dependencies.success(),
        "locked publication verification dependencies failed installation"
    );
    let status = std::process::Command::new("node")
        .args([
            "--test",
            "tests/publication/source-free-export.test.mjs",
            "tests/publication/selection.test.mjs",
            "tests/publication/pages-workflow.test.mjs",
        ])
        .current_dir(repo_model::repo_root())
        .status()
        .expect("the locked SDK supplies Node for publication verification");
    assert!(
        status.success(),
        "source-free publication boundary regressions failed"
    );
}
