Feature: Publisher SDK and template binding
  The publisher adopts accepted immutable SDK and template locks, verifies
  multi-architecture parity, and enforces export-browser interface support.

  @PW-01 @build
  Scenario: Validate immutable multi-architecture SDK binding and export-browser interface
    Given an approved publisher SDK binding in model/publisher_sdk.toml
    When platform manifests are verified for linux/amd64 and linux/arm64
    Then both architecture manifests match locked image digests exactly
    And export-browser interface support is verified available without PP7101 rejection
    And offline dependency closure matches pinned Cargo.lock digest
