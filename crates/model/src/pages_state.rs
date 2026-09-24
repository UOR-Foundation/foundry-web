//! Pages state model and verification engine: verifies accepted GitHub Pages
//! deployments, Actions artifacts, and HTTPS enforcement.
//!
//! Conformance ID: `PS-01` (suite: `pages-state`).

use serde::{Deserialize, Serialize};

/// Errors arising during Pages state verification.
#[derive(Debug, Clone, PartialEq)]
pub enum PagesStateError {
    /// Deployment target mismatch.
    TargetMismatch(String),
    /// Inactive deployment or insufficient deployment count.
    DeploymentInactive(String),
    /// HTTPS not enforced or TLS configuration invalid.
    HttpsNotEnforced(String),
    /// Artifact count or tree digest mismatch.
    ArtifactMismatch(String),
    /// General validation failure.
    Validation(String),
}

impl std::fmt::Display for PagesStateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TargetMismatch(m) => write!(f, "deployment target mismatch: {m}"),
            Self::DeploymentInactive(i) => write!(f, "deployment inactive: {i}"),
            Self::HttpsNotEnforced(h) => write!(f, "https not enforced: {h}"),
            Self::ArtifactMismatch(a) => write!(f, "artifact mismatch: {a}"),
            Self::Validation(v) => write!(f, "pages state validation error: {v}"),
        }
    }
}

impl std::error::Error for PagesStateError {}

/// Policy configuration for Pages state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagesStatePolicyConfig {
    /// Require an active deployment on GitHub Pages.
    pub require_active_deployment: bool,
    /// Require HTTPS enforcement on target.
    pub require_https_enforcement: bool,
    /// Require verification of uploaded Pages artifacts.
    pub require_pages_artifact_verification: bool,
    /// Prohibit unverified Pages origins.
    pub prohibit_unverified_pages_origin: bool,
    /// Prohibit stale deployments.
    pub prohibit_stale_deployments: bool,
}

/// Deployment target configuration for GitHub Pages.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentTargetConfig {
    /// Expected origin URL.
    pub origin: String,
    /// Expected subpath.
    pub subpath: String,
    /// Complete target deployment URL.
    pub url: String,
    /// Target environment name.
    pub environment: String,
    /// Target branch name.
    pub branch: String,
    /// Pages build type (workflow).
    pub build_type: String,
    /// Minimum deployment count.
    pub min_deployment_count: u32,
}

/// HTTPS enforcement and TLS parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpsEnforcementConfig {
    /// Whether HTTPS enforcement is active.
    pub enforced: bool,
    /// Expected minimum TLS version.
    pub tls_version: String,
    /// Expected HSTS header policy.
    pub hsts_header: String,
    /// Certificate authority or provisioning source.
    pub certificate_authority: String,
}

/// Artifact verification details for the deployment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactVerificationConfig {
    /// Expected artifact name.
    pub expected_artifact_name: String,
    /// Expected asset count in the artifact.
    pub expected_asset_count: usize,
    /// Expected reproducible tree digest.
    pub expected_tree_digest: String,
    /// Producer release commit hash.
    pub producer_commit: String,
}

/// Top-level Pages state model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PagesStateConfig {
    /// Schema spec identifier.
    pub spec: String,
    /// Deployment stage identifier.
    pub stage: String,
    /// Policy flags.
    pub policy: PagesStatePolicyConfig,
    /// Target deployment details.
    pub deployment_target: DeploymentTargetConfig,
    /// HTTPS enforcement configuration.
    pub https_enforcement: HttpsEnforcementConfig,
    /// Pages artifact verification.
    pub artifact_verification: ArtifactVerificationConfig,
}

impl PagesStateConfig {
    /// Validate self-consistency of the Pages state model.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        if self.spec != "foundry/pages-state/1" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid pages state spec '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid stage '{}', expected 'staged-core'",
                self.stage
            )));
        }

        if !self.deployment_target.url.starts_with("https://") {
            return Err(crate::ModelError::Inconsistent(
                "deployment target URL must use https".to_string(),
            ));
        }

        if self.deployment_target.environment != "github-pages" {
            return Err(crate::ModelError::Inconsistent(
                "deployment target environment must be 'github-pages'".to_string(),
            ));
        }

        if self.deployment_target.branch != "main" {
            return Err(crate::ModelError::Inconsistent(
                "deployment target branch must be 'main'".to_string(),
            ));
        }

        if self.deployment_target.build_type != "workflow" {
            return Err(crate::ModelError::Inconsistent(
                "deployment build_type must be 'workflow'".to_string(),
            ));
        }

        if !self.https_enforcement.enforced && self.policy.require_https_enforcement {
            return Err(crate::ModelError::Inconsistent(
                "policy requires https_enforcement to be enabled".to_string(),
            ));
        }

        if self.artifact_verification.expected_asset_count != 6 {
            return Err(crate::ModelError::Inconsistent(format!(
                "expected asset count must be 6, got {}",
                self.artifact_verification.expected_asset_count
            )));
        }

        if !self
            .artifact_verification
            .expected_tree_digest
            .starts_with("sha256:")
        {
            return Err(crate::ModelError::Inconsistent(
                "expected tree digest must be sha256 prefixed".to_string(),
            ));
        }

        Ok(())
    }
}

