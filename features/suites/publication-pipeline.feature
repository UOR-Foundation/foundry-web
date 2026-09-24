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
