# MCP Install Risk Scanner

## Purpose / Big Picture

This repository provides a deterministic, local-only scanner for MCP install
commands and configurations plus a Manifest V3 Chrome extension. Users can
inspect selected text or visible setup snippets without executing or uploading
them, review redacted findings, and export the report.

## Progress

- [x] 2026-08-07: Public repository and isolated implementation branch created.
- [x] 2026-08-07: Implemented the versioned scanner API, 14 rules, schema, fixtures, and tests.
- [x] 2026-08-07: Implemented and validated the Chrome extension and deterministic package.
- [ ] Publish `v0.1.0`, release ZIP, checksum, and source documentation.

## Surprises & Discoveries

- The dedicated Wavect SSH public key was already registered, so GitHub login completed despite the duplicate-key upload response.

## Decision Log

- 2026-08-07, Codex: GPLv3 matches the Wavect site and is the repository license.
- 2026-08-07, Codex: The repository root is the installable core package; extension code lives under `extension/`.
- 2026-08-07, Codex: Findings describe static signals and never label input as safe or malicious.

## Outcomes & Retrospective

Implementation is in progress. Repository creation is complete; scanner,
extension, automated validation, and deterministic packaging are complete. The
tagged GitHub release and manual Chrome interaction checks remain.

## Context and Orientation

`src/` owns deterministic rules and report creation. `schema/` documents the
public report shape. `extension/` imports the same source during its local
build. `scripts/` packages a self-contained store ZIP, and `tests/fixtures/`
contains shared examples for scanner and UI validation.

## Plan of Work

Implement a synchronous scanner with redaction-first evidence capture and
stable rule ordering. Add unit, manifest, package, and source-policy tests.
Build the popup and context-menu flows with only the planned permissions, then
document privacy, support, contribution, and store metadata. Package twice to
prove deterministic output before tagging and releasing `v0.1.0`.

## Concrete Steps

Run from this repository root:

    npm install
    npm test
    npm run check
    npm run package
    npm run verify:package
    git diff --check

Push through the repository SSH remote and publish the release with `gh` only
after all checks pass.

## Validation and Acceptance

Every rule needs positive and benign cases. Tests must prove deterministic
reports, secret redaction, package exports, exact manifest permissions, absence
of host permissions and remote code, and deterministic ZIP contents. Manual
Chrome checks cover selection, page extraction, restricted pages, exports,
keyboard use, narrow layouts, and zero network requests.

## Idempotence and Recovery

Build and package commands replace only ignored `dist/` artifacts and are safe
to repeat. A failed release can be retried from the same verified tag and ZIP.
Never delete or recreate the public repository to recover from a release error.

## Artifacts and Notes

- Homepage: `https://wavect.io/tools/mcp-install-risk-scanner/`
- Source repository: `https://github.com/wavect/mcp-install-risk-scanner`
- Automated result: 25 tests passed; source policy passed for 14 rules.
- Deterministic ZIP SHA-256: `e82dd4057e63cc082758bbc448eb9ade651623bda9d6c40adf007ae6fc7296a1`.

## Interfaces and Dependencies

The root package exports `scanMcpInstallText(text, options)`,
`SCANNER_VERSION`, `SCHEMA_VERSION`, and summary constants. The extension uses
Manifest V3 with `activeTab`, `scripting`, and `contextMenus`; it has no runtime
network dependency.
