import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = join(root, ".temp");
const version = "1.2.3";
const skillPath = "skills/fixture-skill/SKILL.md";
const licensePath = "skills/fixture-skill/LICENSE.txt";
const skill = `---
name: fixture-skill
description: A fixture for validator regression tests.
license: MIT
metadata:
  version: "${version}"
---

# Fixture skill

See [the guide](references/guide.md).
`;

// Fixtures live below the repository so YAML resolves from npm ci's dependencies.
// Only the fixture's skills CLI is replaced; the production validator is copied.
const installer = `import { appendFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const source = args[1];
const agent = args[args.indexOf("--agent") + 1];
const mode = process.env.VALIDATOR_INSTALL_MODE;
appendFileSync(join(source, "install-agents.txt"), agent + "\\n");
if (mode === "fail") {
  console.error("Fixture installer failed");
  process.exit(7);
}
const folder = agent === "codex" ? ".agents" : ".claude";
const target = join(process.cwd(), folder, "skills", "fixture-skill");
mkdirSync(target, { recursive: true });
cpSync(join(source, "skills", "fixture-skill"), target, { recursive: true });
if (mode === "corrupt") appendFileSync(join(target, "SKILL.md"), "Changed bytes\\n");
if (mode === "missing") rmSync(join(target, "references", "guide.md"));
if (mode === "extra") writeFileSync(join(target, "extra.txt"), "Extra file\\n");
`;

function fixture(t) {
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, "validator-test-"));
  t.after(() => {
    assert.equal(dirname(directory), temporaryRoot);
    assert.ok(basename(directory).startsWith("validator-test-"));
    rmSync(directory, { recursive: true, force: true });
  });
  function write(path, content) {
    const destination = join(directory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(
      destination,
      typeof content === "string" ? content : JSON.stringify(content) + "\n",
    );
  }
  const pkg = {
    name: "validator-fixture",
    version,
    private: true,
    license: "MIT",
  };
  const license = readFileSync(join(root, "LICENSE"), "utf8");
  write("package.json", pkg);
  write("package-lock.json", {
    name: pkg.name,
    version,
    packages: { "": { name: pkg.name, version } },
  });
  write("LICENSE", license);
  write(
    "CHANGELOG.md",
    `## [${version}] - Unreleased\n\n### Added\n\n- Fixture.\n`,
  );
  write(skillPath, skill);
  write(licensePath, license);
  write(
    "skills/fixture-skill/references/guide.md",
    "See [the skill](../SKILL.md).\n",
  );
  write("node_modules/skills/package.json", { name: "skills", type: "module" });
  write("node_modules/skills/bin/cli.mjs", installer);
  mkdirSync(join(directory, "scripts"));
  cpSync(
    join(root, "scripts/validate-skills.mjs"),
    join(directory, "scripts/validate-skills.mjs"),
  );
  return { directory, write };
}

function run(directory, mode = "copy") {
  const result = spawnSync(
    process.execPath,
    [join(directory, "scripts/validate-skills.mjs")],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, VALIDATOR_INSTALL_MODE: mode },
    },
  );
  const output = result.stdout + result.stderr;
  assert.ifError(result.error);
  assert.equal(result.signal, null, output);
  return { status: result.status, output };
}

test("valid metadata, links, and copied payloads pass for both agents", (t) => {
  const { directory } = fixture(t);
  const result = run(directory);
  assert.equal(result.status, 0, result.output);
  assert.equal(
    readFileSync(join(directory, "install-agents.txt"), "utf8"),
    "codex\nclaude-code\n",
  );
});

const invalidFixtures = [
  [
    "missing required metadata",
    ({ write }) =>
      write(skillPath, skill.replace(/metadata:\n  version:.*\n/, "")),
    /metadata/,
  ],
  [
    "non-string allowed-tools",
    ({ write }) =>
      write(
        skillPath,
        skill.replace("license: MIT", "license: MIT\nallowed-tools: [Read]"),
      ),
    /allowed-tools/,
  ],
  [
    "skill version mismatch",
    ({ write }) => write(skillPath, skill.replace(version, "9.9.9")),
    /metadata\.version/,
  ],
  ...["lock root", "lock package root"].map((label) => [
    `${label} version mismatch`,
    ({ directory, write }) => {
      const lock = JSON.parse(
        readFileSync(join(directory, "package-lock.json"), "utf8"),
      );
      (label === "lock root" ? lock : lock.packages[""]).version = "9.9.9";
      write("package-lock.json", lock);
    },
    /package-lock\.json/,
  ]),
  [
    "missing license metadata",
    ({ write }) => write(skillPath, skill.replace("license: MIT\n", "")),
    /license/,
  ],
  [
    "mismatched license metadata",
    ({ write }) =>
      write(skillPath, skill.replace("license: MIT", "license: Apache-2.0")),
    /license/,
  ],
  [
    "missing license copy",
    ({ directory }) => rmSync(join(directory, licensePath)),
    /LICENSE\.txt/,
  ],
  [
    "mismatched license copy",
    ({ write }) => write(licensePath, "Different license\n"),
    /LICENSE\.txt/,
  ],
  [
    "broken local link",
    ({ write }) => write(skillPath, skill + "\n[Missing](missing.md)\n"),
    /link.*missing\.md/,
  ],
  ...[
    ["inline", "[Outside](../../LICENSE)"],
    ["reference", "[Outside][outside]\n\n[outside]: ../../LICENSE"],
    ["encoded", "[Outside](%2e%2e/%2e%2e/LICENSE)"],
  ].map(([label, link]) => [
    `${label} link escapes the skill`,
    ({ write }) => write(skillPath, skill + "\n" + link + "\n"),
    /link.*outside the installed skill/,
  ]),
  [
    "accidental root skill",
    ({ write }) => write("SKILL.md", skill),
    /^✗ SKILL\.md:/m,
  ],
];

for (const [label, mutate, diagnostic] of invalidFixtures) {
  test(label, (t) => {
    const current = fixture(t);
    mutate(current);
    const result = run(current.directory);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, diagnostic);
  });
}

for (const [mode, diagnostic] of [
  ["corrupt", /SKILL\.md.*source bytes/],
  ["missing", /installed.*expected/],
  ["extra", /extra\.txt/],
  ["fail", /exited 7/],
]) {
  test(`installer ${mode} is rejected for both agents`, (t) => {
    const { directory } = fixture(t);
    const result = run(directory, mode);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, diagnostic);
    assert.match(result.output, /skills CLI \(codex\)/);
    assert.match(result.output, /skills CLI \(claude-code\)/);
  });
}
