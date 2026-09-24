//! Conformance tests for Deployment Closure, Full Matrix Acceptance,
//! and Ecosystem Publication Completion (DC-01).

use repo_model::{DeploymentClosureEngine, DeploymentClosureError, Model};

/// DC-01: The publication deployment closure enforces complete satisfaction of all
/// required publication and live acceptance criteria, verifies zero outstanding gaps
/// across implementation and conformance registers, and establishes accepted ecosystem
/// release closure referencing verified production deployments.
#[test]
fn deployment_closure_verifies_full_acceptance_matrix_dc_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates deployment closure");

    let cfg = &model.deployment_closure;
    assert_eq!(cfg.spec, "foundry/deployment-closure/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.production_deployment_accepted);
    assert!(cfg.policy.all_implementation_rows_closed);
    assert!(cfg.policy.ecosystem_closure_ready);
    assert!(cfg.policy.platform_scope_integrity_preserved);

    // 1. Verify that every required row is accepted or scope-preserved
    DeploymentClosureEngine::verify_closure_matrix(cfg)
        .expect("all 7 implementation matrix rows verified and closed");

    // 2. Verify closure evidence binding
    DeploymentClosureEngine::verify_closure_evidence(
        cfg,
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
        "https://uor-foundation.github.io/foundry-web/",
    )
    .expect("closure evidence verified against producer and publisher targets");
}

#[test]
fn unaccepted_status_fails_closure_matrix() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.deployment_closure.clone();

    // Tamper one row to PENDING
    cfg.implementation_matrix[0].status = "PENDING".to_string();

    let res = DeploymentClosureEngine::verify_closure_matrix(&cfg);
    assert!(matches!(
        res,
        Err(DeploymentClosureError::UnsatisfiedRequirement(_))
    ));
}

#[test]
fn missing_authority_fails_closure_matrix() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let mut cfg = model.deployment_closure.clone();

    cfg.implementation_matrix[0].conformance_authority = "".to_string();

    let res = DeploymentClosureEngine::verify_closure_matrix(&cfg);
    assert!(matches!(
        res,
        Err(DeploymentClosureError::UnsatisfiedRequirement(_))
    ));
}

#[test]
fn commit_mismatch_fails_closure_evidence() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_closure;

    let res = DeploymentClosureEngine::verify_closure_evidence(
        cfg,
        "0000000000000000000000000000000000000000",
        "https://uor-foundation.github.io/foundry-web/",
    );
    assert!(matches!(
        res,
        Err(DeploymentClosureError::EvidenceMismatch(_))
    ));
}

#[test]
fn target_url_mismatch_fails_closure_evidence() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_closure;

    let res = DeploymentClosureEngine::verify_closure_evidence(
        cfg,
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
        "https://other-target.github.io/foundry-web/",
    );
    assert!(matches!(
        res,
        Err(DeploymentClosureError::EvidenceMismatch(_))
    ));
}
