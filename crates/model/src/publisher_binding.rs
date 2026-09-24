//! Publisher binding and scope integrity model: binds exact authorized producer release
//! identity, verifies bit-for-bit reproducible artifact tree closure, validates pre-publication
//! evidence, and enforces scope integrity against premature platform acceptance.
//!
//! Conformance ID: `PB-01` (suite: `publisher-binding`).

use serde::{Deserialize, Serialize};

/// Errors arising during publisher binding verification.
#[derive(Debug, Clone, PartialEq)]
pub enum PublisherBindingError {
    /// Producer release identity mismatch.
    IdentityMismatch(String),
    /// Artifact tree or individual asset digest mismatch.
    DigestMismatch(String),
    /// Distribution asset count or path set mismatch.
    ArtifactCountMismatch(String),
    /// Pre-publication evidence or signature failure.
    EvidenceInvalid(String),
    /// Scope integrity violation or premature platform acceptance.
    ScopeIntegrityViolation(String),
    /// General validation error.
    Validation(String),
}

impl std::fmt::Display for PublisherBindingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::IdentityMismatch(m) => write!(f, "producer identity mismatch: {m}"),
            Self::DigestMismatch(m) => write!(f, "digest mismatch: {m}"),
            Self::ArtifactCountMismatch(m) => write!(f, "artifact count mismatch: {m}"),
            Self::EvidenceInvalid(e) => write!(f, "pre-publication evidence invalid: {e}"),
            Self::ScopeIntegrityViolation(s) => write!(f, "scope integrity violation: {s}"),
            Self::Validation(v) => write!(f, "publisher binding validation error: {v}"),
        }
    }
}

impl std::error::Error for PublisherBindingError {}

/// Policy configuration for publisher binding and scope integrity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherBindingPolicyConfig {
    /// Require exact producer binding.
    pub require_exact_producer_binding: bool,
    /// Require full artifact tree closure.
    pub require_full_artifact_tree_closure: bool,
    /// Require pre-publication evidence verification.
    pub require_pre_publication_evidence_verification: bool,
    /// Prohibit premature claims of complete platform acceptance.
    pub prohibit_premature_platform_acceptance: bool,
    /// Prohibit draft or preview substitutes.
    pub prohibit_draft_preview_substitutes: bool,
    /// Prohibit unverified payloads.
    pub prohibit_unverified_payloads: bool,
}

/// Producer identity record specifying exact producer provenance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProducerIdentityRecord {
    /// Authorized producer name.
    pub name: String,
    /// Producer release version.
    pub version: String,
    /// Release stage (e.g. staged-core).
    pub stage: String,
    /// Repository URL.
    pub repository: String,
    /// Pinned commit hash.
    pub commit: String,
    /// Host architecture.
    pub architecture: String,
    /// Rust compiler version.
    pub compiler: String,
    /// Pinned SDK image with digest.
    pub locked_sdk_image: String,
}

/// Artifact tree record capturing reproducible build hashes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactTreeRecord {
    /// Combined Merkle/tree digest across distribution assets.
    pub tree_digest: String,
    /// First build run tree digest.
    pub run_1_tree_digest: String,
    /// Second build run tree digest.
    pub run_2_tree_digest: String,
    /// Equality status between runs (must be BIT_FOR_BIT_IDENTICAL).
    pub reproducible_equality: String,
}

/// Browser distribution artifact record.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BrowserArtifactRecord {
    /// Asset path relative to distribution root.
    pub path: String,
    /// MIME content type.
    pub mime_type: String,
    /// Asset size in bytes.
    pub size_bytes: u64,
    /// SHA-256 digest with prefix `sha256:`.
    pub sha256: String,
}

/// Pre-publication evidence record signed by producer pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrePublicationEvidenceRecord {
    /// Producer release state (e.g. PRODUCER_READY).
    pub release_state: String,
    /// Pre-publication binding digest.
    pub binding_digest: String,
    /// Identifier of signing authority.
    pub signing_authority: String,
    /// Cryptographic signature.
    pub signature: String,
}

/// Scope integrity record enforcing dependency boundary on complete producer platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScopeIntegrityRecord {
    /// Bound producer release stage.
    pub producer_stage: String,
    /// Flag whether complete platform acceptance is claimed. Must be false for core publication.
    pub platform_acceptance_claimed: bool,
    /// Scope of the publisher operation.
    pub publisher_scope: String,
    /// Target live deployment URL.
    pub target_deployment_url: String,
    /// Outstanding live deployment checks to be verified against live Pages.
    pub required_live_checks: Vec<String>,
}

/// Top-level publisher binding configuration loaded from `model/publisher_binding.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublisherBindingConfig {
    /// Spec identifier (`foundry/publisher-binding/1`).
    pub spec: String,
    /// Release stage (`staged-core`).
    pub stage: String,
    /// Policy configuration.
    pub policy: PublisherBindingPolicyConfig,
    /// Exact producer release identity.
    pub producer_identity: ProducerIdentityRecord,
    /// Artifact tree and reproducible build record.
    pub artifact_tree: ArtifactTreeRecord,
    /// Full set of browser distribution assets.
    pub artifacts: Vec<BrowserArtifactRecord>,
    /// Pre-publication evidence record.
    pub pre_publication_evidence: PrePublicationEvidenceRecord,
    /// Scope integrity record.
    pub scope_integrity: ScopeIntegrityRecord,
}

