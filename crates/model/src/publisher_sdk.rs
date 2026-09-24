//! Publisher SDK and template binding model: verifies immutable multi-architecture
//! OCI SDK artifacts, export-browser interface support, and template lock parity.
//!
//! Conformance ID: `PW-01` (suite: `publisher-sdk`).

use serde::{Deserialize, Serialize};

/// Errors arising during publisher SDK verification.
#[derive(Debug, Clone, PartialEq)]
pub enum PublisherSdkError {
    /// Specified architecture manifest digest mismatch.
    ArchitectureMismatch(String),
    /// Index or lock digest mismatch.
    DigestMismatch(String),
    /// Export-browser interface is unavailable or rejected.
    ExportBrowserUnavailable(String),
    /// General validation error.
    Validation(String),
}

impl std::fmt::Display for PublisherSdkError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ArchitectureMismatch(m) => write!(f, "architecture mismatch: {m}"),
            Self::DigestMismatch(m) => write!(f, "digest mismatch: {m}"),
            Self::ExportBrowserUnavailable(m) => write!(f, "export-browser unavailable: {m}"),
            Self::Validation(v) => write!(f, "publisher sdk validation error: {v}"),
        }
    }
}

impl std::error::Error for PublisherSdkError {}

/// Policy configuration for publisher SDK binding.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherSdkPolicyConfig {
    /// Require immutable OCI SDK binding.
    pub require_immutable_sdk_binding: bool,
    /// Prohibit source integration as a substitute for production acceptance.
    pub prohibit_source_integration: bool,
    /// Prohibit scaffold-only checks as production acceptance.
    pub prohibit_scaffold_only_acceptance: bool,
    /// Require dual architecture verification (linux/amd64 and linux/arm64).
    pub require_multi_architecture_verification: bool,
    /// Require reviewed export-browser interface support.
    pub require_export_browser_interface: bool,
}

/// SDK binding record with multi-architecture OCI manifests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SdkBindingRecord {
    /// Image repository name.
    pub image_repository: String,
    /// OCI index digest.
    pub index_digest: String,
    /// linux/amd64 manifest digest.
    pub amd64_manifest_digest: String,
    /// linux/arm64 manifest digest.
    pub arm64_manifest_digest: String,
    /// Reviewed Action commit reference.
    pub action_ref: String,
    /// Whether export-browser is supported.
    pub supports_export_browser: bool,
}

/// Template binding record with contract specification and lock digests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateBindingRecord {
    /// Pinned template commit hash.
    pub template_commit: String,
    /// Template contract specification version.
    pub template_contract_spec: String,
    /// Pinned Cargo.lock digest.
    pub cargo_lock_digest: String,
}

/// Top-level publisher SDK configuration loaded from `model/publisher_sdk.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherSdkConfig {
    /// Spec identifier (`foundry/publisher-sdk/1`).
    pub spec: String,
    /// Release stage (`staged-core`).
    pub stage: String,
    /// Policy configuration.
    pub policy: PublisherSdkPolicyConfig,
    /// SDK binding record.
    pub sdk_binding: SdkBindingRecord,
    /// Template binding record.
    pub template_binding: TemplateBindingRecord,
}

impl PublisherSdkConfig {
    /// Validate configuration invariants.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        let bad = |m: String| crate::ModelError::Inconsistent(m);

        if self.spec != "foundry/publisher-sdk/1" {
            return Err(bad(format!(
                "publisher_sdk spec must be 'foundry/publisher-sdk/1', found '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(bad(format!(
                "publisher_sdk stage must be 'staged-core', found '{}'",
                self.stage
            )));
        }

        if !self.policy.require_immutable_sdk_binding {
            return Err(bad(
                "policy.require_immutable_sdk_binding must be true".to_string()
            ));
        }

        if !self.policy.prohibit_source_integration {
            return Err(bad(
                "policy.prohibit_source_integration must be true".to_string()
            ));
        }

        if !self.policy.require_export_browser_interface {
            return Err(bad(
                "policy.require_export_browser_interface must be true".to_string()
            ));
        }

        if !self.sdk_binding.supports_export_browser {
            return Err(bad(
                "sdk_binding.supports_export_browser must be true to resolve PP7101".to_string(),
            ));
        }

        if !self.sdk_binding.index_digest.starts_with("sha256:") {
            return Err(bad(
                "sdk_binding.index_digest must start with sha256:".to_string()
            ));
        }

        if !self
            .sdk_binding
            .amd64_manifest_digest
            .starts_with("sha256:")
        {
            return Err(bad(
                "sdk_binding.amd64_manifest_digest must start with sha256:".to_string(),
            ));
        }

        if !self
            .sdk_binding
            .arm64_manifest_digest
            .starts_with("sha256:")
        {
            return Err(bad(
                "sdk_binding.arm64_manifest_digest must start with sha256:".to_string(),
            ));
        }

        Ok(())
    }
}

/// Engine executing publisher SDK and template verification.
pub struct PublisherSdkEngine;

impl PublisherSdkEngine {
    /// Verify platform manifest digest parity against expected architecture.
    pub fn verify_sdk_platform_parity(
        config: &PublisherSdkConfig,
        platform: &str,
        expected_digest: &str,
    ) -> Result<(), PublisherSdkError> {
        let actual_digest = match platform {
            "linux/amd64" => &config.sdk_binding.amd64_manifest_digest,
            "linux/arm64" => &config.sdk_binding.arm64_manifest_digest,
            other => {
                return Err(PublisherSdkError::ArchitectureMismatch(format!(
                    "unsupported platform '{other}', expected linux/amd64 or linux/arm64"
                )))
            }
        };

        if actual_digest != expected_digest {
            return Err(PublisherSdkError::DigestMismatch(format!(
                "manifest digest mismatch for platform '{platform}': expected '{expected_digest}', got '{actual_digest}'"
            )));
        }

        Ok(())
    }

    /// Verify that export-browser interface is supported and configured.
    pub fn verify_export_browser_support(
        config: &PublisherSdkConfig,
    ) -> Result<(), PublisherSdkError> {
        if !config.sdk_binding.supports_export_browser {
            return Err(PublisherSdkError::ExportBrowserUnavailable(
                "export-browser interface is not enabled in locked SDK binding (PP7101)"
                    .to_string(),
            ));
        }

        if config.sdk_binding.action_ref.trim().is_empty() {
            return Err(PublisherSdkError::ExportBrowserUnavailable(
                "action_ref is empty, reviewed Action pin required".to_string(),
            ));
        }

        Ok(())
    }

    /// Verify offline dependency closure matches expected Cargo.lock digest.
    pub fn verify_offline_closure(
        config: &PublisherSdkConfig,
        actual_lock_digest: &str,
    ) -> Result<(), PublisherSdkError> {
        if config.template_binding.cargo_lock_digest != actual_lock_digest {
            return Err(PublisherSdkError::DigestMismatch(format!(
                "Cargo.lock digest mismatch: expected '{}', got '{actual_lock_digest}'",
                config.template_binding.cargo_lock_digest
            )));
        }

        Ok(())
    }
}
