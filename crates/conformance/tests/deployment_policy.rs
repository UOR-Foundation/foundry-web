//! Conformance tests for Deployment Policy and Publication Authorization (DP-01).

use repo_model::{DeploymentPolicyEngine, DeploymentPolicyError, Model};

/// DP-01: The deployment policy and publication authorization boundary enforces approved
/// origin and subpath target authorization (https://uor-foundation.github.io/foundry-web/),
/// prohibits implicit routing or domain changes, binds GitHub Pages environment and branch
/// protection ruleset prerequisites on main, and deterministically denies publication in
/// unauthorized ref or execution contexts.
#[test]
fn deployment_policy_verifies_target_and_publication_authorization_dp_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates deployment policy");

    let cfg = &model.deployment_policy;
    assert_eq!(cfg.spec, "foundry/deployment-policy/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_authorized_target);
    assert!(cfg.policy.require_protected_ref);
    assert!(cfg.policy.require_environment_authorization);
    assert!(cfg.policy.prohibit_implicit_routing_changes);
    assert!(cfg.policy.prohibit_unauthorized_contexts);
    assert!(cfg.policy.enforce_deterministic_denial);
    assert!(cfg.policy.require_rollback_on_failure);

    // 1. Verify authorized target URL and origin
    DeploymentPolicyEngine::verify_target_authorization(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
    )
    .expect("authorized target URL verified");

    // 2. Verify publication authorization on protected ref and github-pages environment
    DeploymentPolicyEngine::verify_publication_authorization(
        cfg,
        "refs/heads/main",
        "github-pages",
    )
    .expect("protected ref and environment authorized");

    // 3. Verify ruleset prerequisites
    let active_checks = [
        "bootstrap/acceptance / ubuntu-24.04",
        "bootstrap/acceptance / ubuntu-24.04-arm",
    ];
    DeploymentPolicyEngine::verify_ruleset_prerequisites(
        cfg,
        "protected-main-publication",
        &active_checks,
        true, // prevents deletion
        true, // prevents non-fast-forward
    )
    .expect("branch ruleset prerequisites verified");

    // 4. Verify deployment decision preflight evaluation
    let passed_preflight = [
        "producer-binding-verified",
        "target-origin-authorized",
        "protected-ref-authorized",
        "status-checks-green",
        "source-free-export-verified",
    ];
    DeploymentPolicyEngine::evaluate_deployment_preflight(cfg, &passed_preflight)
        .expect("preflight checks evaluate successfully");
}

#[test]
fn http_target_fails_authorization() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    let res = DeploymentPolicyEngine::verify_target_authorization(
        cfg,
        "http://uor-foundation.github.io/foundry-web/",
    );
    assert!(matches!(
        res,
        Err(DeploymentPolicyError::UnauthorizedTarget(_))
    ));
}

#[test]
fn disallowed_domain_fails_authorization() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    // Disallowed primary domain uor.foundation (must not implicitly route)
    let res1 = DeploymentPolicyEngine::verify_target_authorization(
        cfg,
        "https://uor.foundation/foundry-web/",
    );
    assert!(matches!(
        res1,
        Err(DeploymentPolicyError::UnauthorizedTarget(_))
    ));

    // Disallowed subdomain app.uor.foundation
    let res2 = DeploymentPolicyEngine::verify_target_authorization(
        cfg,
        "https://app.uor.foundation/foundry-web/",
    );
    assert!(matches!(
        res2,
        Err(DeploymentPolicyError::UnauthorizedTarget(_))
    ));
}

#[test]
fn arbitrary_domain_fails_authorization() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    let res = DeploymentPolicyEngine::verify_target_authorization(
        cfg,
        "https://malicious.example.com/foundry-web/",
    );
    assert!(matches!(
        res,
        Err(DeploymentPolicyError::UnauthorizedTarget(_))
    ));
}

#[test]
fn unauthorized_ref_fails_authorization() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    // Pull request ref
    let res1 = DeploymentPolicyEngine::verify_publication_authorization(
        cfg,
        "refs/pull/42/merge",
        "github-pages",
    );
    assert!(matches!(
        res1,
        Err(DeploymentPolicyError::UnauthorizedRef(_))
    ));

    // Feature branch ref
    let res2 = DeploymentPolicyEngine::verify_publication_authorization(
        cfg,
        "refs/heads/feat/test-branch",
        "github-pages",
    );
    assert!(matches!(
        res2,
        Err(DeploymentPolicyError::UnauthorizedRef(_))
    ));

    // Draft ref
    let res3 = DeploymentPolicyEngine::verify_publication_authorization(
        cfg,
        "refs/heads/draft/wip",
        "github-pages",
    );
    assert!(matches!(
        res3,
        Err(DeploymentPolicyError::UnauthorizedRef(_))
    ));
}

#[test]
fn unauthorized_environment_fails_authorization() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    let res = DeploymentPolicyEngine::verify_publication_authorization(
        cfg,
        "refs/heads/main",
        "production",
    );
    assert!(matches!(
        res,
        Err(DeploymentPolicyError::UnauthorizedEnvironment(_))
    ));
}

#[test]
fn missing_status_checks_fails_ruleset() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    // Only AMD64 present, ARM64 missing
    let partial_checks = ["bootstrap/acceptance / ubuntu-24.04"];
    let res = DeploymentPolicyEngine::verify_ruleset_prerequisites(
        cfg,
        "protected-main-publication",
        &partial_checks,
        true,
        true,
    );
    assert!(matches!(
        res,
        Err(DeploymentPolicyError::RulesetViolation(_))
    ));
}

#[test]
fn unprotected_deletion_or_force_push_fails_ruleset() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;
    let active_checks = [
        "bootstrap/acceptance / ubuntu-24.04",
        "bootstrap/acceptance / ubuntu-24.04-arm",
    ];

    // Deletion allowed
    let res1 = DeploymentPolicyEngine::verify_ruleset_prerequisites(
        cfg,
        "protected-main-publication",
        &active_checks,
        false,
        true,
    );
    assert!(matches!(
        res1,
        Err(DeploymentPolicyError::RulesetViolation(_))
    ));

    // Force push allowed
    let res2 = DeploymentPolicyEngine::verify_ruleset_prerequisites(
        cfg,
        "protected-main-publication",
        &active_checks,
        true,
        false,
    );
    assert!(matches!(
        res2,
        Err(DeploymentPolicyError::RulesetViolation(_))
    ));
}

#[test]
fn missing_preflight_check_fails_decision() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.deployment_policy;

    // Incomplete preflight
    let partial_preflight = ["producer-binding-verified", "target-origin-authorized"];
    let res = DeploymentPolicyEngine::evaluate_deployment_preflight(cfg, &partial_preflight);
    assert!(matches!(
        res,
        Err(DeploymentPolicyError::PreflightCheckFailed(_))
    ));
}
