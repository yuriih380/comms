# comms

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
| Install a specific release              | `npx skills add yuriih380/comms#v0.1.0`            |
| Preview available skills                | `npx skills add yuriih380/comms --list`            |
| Remove a project installation           | `npx skills remove comms`                          |

Without a tag, the CLI installs from `main`. Use a release tag for a fixed
version, and run `skills add` again with a newer tag to upgrade it.

Add `-g` to the removal command for a user installation. To install by hand,
copy [`skills/comms/`](skills/comms/) into your agent's skills folder, such as
`.agents/skills/comms/` or `.claude/skills/comms/`.

### Optional: add to AGENTS.md instead

Regular skill installation is the default. If you want the communication
preferences loaded as persistent instructions, use the separate `comms-agents`
command instead of installing the skill. It requires Node.js 22.20 or later
and Git for npm's GitHub package source:

```bash
npx --package=github:yuriih380/comms comms-agents add --file ./AGENTS.md
```

The command creates the file if needed, or prepends a marked `comms` section
to an existing file. It reads the rules from the bundled `SKILL.md`, omits its
frontmatter, and includes the MIT notice. It does not install a skill.
Running it again updates the existing section while preserving surrounding
instructions. The section follows the target file's line endings.

To preview the resulting file without writing:

```bash
npx --package=github:yuriih380/comms comms-agents add --file ./AGENTS.md --dry-run
```

To remove the managed section:

```bash
npx --package=github:yuriih380/comms comms-agents remove --file ./AGENTS.md
```

Pass an explicit path to choose another target, including `CLAUDE.md` or
your global Codex instructions file (normally `~/.codex/AGENTS.md`). Expand
your home directory using your shell and quote paths containing spaces.
For a fixed release, append `#v<version>` to the GitHub package source, using
a release that includes this command. Restart your agent session after changing
its instructions file. Instruction scope and precedence follow the agent's
own rules; placing the section first does not grant it special priority.

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

The skill applies three preferences by default:

- **Brief replies:** lead with the answer and keep the necessary reasons and
  next action. Remove filler and repeated context.
- **Natural voice:** use direct language and remove unsupported hype and stock
  phrases.
- **Clear technical writing:** use familiar words, active voice, consistent
  terms, and ordered steps where sequence matters.

A direct request changes only the relevant preference. An explicit scope,
such as "this answer" or "this document", limits the change. Otherwise, the
preference persists through the conversation until you change it again.
Quoted examples do not trigger changes.

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

## Development

Requires Node.js 22.20 or later.

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
lockfile, and changelog, and matching license copies. It installs the skill
with the `skills` CLI in temporary projects for Codex and Claude Code, then
compares the installed files with the source bytes. These checks cover package
discovery and installation, not communication behavior in either agent.

Regression tests run the validator against isolated fixtures with a local
installer stub. They cover invalid metadata, versions, license copies, links,
and installer failures or changed payloads. `npm run validate` separately checks
the real `skills` CLI.

CI is configured to run `npm run check` on Node.js 22 and 24, plus the
[Agent Skills reference validator](https://github.com/agentskills/agentskills/tree/main/skills-ref),
on pushes to `main` and pull requests.

Only `skills/comms/` is installed. It includes `LICENSE.txt` so installed
copies retain the MIT notice. Keep tooling and examples outside that folder.
Do not add a root `SKILL.md`, which would make the repository root an installable
skill.

The optional `comms-agents` executable lives in `scripts/` and is exposed through
the private package's `bin` entry for npm execution from GitHub. It has no runtime
dependencies. It is never invoked by regular skill installation. Instructions
command tests cover repeat runs, updates, removal, previews, existing text,
line endings, and invalid input in isolated temporary projects.

Add project-specific spelling entries to
[`cspell.config.yaml`](cspell.config.yaml).

### Releasing

The GitHub install command uses `main`, so keep it releasable.

1. Choose the release version. Run `npm version <version> --no-git-tag-version`
   to update `package.json` and `package-lock.json` when the version changes.
   Set the same `metadata.version` in `skills/comms/SKILL.md`.
2. In [`CHANGELOG.md`](CHANGELOG.md), move unreleased changes into a dated
   version section. Use the actual release date, add the release link, and
   update the `Unreleased` comparison link to start at the new tag.
3. Run `npm ci` and `npm run check`, and review the communication examples.
   Commit and push the verified files to `main`, then wait for CI to pass on
   that commit.
4. Confirm that `v<version>` does not exist. Tag the verified commit, push the
   tag, and create the GitHub release with notes from the changelog.
5. In a clean project, install
   `npx skills add yuriih380/comms#v<version> --skill comms`. Confirm that the
   installed files match `skills/comms/` at the tagged commit.
   Confirm that the changelog release and comparison links resolve.

## License

[MIT](LICENSE) © yuriih380