/// Verification engine for Pages deployment state.
pub struct PagesStateEngine;

impl PagesStateEngine {
    /// Verify deployment target and actual Pages configuration.
    pub fn verify_deployment_target(
        config: &PagesStateConfig,
        actual_url: &str,
        actual_environment: &str,
        actual_branch: &str,
        actual_build_type: &str,
        deployment_count: u32,
    ) -> Result<(), PagesStateError> {
        if actual_url != config.deployment_target.url {
            return Err(PagesStateError::TargetMismatch(format!(
                "actual URL '{actual_url}' does not match expected '{}'",
                config.deployment_target.url
            )));
        }

        if actual_environment != config.deployment_target.environment {
            return Err(PagesStateError::TargetMismatch(format!(
                "actual environment '{actual_environment}' does not match expected '{}'",
                config.deployment_target.environment
            )));
        }

        if actual_branch != config.deployment_target.branch {
            return Err(PagesStateError::TargetMismatch(format!(
                "actual branch '{actual_branch}' does not match expected '{}'",
                config.deployment_target.branch
            )));
        }

        if actual_build_type != config.deployment_target.build_type {
            return Err(PagesStateError::TargetMismatch(format!(
                "actual build type '{actual_build_type}' does not match expected '{}'",
                config.deployment_target.build_type
            )));
        }

        if config.policy.require_active_deployment
            && deployment_count < config.deployment_target.min_deployment_count
        {
            return Err(PagesStateError::DeploymentInactive(format!(
                "deployment count {} is less than required minimum {}",
                deployment_count, config.deployment_target.min_deployment_count
            )));
        }

        Ok(())
    }

    /// Verify HTTPS enforcement state and TLS parameters.
    pub fn verify_https_enforcement(
        config: &PagesStateConfig,
        is_https_enforced: bool,
        tls_version: &str,
    ) -> Result<(), PagesStateError> {
        if config.policy.require_https_enforcement && !is_https_enforced {
            return Err(PagesStateError::HttpsNotEnforced(
                "HTTPS enforcement is required by policy but disabled in target configuration"
                    .to_string(),
            ));
        }

        if tls_version != config.https_enforcement.tls_version {
            return Err(PagesStateError::HttpsNotEnforced(format!(
                "TLS version '{tls_version}' does not match expected '{}'",
                config.https_enforcement.tls_version
            )));
        }

        Ok(())
    }

    /// Verify deployment artifact name, asset count, tree digest, and producer commit.
    pub fn verify_artifact_state(
        config: &PagesStateConfig,
        artifact_name: &str,
        asset_count: usize,
        tree_digest: &str,
        producer_commit: &str,
    ) -> Result<(), PagesStateError> {
        if artifact_name != config.artifact_verification.expected_artifact_name {
            return Err(PagesStateError::ArtifactMismatch(format!(
                "artifact name '{artifact_name}' does not match expected '{}'",
                config.artifact_verification.expected_artifact_name
            )));
        }

        if asset_count != config.artifact_verification.expected_asset_count {
            return Err(PagesStateError::ArtifactMismatch(format!(
                "asset count {} does not match expected {}",
                asset_count, config.artifact_verification.expected_asset_count
            )));
        }

        if tree_digest != config.artifact_verification.expected_tree_digest {
            return Err(PagesStateError::ArtifactMismatch(format!(
                "tree digest '{tree_digest}' does not match expected '{}'",
                config.artifact_verification.expected_tree_digest
            )));
        }

        if producer_commit != config.artifact_verification.producer_commit {
            return Err(PagesStateError::ArtifactMismatch(format!(
                "producer commit '{producer_commit}' does not match expected '{}'",
                config.artifact_verification.producer_commit
            )));
        }

        Ok(())
    }
}
