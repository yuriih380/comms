# Contributing

Thanks for helping improve the skill. Bug reports and small, focused pull
requests are the most useful contributions.

## Before you open a pull request

1. Use Node.js 22.20 or later, then install and run the checks:

   ```bash
   npm ci
   npm run check
   ```

2. For a change to the skill's behavior, open an issue first. Describe the
   request that goes wrong and the reply you expected.
3. For a change to which file `comms-agents` writes, or to what it writes, open
   an issue first.
4. Add your change to the `Unreleased` section of [`CHANGELOG.md`](CHANGELOG.md).
   Leave version numbers alone; the maintainer sets them at release time.

## Rules for what ships

- Only `skills/comms/` and `scripts/comms-agents.mjs` reach users. Keep tooling,
  tests, and examples outside the skill folder.
- Keep the skill Markdown-only: no scripts, no network access, no instructions
  to install anything.
- Keep `comms-agents` free of dependencies and network requests. It writes only
  the marked `comms` section of one instructions file.
- Use only the frontmatter fields from the
  [Agent Skills specification](https://agentskills.io/specification).
- Add a test for each change to `comms-agents` or to the validator.

## Security issues

Report them privately as described in [`SECURITY.md`](SECURITY.md).
