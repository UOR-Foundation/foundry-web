//! Publication pipeline model: defines source-free export-browser interfaces,
//! unchanged six-file browser closure verification, Actions publication workflow
//! contracts, and prohibition of compilation or arbitrary OCI extraction shortcuts.
//!
//! Conformance ID: `PP-01` (suite: `publication-pipeline`).

use serde::{Deserialize, Serialize};

/// Errors arising during publication pipeline operations.
#[derive(Debug, Clone, PartialEq)]
pub enum PublicationPipelineError {
    /// Workflow file definition violates security or pinning requirements.
    WorkflowDefinitionViolation(String),
    /// Exported browser asset digest mismatch.
    AssetDigestMismatch(String),
    /// Exported browser asset count or path mismatch.
    AssetCountMismatch(String),
    /// Artifact tree digest mismatch across exported assets.
    TreeDigestMismatch(String),
    /// Prohibited compiler or build shortcut detected in publication path.
    ProhibitedCompilation(String),
    /// General validation error.
    Validation(String),
}

impl std::fmt::Display for PublicationPipelineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::WorkflowDefinitionViolation(w) => write!(f, "workflow definition violation: {w}"),
            Self::AssetDigestMismatch(d) => write!(f, "asset digest mismatch: {d}"),
            Self::AssetCountMismatch(c) => write!(f, "asset count mismatch: {c}"),
            Self::TreeDigestMismatch(t) => write!(f, "tree digest mismatch: {t}"),
            Self::ProhibitedCompilation(p) => write!(f, "prohibited compilation: {p}"),
            Self::Validation(v) => write!(f, "publication pipeline validation error: {v}"),
        }
    }
}

impl std::error::Error for PublicationPipelineError {}

/// Policy configuration for publication pipeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicationPipelinePolicyConfig {
    /// Require source-free export from approved SDK path.
    pub require_source_free_export: bool,
    /// Require publication of unchanged verified assets only.
    pub require_unchanged_asset_publication: bool,
    /// Require pre-upload byte verification.
    pub require_pre_upload_byte_verification: bool,
    /// Prohibit arbitrary OCI extraction shortcuts.
    pub prohibit_arbitrary_oci_extraction: bool,
    /// Prohibit producer build-workflow reuse shortcuts.
    pub prohibit_producer_build_workflow_reuse: bool,
    /// Prohibit compilation in the publication pipeline.
    pub prohibit_compilation_in_pipeline: bool,
}

/// Pipeline workflow configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineWorkflowConfig {
    /// Path to GitHub Actions publication workflow.
    pub workflow_path: String,
    /// Authorized environment name.
    pub environment: String,
    /// Target release branch.
    pub target_branch: String,
    /// Export output directory name.
    pub export_directory: String,
    /// Number of assets in the browser profile.
    pub artifact_count: usize,
    /// Expected tree digest over the six-file profile.
    pub expected_tree_digest: String,
}

/// Pipeline asset record describing an expected browser distribution artifact.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PipelineAssetRecord {
    /// Asset path relative to export directory.
    pub path: String,
    /// MIME content type.
    pub mime_type: String,
    /// Asset size in bytes.
    pub size_bytes: u64,
    /// SHA-256 content digest with `sha256:` prefix.
    pub sha256: String,
}

/// Top-level publication pipeline configuration loaded from `model/publication_pipeline.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicationPipelineConfig {
    /// Spec identifier (`foundry/publication-pipeline/1`).
    pub spec: String,
    /// Release stage (`staged-core`).
    pub stage: String,
    /// Policy configuration.
    pub policy: PublicationPipelinePolicyConfig,
    /// Pipeline workflow configuration.
    pub pipeline: PipelineWorkflowConfig,
    /// List of expected assets.
    pub expected_assets: Vec<PipelineAssetRecord>,
}

impl PublicationPipelineConfig {
    /// Validate configuration invariants.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        let bad = |m: String| crate::ModelError::Inconsistent(m);

        if self.spec != "foundry/publication-pipeline/1" {
            return Err(bad(format!(
                "publication_pipeline spec must be 'foundry/publication-pipeline/1', found '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(bad(format!(
                "publication_pipeline stage must be 'staged-core', found '{}'",
                self.stage
            )));
        }

        if !self.policy.require_source_free_export {
            return Err(bad(
                "policy.require_source_free_export must be true".to_string()
            ));
        }

        if !self.policy.require_unchanged_asset_publication {
            return Err(bad(
                "policy.require_unchanged_asset_publication must be true".to_string(),
            ));
        }

        if !self.policy.require_pre_upload_byte_verification {
            return Err(bad(
                "policy.require_pre_upload_byte_verification must be true".to_string(),
            ));
        }

        if !self.policy.prohibit_compilation_in_pipeline {
            return Err(bad(
                "policy.prohibit_compilation_in_pipeline must be true".to_string()
            ));
        }

        if self.expected_assets.len() != self.pipeline.artifact_count {
            return Err(bad(format!(
                "expected_assets length ({}) must match pipeline.artifact_count ({})",
                self.expected_assets.len(),
                self.pipeline.artifact_count
            )));
        }

