//! Deployment policy and publication authorization model: defines target origin and subpath
//! authorization, protected-ref and ruleset prerequisites, preflight deployment decisions,
//! and deterministic denial of unauthorized contexts.
//!
//! Conformance ID: `DP-01` (suite: `deployment-policy`).

use serde::{Deserialize, Serialize};

/// Errors arising during deployment policy and publication authorization verification.
#[derive(Debug, Clone, PartialEq)]
pub enum DeploymentPolicyError {
    /// Target URL or origin is unauthorized or violates routing policy.
    UnauthorizedTarget(String),
    /// Git ref is not permitted to publish.
    UnauthorizedRef(String),
    /// Publication environment is unauthorized.
    UnauthorizedEnvironment(String),
    /// Branch protection or ruleset prerequisite violation.
    RulesetViolation(String),
    /// Required deployment preflight check failed or missing.
    PreflightCheckFailed(String),
    /// General validation error.
    Validation(String),
}

impl std::fmt::Display for DeploymentPolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnauthorizedTarget(t) => write!(f, "unauthorized target: {t}"),
            Self::UnauthorizedRef(r) => write!(f, "unauthorized git ref: {r}"),
            Self::UnauthorizedEnvironment(e) => write!(f, "unauthorized environment: {e}"),
            Self::RulesetViolation(rv) => write!(f, "ruleset violation: {rv}"),
            Self::PreflightCheckFailed(pc) => write!(f, "deployment preflight check failed: {pc}"),
            Self::Validation(v) => write!(f, "deployment policy validation error: {v}"),
        }
    }
}

impl std::error::Error for DeploymentPolicyError {}

/// Policy configuration for deployment policy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentPolicyPolicyConfig {
    /// Require authorized target origin and path.
    pub require_authorized_target: bool,
    /// Require protected ref for release path.
    pub require_protected_ref: bool,
    /// Require environment authorization.
    pub require_environment_authorization: bool,
    /// Prohibit implicit routing or domain changes.
    pub prohibit_implicit_routing_changes: bool,
    /// Prohibit unauthorized publication contexts.
    pub prohibit_unauthorized_contexts: bool,
    /// Enforce deterministic denial for unauthorized requests.
    pub enforce_deterministic_denial: bool,
    /// Require rollback on deployment or verification failure.
    pub require_rollback_on_failure: bool,
}

/// Target configuration for deployment destination.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetConfig {
    /// Authorized origin URL.
    pub origin: String,
    /// Authorized subpath.
    pub subpath: String,
    /// Full authorized target URL.
    pub target_url: String,
    /// List of explicitly allowed origins.
    pub allowed_origins: Vec<String>,
    /// List of prohibited origins (e.g. uor.foundation or plain http).
    pub disallowed_origins: Vec<String>,
    /// Whether HTTPS enforcement is required.
    pub enforce_https: bool,
}

/// Publication authorization configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizationConfig {
    /// Authorized environment name (e.g. github-pages).
    pub environment: String,
    /// List of authorized refs.
    pub authorized_refs: Vec<String>,
    /// Patterns of disallowed refs.
    pub disallowed_refs: Vec<String>,
    /// Pinned GitHub repository ruleset ID.
    pub ruleset_id: u64,
    /// Ruleset name.
    pub ruleset_name: String,
    /// Required status checks on the protected ref.
    pub required_status_checks: Vec<String>,
    /// Whether linear history is required.
    pub require_linear_history: bool,
    /// Whether deletion of protected ref is prevented.
    pub prevent_deletion: bool,
    /// Whether non-fast-forward push to protected ref is prevented.
    pub prevent_non_fast_forward: bool,
}

/// Preflight deployment decision contract.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentDecisionConfig {
    /// Preflight checks required before publication.
    pub preflight_checks: Vec<String>,
    /// Action taken upon check failure.
    pub failure_action: String,
}

/// Top-level deployment policy configuration loaded from `model/deployment_policy.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentPolicyConfig {
    /// Spec identifier (`foundry/deployment-policy/1`).
    pub spec: String,
    /// Release stage (`staged-core`).
    pub stage: String,
    /// Policy configuration.
    pub policy: DeploymentPolicyPolicyConfig,
    /// Target destination configuration.
    pub target: TargetConfig,
    /// Authorization and ruleset configuration.
    pub authorization: AuthorizationConfig,
    /// Deployment decision contract.
    pub deployment_decision: DeploymentDecisionConfig,
}

impl DeploymentPolicyConfig {
    /// Validate configuration invariants.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        let bad = |m: String| crate::ModelError::Inconsistent(m);

        if self.spec != "foundry/deployment-policy/1" {
            return Err(bad(format!(
                "deployment_policy spec must be 'foundry/deployment-policy/1', found '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(bad(format!(
                "deployment_policy stage must be 'staged-core', found '{}'",
                self.stage
            )));
        }

        if !self.policy.require_authorized_target {
            return Err(bad(
                "policy.require_authorized_target must be true".to_string()
            ));
        }

        if !self.policy.require_protected_ref {
            return Err(bad("policy.require_protected_ref must be true".to_string()));
        }

        if !self.policy.prohibit_implicit_routing_changes {
            return Err(bad(
                "policy.prohibit_implicit_routing_changes must be true".to_string()
            ));
        }

        if !self.target.enforce_https {
            return Err(bad("target.enforce_https must be true".to_string()));
        }

