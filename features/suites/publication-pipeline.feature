Feature: Publication pipeline and Actions publication
  The publication pipeline exports the verified six-file browser artifact closure
  source-free, enforces pre-upload byte verification against the locked producer
  release, and publishes unchanged verified assets to GitHub Pages under protected
  ref and environment controls without compiler invocation.

  @PP-01 @build
  Scenario: Validate source-free export-browser and Actions publication pipeline
    Given an approved publication pipeline specification in model/publication_pipeline.toml
    When the pages publication workflow definition is verified for .github/workflows/pages.yml
    Then the workflow specifies the github-pages environment and target branch main
    And compiler invocation and arbitrary OCI extraction shortcuts are prohibited
    And the six-file browser closure matches expected asset digests and tree integrity
    And pinned upload-pages-artifact and deploy-pages actions are used

  @PP-01 @build
  Scenario: Missing authority never manufactures a browser application
    Given no accepted immutable producer release is selected
    When the actual browser exporter is executed in a clean source-free directory
    Then export fails without creating the destination
    And adjacent producer builds and existing site files cannot supply a substitute
    And failed SDK verification prevents artifact publication

  @PP-01 @build
  Scenario: Artifact authority comes only from the selected SDK-verified producer
    Given a source-free publication policy without fixture assets or a fixture tree digest
    When configuration attempts to supply an expected artifact inventory or tree digest
    Then the policy parser rejects the unrecognized evidence fields
    And only the SDK-verified selected release supplies immutable artifact expectations

  @PP-01 @build
  Scenario: Producer selection cannot smuggle unreviewed authority
    Given the exact closed publication-selection schema
    When selection supplies unknown fields or non-string release identities
    Then selection fails before the SDK is invoked
    And no unreviewed selection field can become publication authority

  @PP-01 @build
  Scenario: Parsed workflow wiring cannot omit or bypass publication verification
    Given the complete reviewed export, publish and live-audit workflow graph
    When a job, step, dependency, successful-bootstrap guard, immutable action or observation binding is changed
    Then the parsed workflow contract rejects the mutation
    And comments, duplicate keys, extra steps and continue-on-error cannot supply verification
    And observations bracket the SDK byte and browser audits for the same deployment context
