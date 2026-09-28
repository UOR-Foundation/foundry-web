//! Desired Pages policy and supplied-value comparisons, not deployed observations.
//!
//! Real GitHub, HTTP and TLS observations and SDK-verified artifact identity are
//! required separately; matching caller-provided values cannot accept a deployment.
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
    /// General validation failure.
    Validation(String),
}

impl std::fmt::Display for PagesStateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TargetMismatch(m) => write!(f, "deployment target mismatch: {m}"),
            Self::DeploymentInactive(i) => write!(f, "deployment inactive: {i}"),
            Self::HttpsNotEnforced(h) => write!(f, "https not enforced: {h}"),
            Self::Validation(v) => write!(f, "pages state validation error: {v}"),
        }
    }
}

impl std::error::Error for PagesStateError {}

/// Policy configuration for Pages state.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
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
#[serde(deny_unknown_fields)]
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

/// Desired HTTPS enforcement and TLS parameters, not observations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HttpsEnforcementConfig {
    /// Whether HTTPS enforcement is required.
    pub enforced: bool,
    /// Required observed TLS version.
    pub tls_version: String,
}

/// Artifact verification details for the deployment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ArtifactVerificationConfig {
    /// Expected artifact name.
    pub expected_artifact_name: String,
    /// Expected asset count in the artifact.
    pub expected_asset_count: usize,
}

/// Top-level Pages state model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
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
    /// Validate desired policy. This does not observe or accept a deployment.
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

        if self.deployment_target.origin != "https://uor-foundation.github.io"
            || self.deployment_target.subpath != "/foundry-web/"
            || self.deployment_target.url
                != format!(
                    "{}{}",
                    self.deployment_target.origin, self.deployment_target.subpath
                )
        {
            return Err(crate::ModelError::Inconsistent(
                "deployment target must match the authorized HTTPS origin and subpath".to_string(),
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

        if !self.policy.require_active_deployment
            || !self.policy.require_https_enforcement
            || !self.policy.require_pages_artifact_verification
            || !self.policy.prohibit_unverified_pages_origin
            || !self.policy.prohibit_stale_deployments
        {
            return Err(crate::ModelError::Inconsistent(
                "all Pages policy requirements must remain enabled".to_string(),
            ));
        }

        if !self.https_enforcement.enforced || self.https_enforcement.tls_version != "TLSv1.3" {
            return Err(crate::ModelError::Inconsistent(
                "policy requires enforced HTTPS with TLSv1.3".to_string(),
            ));
        }

        if self.deployment_target.min_deployment_count != 1 {
            return Err(crate::ModelError::Inconsistent(
                "policy requires the latest successful Pages deployment".to_string(),
            ));
        }

        if self.artifact_verification.expected_artifact_name != "github-pages"
            || self.artifact_verification.expected_asset_count != 6
        {
            return Err(crate::ModelError::Inconsistent(format!(
                "expected github-pages artifact must contain 6 assets, got {}",
                self.artifact_verification.expected_asset_count
            )));
        }

        Ok(())
    }
}

/// Policy comparisons for supplied values. Success is not deployment evidence.
pub struct PagesStateEngine;

impl PagesStateEngine {
    /// Compare supplied target values with policy; no GitHub state is queried.
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

    /// Compare supplied HTTPS values with policy; no connection is observed.
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
}

#[cfg(test)]
mod tests {
    use super::PagesStateConfig;

    #[test]
    fn pages_configuration_does_not_claim_observed_evidence_ps_01() {
        let source = std::fs::read_to_string(crate::repo_root().join("model/pages_state.toml"))
            .expect("read Pages policy");
        let value: toml::Value = toml::from_str(&source).expect("parse Pages policy");
        for (section, key) in [
            ("https_enforcement", "hsts_header"),
            ("https_enforcement", "certificate_authority"),
            ("artifact_verification", "expected_tree_digest"),
            ("artifact_verification", "producer_commit"),
        ] {
            assert!(
                value[section].get(key).is_none(),
                "policy must not assert {key}"
            );
            let mut forged = value.clone();
            forged[section]
                .as_table_mut()
                .expect("policy section")
                .insert(
                    key.into(),
                    toml::Value::String("invented-observation".into()),
                );
            let result = toml::from_str::<PagesStateConfig>(
                &toml::to_string(&forged).expect("serialize injected evidence"),
            );
            assert!(result.is_err(), "policy must reject injected {key}");
        }
    }

    #[test]
    fn pages_policy_cannot_disable_required_constraints() {
        let source = std::fs::read_to_string(crate::repo_root().join("model/pages_state.toml"))
            .expect("read Pages policy");
        let value: toml::Value = toml::from_str(&source).expect("parse Pages policy");
        for key in value["policy"].as_table().expect("policy flags").keys() {
            let mut weakened = value.clone();
            weakened["policy"][key] = toml::Value::Boolean(false);
            let config: PagesStateConfig =
                toml::from_str(&toml::to_string(&weakened).expect("serialize weakened policy"))
                    .expect("parse weakened policy");
            assert!(config.check().is_err(), "disabled {key} must fail");
        }
    }

    #[test]
    fn pages_policy_refuses_target_and_transport_substitution() {
        let config = crate::Model::load_from_repo_root()
            .expect("model loads")
            .pages_state;
        for count in [0, 2] {
            let mut weakened = config.clone();
            weakened.deployment_target.min_deployment_count = count;
            assert!(weakened.check().is_err());
        }
        for field in [
            "origin",
            "subpath",
            "url",
            "environment",
            "branch",
            "build_type",
        ] {
            let mut weakened = config.clone();
            let target = &mut weakened.deployment_target;
            let value = match field {
                "origin" => &mut target.origin,
                "subpath" => &mut target.subpath,
                "url" => &mut target.url,
                "environment" => &mut target.environment,
                "branch" => &mut target.branch,
                "build_type" => &mut target.build_type,
                _ => unreachable!(),
            };
            *value = "substituted".into();
            assert!(weakened.check().is_err(), "substituted {field} must fail");
        }
        let mut weakened = config.clone();
        weakened.https_enforcement.enforced = false;
        assert!(weakened.check().is_err());
        let mut weakened = config.clone();
        weakened.https_enforcement.tls_version = "TLSv1.2".into();
        assert!(weakened.check().is_err());
        let mut weakened = config.clone();
        weakened.artifact_verification.expected_asset_count = 0;
        assert!(weakened.check().is_err());
        let mut weakened = config;
        weakened.artifact_verification.expected_artifact_name = "other".into();
        assert!(weakened.check().is_err());
    }
}