        if !self.target.origin.starts_with("https://") {
            return Err(bad("target.origin must use HTTPS scheme".to_string()));
        }

        if !self.target.target_url.starts_with(&self.target.origin) {
            return Err(bad(
                "target.target_url must start with target.origin".to_string()
            ));
        }

        if self.authorization.environment.trim().is_empty() {
            return Err(bad(
                "authorization.environment must not be empty".to_string()
            ));
        }

        if self.authorization.authorized_refs.is_empty() {
            return Err(bad(
                "authorization.authorized_refs must not be empty".to_string()
            ));
        }

        if self.authorization.required_status_checks.is_empty() {
            return Err(bad(
                "authorization.required_status_checks must not be empty".to_string(),
            ));
        }

        if self.deployment_decision.preflight_checks.is_empty() {
            return Err(bad(
                "deployment_decision.preflight_checks must not be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// Engine executing deployment policy and publication authorization verification.
pub struct DeploymentPolicyEngine;

impl DeploymentPolicyEngine {
    /// Verify target URL and origin against approved policy.
    pub fn verify_target_authorization(
        config: &DeploymentPolicyConfig,
        target_url: &str,
    ) -> Result<(), DeploymentPolicyError> {
        if !target_url.starts_with("https://") {
            return Err(DeploymentPolicyError::UnauthorizedTarget(format!(
                "insecure target URL '{target_url}': HTTPS is required"
            )));
        }

        for disallowed in &config.target.disallowed_origins {
            if target_url.starts_with(disallowed) {
                return Err(DeploymentPolicyError::UnauthorizedTarget(format!(
                    "target URL '{target_url}' matches disallowed origin '{disallowed}' (implicit routing prohibited)"
                )));
            }
        }

        let origin_allowed = config
            .target
            .allowed_origins
            .iter()
            .any(|allowed| target_url.starts_with(allowed));
        if !origin_allowed {
            return Err(DeploymentPolicyError::UnauthorizedTarget(format!(
                "target URL '{target_url}' origin is not in allowed_origins"
            )));
        }

        if !target_url.starts_with(&config.target.target_url) {
            return Err(DeploymentPolicyError::UnauthorizedTarget(format!(
                "target URL '{target_url}' does not match required subpath '{}'",
                config.target.subpath
            )));
        }

        Ok(())
    }

    /// Verify publication authorization for a git ref and environment context.
    pub fn verify_publication_authorization(
        config: &DeploymentPolicyConfig,
        git_ref: &str,
        environment: &str,
    ) -> Result<(), DeploymentPolicyError> {
        if environment != config.authorization.environment {
            return Err(DeploymentPolicyError::UnauthorizedEnvironment(format!(
                "unauthorized publication environment '{environment}', expected '{}'",
                config.authorization.environment
            )));
        }

        // Check against disallowed ref patterns
        for pattern in &config.authorization.disallowed_refs {
            let prefix = pattern.trim_end_matches('*');
            if git_ref.starts_with(prefix) {
                return Err(DeploymentPolicyError::UnauthorizedRef(format!(
                    "git ref '{git_ref}' matches disallowed pattern '{pattern}'"
                )));
            }
        }

        if !config
            .authorization
            .authorized_refs
            .iter()
            .any(|r| r == git_ref)
        {
            return Err(DeploymentPolicyError::UnauthorizedRef(format!(
                "git ref '{git_ref}' is not in authorized_refs"
            )));
        }

        Ok(())
    }

    /// Verify ruleset prerequisites on the release branch.
    pub fn verify_ruleset_prerequisites(
        config: &DeploymentPolicyConfig,
        ruleset_name: &str,
        active_checks: &[&str],
        prevents_deletion: bool,
        prevents_non_fast_forward: bool,
    ) -> Result<(), DeploymentPolicyError> {
        if ruleset_name != config.authorization.ruleset_name {
            return Err(DeploymentPolicyError::RulesetViolation(format!(
                "ruleset name mismatch: expected '{}', got '{ruleset_name}'",
                config.authorization.ruleset_name
            )));
        }

        if config.authorization.prevent_deletion && !prevents_deletion {
            return Err(DeploymentPolicyError::RulesetViolation(
                "branch ruleset must prevent deletion".to_string(),
            ));
        }

        if config.authorization.prevent_non_fast_forward && !prevents_non_fast_forward {
            return Err(DeploymentPolicyError::RulesetViolation(
                "branch ruleset must prevent non-fast-forward pushes".to_string(),
            ));
        }

        for required in &config.authorization.required_status_checks {
            if !active_checks.contains(&required.as_str()) {
                return Err(DeploymentPolicyError::RulesetViolation(format!(
                    "missing required status check '{required}' in ruleset"
                )));
            }
        }

        Ok(())
    }

    /// Evaluate preflight deployment checks before allowing publication.
    pub fn evaluate_deployment_preflight(
        config: &DeploymentPolicyConfig,
        passed_checks: &[&str],
    ) -> Result<(), DeploymentPolicyError> {
        for required in &config.deployment_decision.preflight_checks {
            if !passed_checks.contains(&required.as_str()) {
                return Err(DeploymentPolicyError::PreflightCheckFailed(format!(
                    "required preflight check '{required}' has not passed; decision is {}",
                    config.deployment_decision.failure_action
                )));
            }
        }

        Ok(())
    }
}