impl PublisherBindingConfig {
    /// Validate configuration invariants.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        let bad = |m: String| crate::ModelError::Inconsistent(m);

        if self.spec != "foundry/publisher-binding/1" {
            return Err(bad(format!(
                "publisher_binding spec must be 'foundry/publisher-binding/1', found '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(bad(format!(
                "publisher_binding stage must be 'staged-core', found '{}'",
                self.stage
            )));
        }

        if !self.policy.require_exact_producer_binding {
            return Err(bad(
                "policy.require_exact_producer_binding must be true".to_string()
            ));
        }

        if !self.policy.require_full_artifact_tree_closure {
            return Err(bad(
                "policy.require_full_artifact_tree_closure must be true".to_string(),
            ));
        }

        if !self.policy.require_pre_publication_evidence_verification {
            return Err(bad(
                "policy.require_pre_publication_evidence_verification must be true".to_string(),
            ));
        }

        if !self.policy.prohibit_premature_platform_acceptance {
            return Err(bad(
                "policy.prohibit_premature_platform_acceptance must be true".to_string(),
            ));
        }

        if !self.policy.prohibit_draft_preview_substitutes {
            return Err(bad(
                "policy.prohibit_draft_preview_substitutes must be true".to_string(),
            ));
        }

        if !self.policy.prohibit_unverified_payloads {
            return Err(bad(
                "policy.prohibit_unverified_payloads must be true".to_string()
            ));
        }

        // Validate producer identity
        if self.producer_identity.name != "uor-foundry-producer" {
            return Err(bad(format!(
                "producer_identity.name must be 'uor-foundry-producer', found '{}'",
                self.producer_identity.name
            )));
        }

        if self.producer_identity.commit.len() != 40 {
            return Err(bad(
                "producer_identity.commit must be a 40-character hex commit hash".to_string(),
            ));
        }

        // Validate reproducible equality
        if self.artifact_tree.reproducible_equality != "BIT_FOR_BIT_IDENTICAL" {
            return Err(bad(
                "artifact_tree.reproducible_equality must be BIT_FOR_BIT_IDENTICAL".to_string(),
            ));
        }

        if self.artifact_tree.run_1_tree_digest != self.artifact_tree.run_2_tree_digest {
            return Err(bad(
                "artifact_tree run_1 and run_2 digests must match for bit-for-bit reproducibility"
                    .to_string(),
            ));
        }

        if self.artifact_tree.tree_digest != self.artifact_tree.run_1_tree_digest {
            return Err(bad(
                "artifact_tree tree_digest must equal reproducible run digests".to_string(),
            ));
        }

        // Validate artifacts non-empty and well-formed
        if self.artifacts.is_empty() {
            return Err(bad(
                "publisher_binding artifacts list must not be empty".to_string()
            ));
        }

        for asset in &self.artifacts {
            if !asset.sha256.starts_with("sha256:") {
                return Err(bad(format!(
                    "artifact '{}' sha256 must start with sha256:",
                    asset.path
                )));
            }
            if asset.size_bytes == 0 {
                return Err(bad(format!(
                    "artifact '{}' size_bytes must be positive",
                    asset.path
                )));
            }
        }

        // Validate pre-publication evidence
        if self.pre_publication_evidence.release_state != "PRODUCER_READY" {
            return Err(bad(
                "pre_publication_evidence.release_state must be PRODUCER_READY".to_string(),
            ));
        }

        if !self
            .pre_publication_evidence
            .binding_digest
            .starts_with("sha256:")
        {
            return Err(bad(
                "pre_publication_evidence.binding_digest must start with sha256:".to_string(),
            ));
        }

        if !self
            .pre_publication_evidence
            .signature
            .starts_with("ed25519:")
        {
            return Err(bad(
                "pre_publication_evidence.signature must start with ed25519:".to_string(),
            ));
        }

        // Validate scope integrity
        if self.scope_integrity.platform_acceptance_claimed {
            return Err(bad(
                "scope_integrity.platform_acceptance_claimed must be false: core publication cannot claim complete platform acceptance prematurely (Issue #13)"
                    .to_string(),
            ));
        }

        if self.scope_integrity.required_live_checks.len() < 4 {
            return Err(bad(
                "scope_integrity.required_live_checks must contain all 4 deployment checks"
                    .to_string(),
            ));
        }

        Ok(())
    }
}

/// Engine executing publisher binding and scope integrity verification.
pub struct PublisherBindingEngine;

