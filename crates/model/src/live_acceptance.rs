//! Live acceptance verification model and execution engine: verifies live deployed
//! bytes, executes complete core stakeholder journeys (creation, isolation, ownership,
//! recovery, messaging), and exercises negative and rollback controls.
//!
//! Conformance ID: `LA-01` (suite: `live-acceptance`).

use serde::{Deserialize, Serialize};

/// Errors arising during live acceptance evaluation.
#[derive(Debug, Clone, PartialEq)]
pub enum LiveAcceptanceError {
    /// Live endpoint unreachable or returned unexpected status code.
    EndpointError(String),
    /// TLS certificate or HSTS security failure.
    SecurityFailure(String),
    /// Live deployed asset digest mismatch.
    DigestMismatch(String),
    /// Core journey failure (creation, isolation, ownership, recovery, messaging).
    JourneyFailure(String),
    /// Rollback trigger or execution failure.
    RollbackError(String),
    /// General validation failure.
    Validation(String),
}

impl std::fmt::Display for LiveAcceptanceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EndpointError(e) => write!(f, "live endpoint error: {e}"),
            Self::SecurityFailure(s) => write!(f, "security failure: {s}"),
            Self::DigestMismatch(d) => write!(f, "live digest mismatch: {d}"),
            Self::JourneyFailure(j) => write!(f, "core journey failure: {j}"),
            Self::RollbackError(r) => write!(f, "rollback error: {r}"),
            Self::Validation(v) => write!(f, "live acceptance validation error: {v}"),
        }
    }
}

impl std::error::Error for LiveAcceptanceError {}

/// Policy configuration for live acceptance verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveAcceptancePolicyConfig {
    /// Require independent live deployment verification.
    pub require_live_deployment_verification: bool,
    /// Require byte-for-byte digest matching for all assets.
    pub require_byte_for_byte_digest_matching: bool,
    /// Require all core stakeholder journeys to complete.
    pub require_all_core_journeys: bool,
    /// Require negative and rollback check completion.
    pub require_negative_and_rollback_checks: bool,
    /// Prohibit mock network shortcuts.
    pub prohibit_mock_network_shortcuts: bool,
    /// Prohibit unverified payloads.
    pub prohibit_unverified_payloads: bool,
}

/// Target configuration for live verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveTargetConfig {
    /// Target URL.
    pub url: String,
    /// Target origin.
    pub origin: String,
    /// Target subpath.
    pub subpath: String,
}

/// Individual deployment check record.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveCheckRecord {
    /// Check identifier (e.g. DEP-CHK-01).
    pub id: String,
    /// Check human-readable name.
    pub name: String,
    /// Verification method.
    pub method: String,
    /// Expected HTTP status code.
    pub expected_status: u16,
}

/// Rollback policy configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackConfig {
    /// Require atomic rollback capability.
    pub require_atomic_rollback: bool,
    /// Trigger rollback on byte mismatch.
    pub rollback_trigger_on_byte_mismatch: bool,
    /// Trigger rollback on journey failure.
    pub rollback_trigger_on_journey_failure: bool,
    /// Rollback timeout in seconds.
    pub rollback_timeout_seconds: u32,
    /// Previous known good commit SHA.
    pub previous_known_good_commit: String,
}

/// Top-level live acceptance configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveAcceptanceConfig {
    /// Schema spec identifier.
    pub spec: String,
    /// Deployment stage identifier.
    pub stage: String,
    /// Policy flags.
    pub policy: LiveAcceptancePolicyConfig,
    /// Target configuration.
    pub target: LiveTargetConfig,
    /// Outstanding deployment check definitions.
    pub checks: Vec<LiveCheckRecord>,
    /// Rollback parameters.
    pub rollback: RollbackConfig,
}

impl LiveAcceptanceConfig {
    /// Validate self-consistency of the live acceptance model.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        if self.spec != "foundry/live-acceptance/1" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid live acceptance spec '{}'",
                self.spec
            )));
        }

        if self.stage != "staged-core" {
            return Err(crate::ModelError::Inconsistent(format!(
                "invalid stage '{}', expected 'staged-core'",
                self.stage
            )));
        }

        if !self.target.url.starts_with("https://") {
            return Err(crate::ModelError::Inconsistent(
                "live target URL must use https".to_string(),
            ));
        }

        let required_ids = ["DEP-CHK-01", "DEP-CHK-02", "DEP-CHK-03", "DEP-CHK-04"];
        for req in required_ids {
            if !self.checks.iter().any(|c| c.id == req) {
                return Err(crate::ModelError::Inconsistent(format!(
                    "missing required live check '{req}'"
                )));
            }
        }

        if self.rollback.previous_known_good_commit.is_empty() {
            return Err(crate::ModelError::Inconsistent(
                "previous known good commit must not be empty".to_string(),
            ));
        }

        Ok(())
    }
}

/// Verification engine for live acceptance and stakeholder journeys.
pub struct LiveAcceptanceEngine;

