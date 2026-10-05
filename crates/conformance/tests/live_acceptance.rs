//! Conformance tests for Independent Live Acceptance, Byte Verification,
//! Core Journeys, and Rollback Handling (LA-01).

use repo_model::{LiveAcceptanceEngine, LiveAcceptanceError, Model};

/// LA-01: The independent live acceptance boundary validates byte-for-byte asset
/// matching for all six browser closure assets against deployed target endpoints,
/// executes complete core stakeholder journeys for creation, isolation, ownership,
/// recovery, and messaging, and proves full negative and rollback fault handling
/// against accepted release identities.
#[test]
fn live_acceptance_verifies_deployed_bytes_and_core_journeys_la_01() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    model
        .check()
        .expect("model checks and validates live acceptance");

    let cfg = &model.live_acceptance;
    assert_eq!(cfg.spec, "foundry/live-acceptance/1");
    assert_eq!(cfg.stage, "staged-core");
    assert!(cfg.policy.require_live_deployment_verification);
    assert!(cfg.policy.require_byte_for_byte_digest_matching);
    assert!(cfg.policy.require_all_core_journeys);
    assert!(cfg.policy.require_negative_and_rollback_checks);
    assert_eq!(
        cfg.rollback.previous_known_good_commit,
        "83f27747d3ed434dd88b84ea3972e5798e693ddf"
    );

    // 1. DEP-CHK-01: Live HTTPS DNS and Origin Resolution
    LiveAcceptanceEngine::verify_live_endpoint(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        200,
    )
    .expect("DEP-CHK-01 passes: HTTP 200 OK on authorized target");

    // 2. DEP-CHK-02: Live TLS Certificate and Strict Transport Security
    LiveAcceptanceEngine::verify_tls_and_hsts(cfg, true, true)
        .expect("DEP-CHK-02 passes: TLS active and HSTS header verified");

    // 3. DEP-CHK-03: Live Artifact Digest Byte Matching
    let expected_assets = [
        (
            "app.css",
            "sha256:93a8e4a6a873f55f56a7adb3a55a49912bdcddd740b1af52f9a27f1403ea0279",
        ),
        (
            "app.js",
            "sha256:2a5749531966b54fc67e41bcd781d375a42349c392145e85882fb97d3b12c8f8",
        ),
        (
            "index.html",
            "sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca",
        ),
        (
            "prism_foundry_web.js",
            "sha256:934556d47c4e35be39a73ea5c3e5a0d6159fc8455a4867bedfea595ee7d10ac4",
        ),
        (
            "prism_foundry_web_bg.wasm",
            "sha256:33f7ca6c8ff1bbf9832984210cc6b3b8965a823d2505e4a959bb21e18989dac7",
        ),
        (
            "provenance.json",
            "sha256:3ca65ccdd7f985a5efb4a5571507785cc2ccb2aef90777b3944d4b19a3ffa144",
        ),
    ];
    LiveAcceptanceEngine::verify_live_payload_digests(cfg, &expected_assets, &expected_assets)
        .expect("DEP-CHK-03 passes: all 6 assets match reproducible release bytes");

    // 4. DEP-CHK-04: Live Stakeholder Journey Walkthrough
    LiveAcceptanceEngine::verify_core_journeys(cfg, true, true, true, true, true).expect(
        "DEP-CHK-04 passes: creation, isolation, ownership, recovery, messaging journeys pass",
    );
}

#[test]
fn status_code_mismatch_fails_endpoint_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::verify_live_endpoint(
        cfg,
        "https://uor-foundation.github.io/foundry-web/",
        404,
    );
    assert!(matches!(res, Err(LiveAcceptanceError::EndpointError(_))));
}

#[test]
fn target_mismatch_fails_endpoint_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::verify_live_endpoint(
        cfg,
        "https://unauthorized.domain.org/foundry-web/",
        200,
    );
    assert!(matches!(res, Err(LiveAcceptanceError::EndpointError(_))));
}

#[test]
fn missing_tls_fails_security_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::verify_tls_and_hsts(cfg, false, true);
    assert!(matches!(res, Err(LiveAcceptanceError::SecurityFailure(_))));
}

#[test]
fn missing_hsts_fails_security_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::verify_tls_and_hsts(cfg, true, false);
    assert!(matches!(res, Err(LiveAcceptanceError::SecurityFailure(_))));
}

#[test]
fn live_byte_mismatch_fails_payload_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let expected = [(
        "index.html",
        "sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca",
    )];
    let corrupted = [(
        "index.html",
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    )];

    let res = LiveAcceptanceEngine::verify_live_payload_digests(cfg, &corrupted, &expected);
    assert!(matches!(res, Err(LiveAcceptanceError::DigestMismatch(_))));
}

#[test]
fn missing_live_asset_fails_payload_check() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let expected = [
        (
            "index.html",
            "sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca",
        ),
        (
            "app.js",
            "sha256:2a5749531966b54fc67e41bcd781d375a42349c392145e85882fb97d3b12c8f8",
        ),
    ];
    let incomplete = [(
        "index.html",
        "sha256:a001ac1fb183b2158ec773c8436f409e80cfe4b788cf7deb16f48d7309d11dca",
    )];

    let res = LiveAcceptanceEngine::verify_live_payload_digests(cfg, &incomplete, &expected);
    assert!(matches!(res, Err(LiveAcceptanceError::DigestMismatch(_))));
}

#[test]
fn journey_failure_fails_verification() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    // Messaging failed
    let res = LiveAcceptanceEngine::verify_core_journeys(cfg, true, true, true, true, false);
    assert!(matches!(res, Err(LiveAcceptanceError::JourneyFailure(_))));
}