impl PublisherBindingEngine {
    /// Verify exact producer release identity against expected commit and SDK.
    pub fn verify_producer_identity(
        config: &PublisherBindingConfig,
        expected_commit: &str,
        expected_sdk_image: &str,
    ) -> Result<(), PublisherBindingError> {
        if config.producer_identity.commit != expected_commit {
            return Err(PublisherBindingError::IdentityMismatch(format!(
                "producer commit mismatch: expected '{expected_commit}', got '{}'",
                config.producer_identity.commit
            )));
        }

        if config.producer_identity.locked_sdk_image != expected_sdk_image {
            return Err(PublisherBindingError::IdentityMismatch(format!(
                "producer SDK image mismatch: expected '{expected_sdk_image}', got '{}'",
                config.producer_identity.locked_sdk_image
            )));
        }

        Ok(())
    }

    /// Verify full artifact tree closure and asset parity.
    pub fn verify_artifact_tree(
        config: &PublisherBindingConfig,
        expected_tree_digest: &str,
        expected_artifacts: &[BrowserArtifactRecord],
    ) -> Result<(), PublisherBindingError> {
        if config.artifact_tree.tree_digest != expected_tree_digest {
            return Err(PublisherBindingError::DigestMismatch(format!(
                "artifact tree digest mismatch: expected '{expected_tree_digest}', got '{}'",
                config.artifact_tree.tree_digest
            )));
        }

        if config.artifacts.len() != expected_artifacts.len() {
            return Err(PublisherBindingError::ArtifactCountMismatch(format!(
                "artifact count mismatch: expected {}, got {}",
                expected_artifacts.len(),
                config.artifacts.len()
            )));
        }

        for expected in expected_artifacts {
            let found = config
                .artifacts
                .iter()
                .find(|a| a.path == expected.path)
                .ok_or_else(|| {
                    PublisherBindingError::ArtifactCountMismatch(format!(
                        "missing expected artifact '{}'",
                        expected.path
                    ))
                })?;

            if found.sha256 != expected.sha256 {
                return Err(PublisherBindingError::DigestMismatch(format!(
                    "artifact '{}' sha256 mismatch: expected '{}', got '{}'",
                    expected.path, expected.sha256, found.sha256
                )));
            }

            if found.size_bytes != expected.size_bytes {
                return Err(PublisherBindingError::DigestMismatch(format!(
                    "artifact '{}' size mismatch: expected {}, got {}",
                    expected.path, expected.size_bytes, found.size_bytes
                )));
            }

            if found.mime_type != expected.mime_type {
                return Err(PublisherBindingError::Validation(format!(
                    "artifact '{}' mime_type mismatch: expected '{}', got '{}'",
                    expected.path, expected.mime_type, found.mime_type
                )));
            }
        }

        Ok(())
    }

    /// Verify signed pre-publication evidence.
    pub fn verify_pre_publication_evidence(
        config: &PublisherBindingConfig,
        expected_binding_digest: &str,
        expected_authority: &str,
    ) -> Result<(), PublisherBindingError> {
        if config.pre_publication_evidence.release_state != "PRODUCER_READY" {
            return Err(PublisherBindingError::EvidenceInvalid(format!(
                "unexpected release state '{}', must be 'PRODUCER_READY'",
                config.pre_publication_evidence.release_state
            )));
        }

        if config.pre_publication_evidence.binding_digest != expected_binding_digest {
            return Err(PublisherBindingError::EvidenceInvalid(format!(
                "pre-publication binding digest mismatch: expected '{expected_binding_digest}', got '{}'",
                config.pre_publication_evidence.binding_digest
            )));
        }

        if config.pre_publication_evidence.signing_authority != expected_authority {
            return Err(PublisherBindingError::EvidenceInvalid(format!(
                "signing authority mismatch: expected '{expected_authority}', got '{}'",
                config.pre_publication_evidence.signing_authority
            )));
        }

        if config.pre_publication_evidence.signature.trim().is_empty() {
            return Err(PublisherBindingError::EvidenceInvalid(
                "missing pre-publication signature".to_string(),
            ));
        }

        Ok(())
    }

    /// Verify scope integrity: ensures publication does not claim complete platform acceptance.
    pub fn verify_scope_integrity(
        config: &PublisherBindingConfig,
    ) -> Result<(), PublisherBindingError> {
        if config.scope_integrity.platform_acceptance_claimed {
            return Err(PublisherBindingError::ScopeIntegrityViolation(
                "complete platform acceptance claimed prematurely in publisher configuration (Issue #13)"
                    .to_string(),
            ));
        }

        if config.scope_integrity.producer_stage != "staged-core" {
            return Err(PublisherBindingError::ScopeIntegrityViolation(format!(
                "unexpected producer stage '{}', expected 'staged-core'",
                config.scope_integrity.producer_stage
            )));
        }

        let required_checks = ["DEP-CHK-01", "DEP-CHK-02", "DEP-CHK-03", "DEP-CHK-04"];
        for chk in required_checks {
            if !config
                .scope_integrity
                .required_live_checks
                .iter()
                .any(|c| c == chk)
            {
                return Err(PublisherBindingError::ScopeIntegrityViolation(format!(
                    "missing required live deployment check '{chk}'"
                )));
            }
        }

        Ok(())
    }
}