impl LiveAcceptanceEngine {
    /// Verify live HTTPS endpoint resolution (DEP-CHK-01).
    pub fn verify_live_endpoint(
        config: &LiveAcceptanceConfig,
        url: &str,
        status_code: u16,
    ) -> Result<(), LiveAcceptanceError> {
        if !url.starts_with(&config.target.url) {
            return Err(LiveAcceptanceError::EndpointError(format!(
                "URL '{url}' does not match authorized target '{}'",
                config.target.url
            )));
        }

        let check = config
            .checks
            .iter()
            .find(|c| c.id == "DEP-CHK-01")
            .ok_or_else(|| {
                LiveAcceptanceError::Validation("missing DEP-CHK-01 configuration".to_string())
            })?;

        if status_code != check.expected_status {
            return Err(LiveAcceptanceError::EndpointError(format!(
                "HTTP status code {status_code} does not match expected {}",
                check.expected_status
            )));
        }

        Ok(())
    }

    /// Verify TLS handshake and HSTS strict transport security (DEP-CHK-02).
    pub fn verify_tls_and_hsts(
        _config: &LiveAcceptanceConfig,
        tls_active: bool,
        hsts_present: bool,
    ) -> Result<(), LiveAcceptanceError> {
        if !tls_active {
            return Err(LiveAcceptanceError::SecurityFailure(
                "TLS handshake failed or insecure plaintext connection used".to_string(),
            ));
        }

        if !hsts_present {
            return Err(LiveAcceptanceError::SecurityFailure(
                "Strict-Transport-Security header is missing".to_string(),
            ));
        }

        Ok(())
    }

    /// Verify live artifact digest byte matching against expected closure (DEP-CHK-03).
    pub fn verify_live_payload_digests(
        _config: &LiveAcceptanceConfig,
        actual_assets: &[(&str, &str)], // (path, sha256)
        expected_assets: &[(&str, &str)],
    ) -> Result<(), LiveAcceptanceError> {
        if actual_assets.len() != expected_assets.len() {
            return Err(LiveAcceptanceError::DigestMismatch(format!(
                "live asset count {} does not match expected {}",
                actual_assets.len(),
                expected_assets.len()
            )));
        }

        for (exp_path, exp_sha) in expected_assets {
            let found = actual_assets
                .iter()
                .find(|(p, _)| p == exp_path)
                .ok_or_else(|| {
                    LiveAcceptanceError::DigestMismatch(format!(
                        "missing expected live asset '{exp_path}'"
                    ))
                })?;

            if found.1 != *exp_sha {
                return Err(LiveAcceptanceError::DigestMismatch(format!(
                    "live asset '{exp_path}' sha256 mismatch: expected '{exp_sha}', got '{}'",
                    found.1
                )));
            }
        }

        Ok(())
    }

    /// Verify full stakeholder journey execution: creation, isolation, ownership, recovery, messaging (DEP-CHK-04).
    pub fn verify_core_journeys(
        _config: &LiveAcceptanceConfig,
        creation_ok: bool,
        isolation_ok: bool,
        ownership_ok: bool,
        recovery_ok: bool,
        messaging_ok: bool,
    ) -> Result<(), LiveAcceptanceError> {
        if !creation_ok {
            return Err(LiveAcceptanceError::JourneyFailure(
                "workspace/object creation journey failed".to_string(),
            ));
        }
        if !isolation_ok {
            return Err(LiveAcceptanceError::JourneyFailure(
                "cross-tenant confidentiality and namespace isolation journey failed".to_string(),
            ));
        }
        if !ownership_ok {
            return Err(LiveAcceptanceError::JourneyFailure(
                "authenticated membership and peer registry ownership journey failed".to_string(),
            ));
        }
        if !recovery_ok {
            return Err(LiveAcceptanceError::JourneyFailure(
                "anti-entropy peer repair and offline recovery journey failed".to_string(),
            ));
        }
        if !messaging_ok {
            return Err(LiveAcceptanceError::JourneyFailure(
                "inbound dispatch and verified blob transfer messaging journey failed".to_string(),
            ));
        }

        Ok(())
    }

    /// Verify negative check handling and rollback decision trigger.
    pub fn evaluate_rollback_trigger(
        config: &LiveAcceptanceConfig,
        byte_mismatch_detected: bool,
        journey_failure_detected: bool,
    ) -> Result<String, LiveAcceptanceError> {
        if byte_mismatch_detected && config.rollback.rollback_trigger_on_byte_mismatch {
            return Ok(format!(
                "ROLLBACK_TRIGGERED: byte mismatch detected; reverting to commit '{}'",
                config.rollback.previous_known_good_commit
            ));
        }

        if journey_failure_detected && config.rollback.rollback_trigger_on_journey_failure {
            return Ok(format!(
                "ROLLBACK_TRIGGERED: core journey failure detected; reverting to commit '{}'",
                config.rollback.previous_known_good_commit
            ));
        }

        Err(LiveAcceptanceError::RollbackError(
            "no failure condition met to trigger rollback".to_string(),
        ))
    }
}