#[test]
fn rollback_triggers_on_byte_mismatch() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, true, false, false, false);
    assert!(res.is_ok());
    let report = res.unwrap();
    assert!(report.contains("ROLLBACK_TRIGGERED"));
    assert!(report.contains("byte mismatch detected"));
    assert!(report.contains(&cfg.rollback.previous_known_good_commit));
    assert_eq!(
        report.rollback_commit,
        "83f27747d3ed434dd88b84ea3972e5798e693ddf"
    );
    assert!(report
        .active_triggers
        .contains(&repo_model::RollbackTriggerType::ByteMismatch));
    assert!(report.client_storage_preserved);

    let path = std::path::Path::new(&report.report_path);
    assert!(
        path.exists(),
        "incident report JSON must exist at {}",
        path.display()
    );
    let content = std::fs::read_to_string(path).expect("read incident report JSON");
    assert!(content.contains("foundry/incident-report/1"));
    assert!(content.contains(&cfg.rollback.previous_known_good_commit));
}

#[test]
fn rollback_triggers_on_journey_failure() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, false, true, false, false);
    assert!(res.is_ok());
    let report = res.unwrap();
    assert!(report.contains("ROLLBACK_TRIGGERED"));
    assert!(report.contains("core journey failure detected"));
    assert!(report.contains(&cfg.rollback.previous_known_good_commit));
    assert_eq!(
        report.rollback_commit,
        "83f27747d3ed434dd88b84ea3972e5798e693ddf"
    );
    assert!(report
        .active_triggers
        .contains(&repo_model::RollbackTriggerType::JourneyFailure));
    assert!(std::path::Path::new(&report.report_path).exists());
}

#[test]
fn rollback_triggers_on_security_violation() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, false, false, true, false);
    assert!(res.is_ok());
    let report = res.unwrap();
    assert!(report.contains("ROLLBACK_TRIGGERED"));
    assert!(report.contains("security/transport violation detected"));
    assert!(report.contains(&cfg.rollback.previous_known_good_commit));
    assert_eq!(
        report.rollback_commit,
        "83f27747d3ed434dd88b84ea3972e5798e693ddf"
    );
    assert!(report
        .active_triggers
        .contains(&repo_model::RollbackTriggerType::SecurityViolation));
    assert!(std::path::Path::new(&report.report_path).exists());
}

#[test]
fn rollback_triggers_on_accessibility_regression() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, false, false, false, true);
    assert!(res.is_ok());
    let report = res.unwrap();
    assert!(report.contains("ROLLBACK_TRIGGERED"));
    assert!(report.contains("accessibility regression detected"));
    assert!(report.contains(&cfg.rollback.previous_known_good_commit));
    assert_eq!(
        report.rollback_commit,
        "83f27747d3ed434dd88b84ea3972e5798e693ddf"
    );
    assert!(report
        .active_triggers
        .contains(&repo_model::RollbackTriggerType::AccessibilityRegression));
    assert!(std::path::Path::new(&report.report_path).exists());
}

#[test]
fn rollback_triggers_on_composite_failures() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, true, false, true, true);
    assert!(res.is_ok());
    let report = res.unwrap();
    assert_eq!(report.active_triggers.len(), 3);
    assert!(report.contains("byte mismatch detected"));
    assert!(report.contains("security/transport violation detected"));
    assert!(report.contains("accessibility regression detected"));
}

#[test]
fn rollback_rejects_when_no_failure_condition() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");
    let cfg = &model.live_acceptance;

    let res = LiveAcceptanceEngine::evaluate_rollback_trigger(cfg, false, false, false, false);
    assert!(matches!(res, Err(LiveAcceptanceError::RollbackError(_))));
    if let Err(LiveAcceptanceError::RollbackError(err)) = res {
        assert_eq!(err, "no failure condition met to trigger rollback");
    }
}

#[test]
fn rollback_rejects_abbreviated_or_malformed_commit_sha() {
    let root = repo_model::repo_root();
    let model = Model::load(&root.join("model")).expect("model loads");

    let malformed_shas = [
        "",                                          // empty
        "83f27747d3ed",                              // abbreviated 12-char
        "83f27747d3ed434dd88b84ea3972e5798e693dd",   // 39 chars (under length)
        "83f27747d3ed434dd88b84ea3972e5798e693ddfa", // 41 chars (over length)
        "83F27747D3ED434DD88B84EA3972E5798E693DDF",  // uppercase hex
        "83f27747d3ed434dd88b84ea3972e5798e693zzzz", // non-hex characters
        "83f27747d3ed434dd88b84ea3972e5798e693dd ",  // trailing whitespace
        " 83f27747d3ed434dd88b84ea3972e5798e693ddf", // leading whitespace
    ];

    for invalid_sha in malformed_shas {
        let mut cfg = model.live_acceptance.clone();
        cfg.rollback.previous_known_good_commit = invalid_sha.to_string();
        let res = cfg.check();
        assert!(
            res.is_err(),
            "expected LiveAcceptanceConfig::check() to fail for malformed commit SHA '{invalid_sha}'"
        );
    }
}
/// LA-01 infrastructure regression owner, not application acceptance.
#[test]
fn actual_live_integrity_orchestration_rejects_substituted_observations_la_01() {
    let status = std::process::Command::new("node")
        .args(["--test", "tests/publication/live-integrity.test.mjs"])
        .current_dir(repo_model::repo_root())
        .status()
        .expect("the locked SDK supplies Node for live observation checks");
    assert!(
        status.success(),
        "live integrity orchestration regressions failed"
    );
}
