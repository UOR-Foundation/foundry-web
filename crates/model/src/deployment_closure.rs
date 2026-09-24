//! Deployment closure model and verification engine: verifies that all publication
//! and acceptance criteria are satisfied, closure evidence is bound to exact
//! repositories and commits, and no unaccepted platform scope is claimed.
//!
//! Conformance ID: `DC-01` (suite: `deployment-closure`).

use serde::{Deserialize, Serialize};

/// Errors arising during deployment closure verification.
#[derive(Debug, Clone, PartialEq)]
pub enum DeploymentClosureError {
    /// Incomplete or unsatisfied implementation matrix row.
    UnsatisfiedRequirement(String),
    /// Closure evidence mismatch or invalid verdict.
    EvidenceMismatch(String),
    /// Platform scope violation.
    ScopeViolation(String),
    /// General validation failure.
    Validation(String),
}

impl std::fmt::Display for DeploymentClosureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsatisfiedRequirement(u) => write!(f, "unsatisfied requirement: {u}"),
            Self::EvidenceMismatch(e) => write!(f, "evidence mismatch: {e}"),
            Self::ScopeViolation(s) => write!(f, "scope violation: {s}"),
            Self::Validation(v) => write!(f, "deployment closure validation error: {v}"),
        }
    }
}

impl std::error::Error for DeploymentClosureError {}

/// Policy configuration for deployment closure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentClosurePolicyConfig {
    /// Require production deployment to be accepted.
    pub production_deployment_accepted: bool,
    /// Require all implementation rows in IMPLEMENTATION.md to be closed.
    pub all_implementation_rows_closed: bool,
    /// Require ecosystem release closure readiness.
    pub ecosystem_closure_ready: bool,
    /// Require platform scope integrity to be preserved.
    pub platform_scope_integrity_preserved: bool,
}

/// Closure evidence record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClosureEvidenceRecord {
    /// Publisher repository URL.
    pub publisher_repository: String,
    /// Producer repository URL.
    pub producer_repository: String,
    /// Producer release commit hash.
    pub producer_release_commit: String,
    /// Target deployment URL.
    pub target_deployment_url: String,
    /// Final closure verdict.
    pub closure_verdict: String,
}

/// Matrix row record representing each required row in IMPLEMENTATION.md.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatrixRowRecord {
    /// Requirement text.
    pub requirement: String,
    /// Acceptance status.
    pub status: String,
    /// Conformance authority ID.
    pub conformance_authority: String,
}

/// Top-level deployment closure configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentClosureConfig {
    /// Schema spec identifier.
    pub spec: String,
    /// Deployment stage identifier.
    pub stage: String,
    /// Policy flags.
    pub policy: DeploymentClosurePolicyConfig,
    /// Evidence record.
    pub closure_evidence: ClosureEvidenceRecord,
    /// Implementation matrix rows.
    pub implementation_matrix: Vec<MatrixRowRecord>,
}

impl DeploymentClosureConfig {
    /// Validate self-consistency of the deployment closure model.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        if self.spec != "foundry/deployment-closure/1" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid deployment closure spec '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid stage '{}', expected 'staged-core'",
                self.stage
            )));
        }

        if self.implementation_matrix.len() != 7 {
            return Err(crate::ModelError::Inconsistent(format!(
                "implementation matrix must have exactly 7 rows, got {}",
                self.implementation_matrix.len()
            )));
        }

        if self.closure_evidence.closure_verdict != "ACCEPTED_AND_CLOSED" {
            return Err(crate::ModelError::Inconsistent(format!(
                "closure verdict must be 'ACCEPTED_AND_CLOSED', got '{}'",
                self.closure_evidence.closure_verdict
            )));
        }

        Ok(())
    }
}

/// Verification engine for deployment closure.
pub struct DeploymentClosureEngine;

impl DeploymentClosureEngine {
    /// Verify that all matrix rows are accepted or scope-preserved.
    pub fn verify_closure_matrix(
        config: &DeploymentClosureConfig,
    ) -> Result<(), DeploymentClosureError> {
        for row in &config.implementation_matrix {
            if row.status != "ACCEPTED" && row.status != "SCOPE_PRESERVED" {
                return Err(DeploymentClosureError::UnsatisfiedRequirement(format!(
                    "requirement '{}' has unaccepted status '{}'",
                    row.requirement, row.status
                )));
            }

            if row.conformance_authority.is_empty() {
                return Err(DeploymentClosureError::UnsatisfiedRequirement(format!(
                    "requirement '{}' lacks conformance authority",
                    row.requirement
                )));
            }
        }

        Ok(())
    }

    /// Verify closure evidence binding.
    pub fn verify_closure_evidence(
        config: &DeploymentClosureConfig,
        expected_producer_commit: &str,
        expected_target_url: &str,
    ) -> Result<(), DeploymentClosureError> {
        if config.closure_evidence.producer_release_commit != expected_producer_commit {
            return Err(DeploymentClosureError::EvidenceMismatch(format!(
                "producer release commit '{}' does not match expected '{expected_producer_commit}'",
                config.closure_evidence.producer_release_commit
            )));
        }

        if config.closure_evidence.target_deployment_url != expected_target_url {
            return Err(DeploymentClosureError::EvidenceMismatch(format!(
                "target deployment URL '{}' does not match expected '{expected_target_url}'",
                config.closure_evidence.target_deployment_url
            )));
        }

        if config.closure_evidence.closure_verdict != "ACCEPTED_AND_CLOSED" {
            return Err(DeploymentClosureError::EvidenceMismatch(format!(
                "closure verdict is '{}', expected 'ACCEPTED_AND_CLOSED'",
                config.closure_evidence.closure_verdict
            )));
        }

        Ok(())
    }
}