        for asset in &self.expected_assets {
            if !asset.sha256.starts_with("sha256:") {
                return Err(bad(format!(
                    "asset '{}' sha256 must start with sha256:",
                    asset.path
                )));
            }
            if asset.size_bytes == 0 {
                return Err(bad(format!(
                    "asset '{}' size_bytes must be positive",
                    asset.path
                )));
            }
        }

        Ok(())
    }
}

/// Engine executing publication pipeline verification.
pub struct PublicationPipelineEngine;

impl PublicationPipelineEngine {
    /// Verify workflow content against pipeline requirements.
    pub fn verify_workflow_definition(
        config: &PublicationPipelineConfig,
        workflow_content: &str,
    ) -> Result<(), PublicationPipelineError> {
        // Must contain environment
        if !workflow_content.contains(&format!("name: {}", config.pipeline.environment))
            && !workflow_content.contains(&format!("environment: {}", config.pipeline.environment))
        {
            return Err(PublicationPipelineError::WorkflowDefinitionViolation(
                format!(
                    "workflow does not specify authorized environment '{}'",
                    config.pipeline.environment
                ),
            ));
        }

        // Must run on main branch
        if !workflow_content.contains(&format!("branches: [{}]", config.pipeline.target_branch))
            && !workflow_content.contains(&format!("- {}", config.pipeline.target_branch))
        {
            return Err(PublicationPipelineError::WorkflowDefinitionViolation(
                format!(
                    "workflow does not specify target branch '{}'",
                    config.pipeline.target_branch
                ),
            ));
        }

        // Must prohibit compilation commands
        let prohibited_commands = [
            "cargo build",
            "cargo run",
            "rustc ",
            "wasm-pack build",
            "npm run build",
        ];
        for cmd in prohibited_commands {
            if workflow_content.contains(cmd) {
                return Err(PublicationPipelineError::ProhibitedCompilation(format!(
                    "workflow contains prohibited compilation command '{cmd}': source-free export required"
                )));
            }
        }

        // Must contain checkout with fetch-depth 0 and persist-credentials false
        if !workflow_content.contains("fetch-depth: 0")
            || !workflow_content.contains("persist-credentials: false")
        {
            return Err(PublicationPipelineError::WorkflowDefinitionViolation(
                "workflow checkout must specify fetch-depth: 0 and persist-credentials: false"
                    .to_string(),
            ));
        }

        // Must contain pages upload and deploy steps
        if !workflow_content.contains("actions/upload-pages-artifact@")
            || !workflow_content.contains("actions/deploy-pages@")
        {
            return Err(PublicationPipelineError::WorkflowDefinitionViolation(
                "workflow must use pinned upload-pages-artifact and deploy-pages actions"
                    .to_string(),
            ));
        }

        Ok(())
    }

    /// Verify exported browser asset closure against expected records and tree digest.
    pub fn verify_exported_closure(
        config: &PublicationPipelineConfig,
        assets: &[PipelineAssetRecord],
        actual_tree_digest: &str,
    ) -> Result<(), PublicationPipelineError> {
        if actual_tree_digest != config.pipeline.expected_tree_digest {
            return Err(PublicationPipelineError::TreeDigestMismatch(format!(
                "tree digest '{}' does not match expected '{}'",
                actual_tree_digest, config.pipeline.expected_tree_digest
            )));
        }

        if assets.len() != config.expected_assets.len() {
            return Err(PublicationPipelineError::AssetCountMismatch(format!(
                "exported asset count mismatch: expected {}, got {}",
                config.expected_assets.len(),
                assets.len()
            )));
        }

        for expected in &config.expected_assets {
            let found = assets
                .iter()
                .find(|a| a.path == expected.path)
                .ok_or_else(|| {
                    PublicationPipelineError::AssetCountMismatch(format!(
                        "missing expected asset '{}'",
                        expected.path
                    ))
                })?;

            if found.sha256 != expected.sha256 {
                return Err(PublicationPipelineError::AssetDigestMismatch(format!(
                    "asset '{}' sha256 mismatch: expected '{}', got '{}'",
                    expected.path, expected.sha256, found.sha256
                )));
            }

            if found.size_bytes != expected.size_bytes {
                return Err(PublicationPipelineError::AssetDigestMismatch(format!(
                    "asset '{}' size mismatch: expected {}, got {}",
                    expected.path, expected.size_bytes, found.size_bytes
                )));
            }

            if found.mime_type != expected.mime_type {
                return Err(PublicationPipelineError::Validation(format!(
                    "asset '{}' mime_type mismatch: expected '{}', got '{}'",
                    expected.path, expected.mime_type, found.mime_type
                )));
            }
        }

        Ok(())
    }

    /// Verify that export operation was source-free without build tool invocation.
    pub fn verify_source_free_export(
        _config: &PublicationPipelineConfig,
        export_script: &str,
    ) -> Result<(), PublicationPipelineError> {
        if export_script.contains("cargo build")
            || export_script.contains("cargo check")
            || export_script.contains("rustc")
        {
            return Err(PublicationPipelineError::ProhibitedCompilation(
                "export script invoked Rust compiler instead of source-free export".to_string(),
            ));
        }

        Ok(())
    }
}
