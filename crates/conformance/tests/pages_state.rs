//! PS-01 policy and actual observation-wrapper regressions, not live acceptance.

use repo_model::{Model, PagesStateEngine, PagesStateError};

#[test]
fn pages_policy_preserves_target_and_transport_requirements() {
    let model = Model::load_from_repo_root().expect("model loads");
    model.check().expect("desired Pages policy is consistent");
    let cfg = &model.pages_state;
    assert_eq!(cfg.spec, "foundry/pages-state/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_active_deployment);
    assert!(cfg.policy.require_https_enforcement);
    assert!(cfg.policy.require_pages_artifact_verification);
    assert!(cfg.policy.prohibit_unverified_pages_origin);
    assert!(cfg.policy.prohibit_stale_deployments);
}

/// Process doubles exercise the actual observation and integrity wrappers. They
/// do not supply production observations, SDK oracle evidence or live acceptance.
#[test]
fn actual_pages_and_integrity_observation_boundary_regressions_ps_01() {
    let status = std::process::Command::new("node")
        .args([
            "--test",
            "tests/publication/live-integrity.test.mjs",
            "tests/publication/pages-deployment.test.mjs",
            "tests/publication/pages-observer.test.mjs",
        ])
        .current_dir(repo_model::repo_root())
        .status()
        .expect("the locked SDK supplies Node for Pages observation verification");
    assert!(
        status.success(),
        "Pages observation boundary regressions failed"
    );
}

/// These comparisons exercise policy rejection, not a claimed GitHub observation.
#[test]
fn supplied_deployment_target_values_must_match_policy() {
    let model = Model::load_from_repo_root().expect("model loads");
    let cfg = &model.pages_state;
    let target = &cfg.deployment_target;
    PagesStateEngine::verify_deployment_target(
        cfg,
        &target.url,
        &target.environment,
        &target.branch,
        &target.build_type,
        target.min_deployment_count,
    )
    .expect("matching synthetic values satisfy the comparison, not deployment acceptance");
    for (url, environment, branch, build_type) in [
        (
            "https://rogue.example.com/foundry-web/",
            target.environment.as_str(),
            target.branch.as_str(),
            target.build_type.as_str(),
        ),
        (
            target.url.as_str(),
            "production",
            target.branch.as_str(),
            target.build_type.as_str(),
        ),
        (
            target.url.as_str(),
            target.environment.as_str(),
            "gh-pages",
            target.build_type.as_str(),
        ),
        (
            target.url.as_str(),
            target.environment.as_str(),
            target.branch.as_str(),
            "legacy",
        ),
    ] {
        let result = PagesStateEngine::verify_deployment_target(
            cfg,
            url,
            environment,
            branch,
            build_type,
            1,
        );
        assert!(matches!(result, Err(PagesStateError::TargetMismatch(_))));
    }
    let result = PagesStateEngine::verify_deployment_target(
        cfg,
        &target.url,
        &target.environment,
        &target.branch,
        &target.build_type,
        0,
    );
    assert!(matches!(
        result,
        Err(PagesStateError::DeploymentInactive(_))
    ));
}

#[test]
fn supplied_https_values_cannot_disable_required_transport_policy() {
    let model = Model::load_from_repo_root().expect("model loads");
    PagesStateEngine::verify_https_enforcement(&model.pages_state, true, "TLSv1.3")
        .expect("matching synthetic values satisfy the comparison, not HTTPS evidence");
    for (enforced, tls) in [(false, "TLSv1.3"), (true, "TLSv1.0")] {
        let result = PagesStateEngine::verify_https_enforcement(&model.pages_state, enforced, tls);
        assert!(matches!(result, Err(PagesStateError::HttpsNotEnforced(_))));
    }
}
