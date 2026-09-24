Feature: Deployment policy and publication authorization
  The deployment policy authorizes the exact origin and subpath for GitHub Pages,
  verifies branch protection and ruleset prerequisites on the release ref,
  evaluates preflight deployment decisions, and enforces deterministic denial
  against unauthorized contexts or implicit routing changes.

  @DP-01 @build
  Scenario: Validate authorized deployment target, ruleset prerequisites, and deterministic denial
    Given an approved deployment policy in model/deployment_policy.toml
    When target URL authorization is verified for https://uor-foundation.github.io/foundry-web/
    Then disallowed origins and plain http schemes are strictly rejected
    And publication authorization requires the github-pages environment and protected ref refs/heads/main
    And branch protection ruleset prerequisites enforce status checks and non-fast-forward protections
    And preflight deployment decisions require all prerequisite gates before publication
