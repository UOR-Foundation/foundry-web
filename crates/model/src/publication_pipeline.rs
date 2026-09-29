//! Source-free publication policy, not artifact or deployment evidence.
//!
//! The locked SDK verifies the selected release and its browser closure. This
//! module cannot create a second artifact authority from configuration values.
//! Conformance ID: `PP-01` (suite: `publication-pipeline`).

use serde::{Deserialize, Serialize};

/// Required source-free publication constraints.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicationPipelinePolicyConfig {
    /// Require source-free export from the approved SDK interface.
    pub require_source_free_export: bool,
    /// Publish unchanged verified assets only.
    pub require_unchanged_asset_publication: bool,
    /// Verify exported bytes before upload.
    pub require_pre_upload_byte_verification: bool,
    /// Forbid arbitrary OCI extraction shortcuts.
    pub prohibit_arbitrary_oci_extraction: bool,
    /// Forbid reusing the producer's build workflow.
    pub prohibit_producer_build_workflow_reuse: bool,
    /// Forbid application compilation in the publisher.
    pub prohibit_compilation_in_pipeline: bool,
}

/// Authorized workflow structure, without claimed artifact measurements.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PipelineWorkflowConfig {
    /// Publication workflow path.
    pub workflow_path: String,
    /// Authorized environment.
    pub environment: String,
    /// Authorized release branch.
    pub target_branch: String,
    /// Source-free export destination.
    pub export_directory: String,
    /// Number of assets required by the SDK browser profile.
    pub artifact_count: usize,
}

/// Publication policy loaded from `model/publication_pipeline.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PublicationPipelineConfig {
    /// Policy schema identifier.
    pub spec: String,
    /// Required release stage.
    pub stage: String,
    /// Mandatory publication constraints.
    pub policy: PublicationPipelinePolicyConfig,
    /// Authorized workflow structure.
    pub pipeline: PipelineWorkflowConfig,
}

impl PublicationPipelineConfig {
    /// Check desired policy consistency. This does not inspect or accept a release.
    pub fn check(&self) -> Result<(), crate::ModelError> {
        let bad = |message: &str| crate::ModelError::Inconsistent(message.into());
        if self.spec != "foundry/publication-pipeline/1" || self.stage != "staged-core" {
            return Err(bad("invalid publication policy schema or stage"));
        }
        if !self.policy.require_source_free_export
            || !self.policy.require_unchanged_asset_publication
            || !self.policy.require_pre_upload_byte_verification
            || !self.policy.prohibit_arbitrary_oci_extraction
            || !self.policy.prohibit_producer_build_workflow_reuse
            || !self.policy.prohibit_compilation_in_pipeline
        {
            return Err(bad(
                "all source-free publication constraints must remain enabled",
            ));
        }
        if self.pipeline.workflow_path != ".github/workflows/pages.yml"
            || self.pipeline.environment != "github-pages"
            || self.pipeline.target_branch != "main"
            || self.pipeline.export_directory != "site"
            || self.pipeline.artifact_count != 6
        {
            return Err(bad(
                "publication workflow must match the authorized source-free target",
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::PublicationPipelineConfig;

    fn policy() -> toml::Value {
        let source =
            std::fs::read_to_string(crate::repo_root().join("model/publication_pipeline.toml"))
                .expect("read publication policy");
        toml::from_str(&source).expect("parse publication policy")
    }

    #[test]
    fn pipeline_configuration_does_not_claim_artifact_evidence_pp_01() {
        let value = policy();
        assert!(
            value.get("expected_assets").is_none(),
            "fixture assets are not release authority"
        );
        assert!(
            value["pipeline"].get("expected_tree_digest").is_none(),
            "fixture tree is not release authority"
        );
        for at_root in [false, true] {
            let mut forged = value.clone();
            if at_root {
                forged
                    .as_table_mut()
                    .expect("policy table")
                    .insert("expected_assets".into(), toml::Value::Array(vec![]));
            } else {
                forged["pipeline"]
                    .as_table_mut()
                    .expect("pipeline table")
                    .insert(
                        "expected_tree_digest".into(),
                        toml::Value::String("invented-tree".into()),
                    );
            }
            let result = toml::from_str::<PublicationPipelineConfig>(
                &toml::to_string(&forged).expect("serialize injected evidence"),
            );
            assert!(
                result.is_err(),
                "policy must reject injected artifact authority"
            );
        }
    }

    #[test]
    fn publication_policy_cannot_disable_required_constraints() {
        let value = policy();
        for key in value["policy"].as_table().expect("policy flags").keys() {
            let mut weakened = value.clone();
            weakened["policy"][key] = toml::Value::Boolean(false);
            let config: PublicationPipelineConfig =
                toml::from_str(&toml::to_string(&weakened).expect("serialize weakened policy"))
                    .expect("parse weakened policy");
            assert!(config.check().is_err(), "disabled {key} must fail");
        }
    }

    #[test]
    fn publication_policy_refuses_workflow_substitution() {
        let config = crate::Model::load_from_repo_root()
            .expect("model loads")
            .publication_pipeline;
        for field in [
            "workflow_path",
            "environment",
            "target_branch",
            "export_directory",
        ] {
            let mut weakened = config.clone();
            let pipeline = &mut weakened.pipeline;
            let value = match field {
                "workflow_path" => &mut pipeline.workflow_path,
                "environment" => &mut pipeline.environment,
                "target_branch" => &mut pipeline.target_branch,
                "export_directory" => &mut pipeline.export_directory,
                _ => unreachable!(),
            };
            *value = "substituted".into();
            assert!(weakened.check().is_err(), "substituted {field} must fail");
        }
        let mut weakened = config;
        weakened.pipeline.artifact_count = 0;
        assert!(weakened.check().is_err());
    }
}
