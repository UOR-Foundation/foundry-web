Feature: Independent live acceptance verification
  The live acceptance boundary validates byte-for-byte asset matching for all six
  browser closure assets against deployed target endpoints, executes complete core
  stakeholder journeys for creation, isolation, ownership, recovery, and messaging,
  and exercises negative and rollback controls.

  @LA-01 @build
  Scenario: Validate live deployed bytes, core journeys, and rollback verification
    Given an approved live acceptance specification in model/live_acceptance.toml
    When the live deployed endpoint and TLS handshake are verified
    Then HTTP status 200 OK and Strict-Transport-Security are verified
    And live asset digests match the reproducible six-file producer closure bit-for-bit
    And core stakeholder journeys for creation, isolation, ownership, recovery, and messaging succeed
    And negative checks trigger atomic rollback on byte mismatch or journey failure

  @LA-01 @build
  Scenario: Live byte observation is independently bound to the immutable release
    Given the exact reviewed producer selection and publication target
    When the locked SDK replays its release and observes the deployed bytes
    Then the observation binds the selected release, model, build, tree and target
    And missing, failed, redirected or substituted observations are rejected
    And byte equality alone never establishes application or journey acceptance
