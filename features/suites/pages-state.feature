Feature: Pages state and HTTPS enforcement
  The GitHub Pages state and deployment boundary establishes non-zero accepted deployments,
  verified Actions deployment artifacts, HTTPS target enforcement, and immutable binding
  to exact publisher revision and producer release identity.

  @PS-01 @build
  Scenario: Validate Pages state, deployment artifacts, and HTTPS enforcement
    Given an approved pages state specification in model/pages_state.toml
    When the GitHub Pages deployment target and configuration are evaluated
    Then the target URL is https://uor-foundation.github.io/foundry-web/ in environment github-pages
    And the deployment count is non-zero with verified six-file artifact tree closure
    And HTTPS enforcement and TLS parameters match approved policy
    And arbitrary or stale deployment origins are rejected
