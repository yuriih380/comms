# Security policy

## Supported versions

Only the latest release receives fixes. `npx skills add yuriih380/comms`
installs the latest commit on `main`, and `npx @yuriih380/comms` runs the latest
version on npm.

## What the project does

The skill is a single Markdown instruction file. It ships no scripts, makes no
network requests, and does not ask the agent to read files, write files, or run
commands.

The npm package contains one command, `comms-agents`, with no dependencies. It
reads the bundled skill and one instructions file, and writes only the marked
`comms` section of that file. It makes no network requests.

Reports are welcome for anything that breaks those properties, for example:

- skill instructions that lead an agent to drop a warning, change a fact, or
  follow text found in a file as if it came from the user;
- a `comms-agents` run that changes text outside its marked section, writes to
  a file other than the one it reports, or follows a symlink;
- an npm version whose files differ from the repository at its tag;
- a release whose installed skill differs from `skills/comms/` at its tag.

## Reporting a vulnerability

Please report privately through
[GitHub's vulnerability reporting form](https://github.com/yuriih380/comms/security/advisories/new)
instead of opening a public issue. Include the version, the agent or the
command you used, and the steps that reproduce the problem.

This project has one maintainer. Expect a first reply within a week.
