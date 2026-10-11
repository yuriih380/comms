# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0-rc.0] - 2026-10-11

### Added

- An optional `comms-agents` command to add, preview, update, or remove the
  communication rules in an explicitly chosen instructions file. Regular skill
  distribution remains the default.
- Regression tests for preserving existing instructions and updating managed
  sections without duplicates.
- Public npm distribution as `@yuriih380/comms`, with regular skill installation
  remaining the default.
- GitHub Actions publishing for stable GitHub releases through npm trusted
  publishing, with version checks and package verification before upload.

## [0.1.0] - 2026-10-08

### Added

- `comms` skill for brief replies, a natural voice, and clear technical writing.
- Scoped preference overrides, persistent conversation preferences, and
  protection for facts, uncertainty, and exact technical details.
- Agent Skills frontmatter with license, author, and version metadata.
- Local and GitHub installation through the `skills` CLI, including release tags.
- An MIT license at the repository root and inside the installed skill folder.
- Communication examples showing rewrites and preference changes.
- Prettier, cspell, metadata validation, and clean installation checks for
  Codex and Claude Code, available through `npm run check` and CI.
- Validator regression tests for metadata, versions, licenses, links, and
  installation failures or changed payloads, included in `npm run check`.
- Documentation for installation, usage, development, and future releases of
  `yuriih380/comms` on GitHub.

[unreleased]: https://github.com/yuriih380/comms/compare/v0.2.0-rc.0...HEAD
[0.2.0-rc.0]: https://github.com/yuriih380/comms/releases/tag/v0.2.0-rc.0
[0.1.0]: https://github.com/yuriih380/comms/releases/tag/v0.1.0
