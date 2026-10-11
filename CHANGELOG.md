# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-10-11

### Fixed

- Stop inserting the MIT license notice into `AGENTS.md` or other instructions
  files. Package and skill license files remain included in their distributions.
- Rerunning `add` replaces the existing managed comms section and removes its
  old embedded license notice without duplicating instructions. Regression tests
  cover upgrades, repeat runs, previews, line endings, and preservation of the
  project's own content and license outside the section.

## [0.3.0] - 2026-10-11

### Changed

- `npx @yuriih380/comms add` now prepends instructions to the project-root
  `AGENTS.md` without requiring `--file`. It detects Git roots and worktrees,
  then falls back to the nearest `package.json` folder or the current directory.
- Existing managed sections update in place. Removal preserves the original
  content and spacing.
- `remove` and `--dry-run` use the same default target; `--file` remains
  available to override it.
- Updated installation, development, and release documentation for the default
  command and current distribution. Regular skill installation remains the default.

## [0.2.0] - 2026-10-11

### Added

- Stable npm release of the optional instructions-file installer. Use
  `npx @yuriih380/comms add --file ./AGENTS.md` instead of installing the skill
  when persistent communication preferences are wanted.
- Activated npm trusted publishing for the GitHub Actions release workflow.

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

[unreleased]: https://github.com/yuriih380/comms/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/yuriih380/comms/releases/tag/v0.3.1
[0.3.0]: https://github.com/yuriih380/comms/releases/tag/v0.3.0
[0.2.0]: https://github.com/yuriih380/comms/releases/tag/v0.2.0
[0.2.0-rc.0]: https://github.com/yuriih380/comms/releases/tag/v0.2.0-rc.0
[0.1.0]: https://github.com/yuriih380/comms/releases/tag/v0.1.0
