Feature: Producer release binding and scope integrity
  The publisher binds the exact authorized uor-foundry producer release identity,
  validates bit-for-bit reproducible artifact tree closure, verifies signed
  pre-publication evidence, and strictly enforces the dependency boundary on
  complete producer platform acceptance.

  @PB-01 @build
  Scenario: Bind authorized producer release identity, artifact tree, and enforce scope integrity
    Given an approved producer release specification in model/publisher_binding.toml
    When the producer release identity and pre-publication evidence are verified
    Then the bit-for-bit reproducible artifact tree matches all six distribution assets
    And signed pre-publication evidence is confirmed valid with no preview or handwritten bypasses
    And platform acceptance is explicitly unaccepted preserving scope integrity for staged core
