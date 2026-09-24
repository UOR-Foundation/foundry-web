//! Conformance tests for Pages State, Deployments, Artifacts, and HTTPS Enforcement (PS-01).

use repo_model::{Model, PagesStateEngine, PagesStateError};

/// PS-01: The GitHub Pages state and deployment boundary establishes non-zero accepted
/// deployments, verified Actions deployment artifacts, HTTPS target enforcement and TLS
/// provisioning, and immutable binding to exact publisher revision and producer release identity.
#[test]
fn pages_state_verifies_deployment_artifacts_and_https_ps_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates pages state");

    let cfg = &model.pages_state;
    assert_eq!(cfg.spec, "foundry/pages-state/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_active_deployment);
    assert!(cfg.policy.require_https_enforcement);
    assert!(cfg.policy.require_pages_artifact_verification);
    assert!(cfg.policy.prohibit_unverified_pages_origin);
    assert!(cfg.policy.prohibit_stale_deployments);

    // 1. Verify deployment target
    PagesStateEngine::verify_deployment_target(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        "github-pages",
        "main",
        "workflow",
        1,
    )
    .expect("deployment target verified");

    // 2. Verify HTTPS enforcement
    PagesStateEngine::verify_https_enforcement(cfg, true, "TLSv1.3")
        .expect("https enforcement and tls verified");

    // 3. Verify artifact state
    PagesStateEngine::verify_artifact_state(
        cfg,
        "github-pages",
        6,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
    )
    .expect("artifact state verified against locked producer release");
}

#[test]
fn target_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_deployment_target(
        cfg,
        "https://rogue.example.com/foundry-web/",
        "github-pages",
        "main",
        "workflow",
        1,
    );
    assert!(matches!(res, Err(PagesStateError::TargetMismatch(_))));
}

#[test]
fn environment_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_deployment_target(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        "production",
        "main",
        "workflow",
        1,
    );
    assert!(matches!(res, Err(PagesStateError::TargetMismatch(_))));
}

#[test]
fn branch_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_deployment_target(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        "github-pages",
        "gh-pages",
        "workflow",
        1,
    );
    assert!(matches!(res, Err(PagesStateError::TargetMismatch(_))));
}

#[test]
fn zero_deployment_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_deployment_target(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        "github-pages",
        "main",
        "workflow",
        0,
    );
    assert!(matches!(res, Err(PagesStateError::DeploymentInactive(_))));
}

#[test]
fn disabled_https_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_https_enforcement(cfg, false, "TLSv1.3");
    assert!(matches!(res, Err(PagesStateError::HttpsNotEnforced(_))));
}

#[test]
fn tls_version_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_https_enforcement(cfg, true, "TLSv1.0");
    assert!(matches!(res, Err(PagesStateError::HttpsNotEnforced(_))));
}

#[test]
fn artifact_name_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_artifact_state(
        cfg,
        "custom-artifact",
        6,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
    );
    assert!(matches!(res, Err(PagesStateError::ArtifactMismatch(_))));
}

#[test]
fn asset_count_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_artifact_state(
        cfg,
        "github-pages",
        5,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
    );
    assert!(matches!(res, Err(PagesStateError::ArtifactMismatch(_))));
}

#[test]
fn tree_digest_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_artifact_state(
        cfg,
        "github-pages",
        6,
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "df50044df62eb0ef7ffebec2804561a9d16b5fc7",
    );
    assert!(matches!(res, Err(PagesStateError::ArtifactMismatch(_))));
}

#[test]
fn producer_commit_mismatch_fails_pages_state() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.pages_state;

    let res = PagesStateEngine::verify_artifact_state(
        cfg,
        "github-pages",
        6,
        "sha256:d8c6b75aeae8c4974fbc173b2c12217c4e5ff09ab683b5444fae9eb10a2bb194",
        "1111111111111111111111111111111111111111",
    );
    assert!(matches!(res, Err(PagesStateError::ArtifactMismatch(_))));
}
