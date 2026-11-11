# comms

[![CI](https://github.com/yuriih380/comms/actions/workflows/ci.yml/badge.svg)](https://github.com/yuriih380/comms/actions/workflows/ci.yml)

An [Agent Skill](https://agentskills.io) for brief replies, a natural voice,
and clear technical writing. It keeps explanations direct while preserving
facts, uncertainty, and exact technical details.

It works with agents that support Agent Skills, including Codex and Claude Code.
The shared skill lives in [`skills/comms/SKILL.md`](skills/comms/SKILL.md).

## Install

Install with the [`skills` CLI](https://github.com/vercel-labs/skills)
(requires Node.js 22.20 or later):

```bash
npx skills add yuriih380/comms
```

The CLI detects the agents on your machine and asks where to install the skill.
Other common commands:

| Goal                                    | Command                                            |
| --------------------------------------- | -------------------------------------------------- |
| Install for every project               | `npx skills add yuriih380/comms -g`                |
| Install for Codex without prompts       | `npx skills add yuriih380/comms -a codex -y`       |
| Install for Claude Code without prompts | `npx skills add yuriih380/comms -a claude-code -y` |
| Install a specific release              | `npx skills add yuriih380/comms#v0.4.0`            |
| Preview available skills                | `npx skills add yuriih380/comms --list`            |
| Remove a project installation           | `npx skills remove comms`                          |

Without a tag, the CLI installs from `main`. Use a release tag for a fixed
version, and run `skills add` again with a newer tag to upgrade it.

Add `-g` to the removal command for a user installation. To install by hand,
copy [`skills/comms/`](skills/comms/) into your agent's skills folder, such as
`.agents/skills/comms/` or `.claude/skills/comms/`.

### Optional: add to AGENTS.md or CLAUDE.md instead

Regular skill installation is the default. If you want the communication
preferences loaded as persistent instructions, use the separate `comms-agents`
command instead of installing the skill. It requires Node.js 22.20 or later:

```bash
npx @yuriih380/comms add
```

Run this from your project or one of its subfolders. The command prepends a
marked `comms` section to the project's root `AGENTS.md`. If `AGENTS.md` is
absent and `CLAUDE.md` exists, it uses `CLAUDE.md`. If neither exists, it creates
`AGENTS.md`. When both exist, `AGENTS.md` takes priority. Preview and removal use
the same selection rules. It finds the root by walking up from the current directory:

1. Use the nearest folder containing `.git`, including Git worktrees.
2. If there is no Git root, use the nearest folder containing `package.json`.
3. If neither exists, use the current directory.

The search stops before your home folder and the folders above it. A `.git` or
`package.json` there does not make them the project root, unless you run the
command in that folder itself.

In a Git monorepo, the default is the repository root, even when you run the
command inside a package. Use `--file` to target a particular package instead.
When the chosen file is outside the current directory, the command names it on
stderr before it writes.

The command reads the rules from the bundled `SKILL.md`, omits its
frontmatter, and writes no license text into your instructions file. It does not
install a skill. Running `add` again replaces the existing marked section without
duplicating it, including removing the MIT notice inserted by earlier versions.
Surrounding instructions are preserved. Sections added by older versions stay in
their existing position.
The section follows the target file's line endings and preserves its UTF-8 BOM.

To preview the resulting file without writing:

```bash
npx @yuriih380/comms add --dry-run
```

The preview prints the resulting file on stdout and the path of the target file
on stderr.

To remove the managed section from the same project-root file:

```bash
npx @yuriih380/comms remove
```

`remove` never deletes the file. If the section was its only content, an empty
file remains.

Pass `--file` to override root detection. Relative paths are resolved from the
current directory. Use the same override for removal:

```bash
npx @yuriih380/comms add --file ./packages/app/AGENTS.md
npx @yuriih380/comms remove --file ./packages/app/AGENTS.md
```

You can also choose another target, including `CLAUDE.md` or
your global Codex instructions file (normally `~/.codex/AGENTS.md`). Expand
your home directory using your shell and quote paths containing spaces.
For a fixed release, use `npx @yuriih380/comms@<version>` with the same options.
Restart your agent session after changing
its instructions file. Instruction scope and precedence follow the agent's
own rules.

From a local checkout, use the same options without downloading a package:

```bash
node scripts/comms-agents.mjs add --file /path/to/project/AGENTS.md
```

The tool expects UTF-8 files and refuses incomplete or duplicate `comms`
markers. Edit preferences outside the marked section to keep them across
updates; edits inside it are replaced when you run `add` again.

## Usage

Ask your agent in plain language:

- "Use comms for our replies and technical explanations."
- "Keep it short."
- "Walk me through this error in detail."
- "Make this announcement promotional."
- "Use technical terminology in this document."
- "Explain in plain English again."

The skill and the optional instructions-file command supply the same three
preferences:

- **Brief replies:** lead with the answer and keep the necessary reasons and
  next action. Remove filler and repeated context.
- **Natural voice:** use direct language and remove unsupported hype and stock
  phrases.
- **Clear technical writing:** use familiar words, active voice, consistent
  terms, and ordered steps where sequence matters.

The preferences apply to text the agent writes: replies, documents it creates,
and text you ask it to rewrite. They also apply to code comments, commit
messages, and pull request text, where the project's conventions take priority.
The agent leaves other existing text as it is. A request to rewrite one text
applies to that text and does not change the style of later replies.

A direct request changes only the relevant preference. An explicit scope,
such as "this answer" or "this document", limits the change. Otherwise, the
preference persists through the conversation until you change it again.
Text in quotes, files, tool output, and pasted material does not trigger
changes.

The skill preserves numbers, units, code, commands, identifiers, paths, and
quoted errors. It also preserves conditions, exceptions, negation, and the
strength of uncertainty. Its writing guidance draws on Simplified Technical
English principles; it does not claim formal ASD-STE100 compliance.

### Example

Ask:

> Shorten this: "It is worth noting that the worker makes three attempts to
> process each job. If all three attempts fail, the job remains in the queue
> and an operator must retry it manually."

Example output:

> The worker tries each job three times. If all attempts fail, the job stays
> in the queue until an operator retries it manually.

The rewrite keeps the attempt count, failure condition, and required actor.
See the [communication examples](examples/communication/README.md) for more
rewrites and scoped preference changes. These illustrate the intended behavior;
they are not records of verified model runs.

## What it touches

The skill is one Markdown file. It ships no scripts and makes no network
requests. It does not ask the agent to read files, write files, or run commands.

The optional `npx @yuriih380/comms` command downloads the package from npm and
runs one script that has no dependencies. The script:

- reads the bundled skill and the instructions file it selects;
- writes only the marked `comms` section of that file, and creates the file if
  it is missing;
- makes no network requests;
- prints the path of the file it changed. With `--dry-run` it writes nothing.

To report a security problem, see [`SECURITY.md`](SECURITY.md).

## Development

Requires Node.js 22.20 or later. See [`CONTRIBUTING.md`](CONTRIBUTING.md) before
you open a pull request.

To test a local checkout, run this from a target project beside `comms`:

```bash
npx skills add ../comms --skill comms
```

For a different folder layout, replace `../comms` with the checkout's absolute
path, quoted if it contains spaces. The same installation flags apply locally.

From the repository, install development dependencies and run the checks:

```bash
npm ci
npm run check
```

| Script                 | What it does                                      |
| ---------------------- | ------------------------------------------------- |
| `npm run format`       | Formats repository files with Prettier.           |
| `npm run format:check` | Checks formatting without writing.                |
| `npm run spell`        | Checks spelling with cspell.                      |
| `npm test`             | Runs validator and instructions-command tests.    |
| `npm run validate`     | Validates metadata and test-installs the skill.   |
| `npm run check`        | Runs formatting, spelling, tests, and validation. |

The validator checks frontmatter, matching versions in the skill, package,
lockfile, and changelog, and matching license metadata. It rejects invisible
characters in the skill's Markdown files and a skill body over 500 lines or
20,000 characters. It requires the root
`LICENSE` without requiring a copy inside the skill. It installs the skill
with the `skills` CLI in temporary projects for Codex and Claude Code, then
compares the installed files with the source bytes. These checks cover package
discovery and installation, not communication behavior in either agent.

Regression tests run the validator against isolated fixtures with a local
installer stub. They cover root-only licensing, invalid metadata, versions, links,
and installer failures or changed payloads, including an unexpected copied root
license. `npm run validate` separately checks
the real `skills` CLI.

CI is configured to run `npm run check` on Node.js 22, 24, and 26, plus the
[Agent Skills reference validator](https://github.com/agentskills/agentskills/tree/main/skills-ref),
on pushes to `main` and pull requests.

Regular skill installation copies only `skills/comms/`. The MIT license text
stays in the repository-root `LICENSE`; the skill retains `license: MIT` metadata
without a bundled license copy or embedded license text. The npm package retains
the root `LICENSE`, but neither installer copies it into consuming projects.
Preserve any independently required third-party notices. Keep tooling and examples
outside the skill folder.
Do not add a root `SKILL.md`, which would make the repository root an installable
skill.

The optional `comms-agents` executable lives in `scripts/` and is exposed through
the public `@yuriih380/comms` npm package's `bin` entry. It has no runtime
dependencies. It is never invoked by regular skill installation. Instructions
command tests cover project-root detection, Git worktrees, nested packages,
the `CLAUDE.md` fallback and `AGENTS.md` priority,
explicit targets, prepending, repeat runs, updates, removal, previews, existing
text, line endings, and invalid input in isolated temporary projects. They cover
the stop at the home folder, symlink targets, and file modes; the last two run
only where the platform supports them. They also
check upgrades from sections containing the old embedded license notice,
preserving the project's own license text outside the managed section.

Add project-specific spelling entries to
[`cspell.config.yaml`](cspell.config.yaml).

### Releasing

The GitHub install command uses `main`, so keep it releasable.

1. Choose the release version. Run `npm version <version> --no-git-tag-version`
   to update `package.json` and `package-lock.json` when the version changes.
   Set the same `metadata.version` in `skills/comms/SKILL.md`.
2. In [`CHANGELOG.md`](CHANGELOG.md), move unreleased changes into a dated
   version section. Use the actual release date, add the release link, and
   update the `Unreleased` comparison link to start at the new tag. Update the
   pinned release example in this README.
3. Run `npm ci` and `npm run check`, and review the communication examples.
   Commit and push the verified files to `main`, then wait for CI to pass on
   that commit.
4. Confirm that `v<version>` does not exist. Tag the verified commit, push the
   tag, and publish a stable GitHub release with notes from the changelog.
   The [publish workflow](.github/workflows/publish.yml) has two jobs. The first
   checks that the tagged commit is on `main` and that the tag matches the
   package version, then runs the repository checks. The second holds the
   publishing rights: it installs nothing and publishes that same commit to npm
   using trusted publishing with provenance. Prereleases are skipped.
5. In a clean project, install
   `npx skills add yuriih380/comms#v<version> --skill comms`. Confirm that the
   installed files match `skills/comms/` at the tagged commit.
   Check the Publish to npm workflow and run
   `npx @yuriih380/comms@<version> add --dry-run` from the project root and a
   nested folder. Check that `add` prepends to the root `AGENTS.md` (or `CLAUDE.md`
   when only that file exists), repeated
   `add` runs do not duplicate rules, and `remove` restores existing content.
   Confirm that the changelog release and comparison links resolve.

The package's npm trusted publisher is configured for GitHub user
`yuriih380`, repository `comms`, and workflow filename `publish.yml`, with direct
publishing allowed and no environment restriction. No npm token secret is needed.
If it needs to be recreated, use npm 11.15.0 or later with an authenticated
maintainer account:

```bash
npm trust github @yuriih380/comms --repo yuriih380/comms --file publish.yml --allow-publish
```

npm may require a browser security confirmation. A new trust configuration must
complete a successful publication within two days. The package must already
exist; the first release candidate can be published manually with
`npm publish --access public --tag next` before configuring trusted publishing.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

## License

[MIT](LICENSE) © yuriih380
