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
const changelog = `## [${version}] - Unreleased

### Added

- Fixture.

[unreleased]: https://example.com/compare/v${version}...HEAD
[${version}]: https://example.com/releases/tag/v${version}
`;
const guidePath = "skills/fixture-skill/references/guide.md";

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
if (mode === "root-license") cpSync(join(source, "LICENSE"), join(target, "LICENSE.txt"));
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
    publishConfig: { access: "public" },
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
  write("CHANGELOG.md", changelog);
  write(skillPath, skill);
  write(guidePath, "See [the skill](../SKILL.md).\n");
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

test("root-only licensing, valid metadata, links, and copied payloads pass for both agents", (t) => {
  const { directory } = fixture(t);
  const result = run(directory);
  assert.equal(result.status, 0, result.output);
  assert.equal(
    readFileSync(join(directory, "install-agents.txt"), "utf8"),
    "codex\nclaude-code\n",
  );
});

const invalidFixtures = [
  ...[
    ["private package", { private: true }],
    ["restricted package", { publishConfig: { access: "restricted" } }],
    ["package license other than MIT", { license: "Apache-2.0" }],
    ["package version that is not semantic", { version: "1.2" }],
  ].map(([label, changes]) => [
    label,
    ({ directory, write }) => {
      const pkg = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
      write("package.json", { ...pkg, ...changes });
    },
    /package\.json/,
  ]),
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
    "missing root license",
    ({ directory }) => rmSync(join(directory, "LICENSE")),
    /LICENSE.*cannot read file/,
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
  [
    "uppercase name",
    ({ write }) =>
      write(
        skillPath,
        skill.replace("name: fixture-skill", "name: Fixture-Skill"),
      ),
    /name must be 1-64 lowercase letters/,
  ],
  [
    "name that differs from its folder",
    ({ write }) =>
      write(
        skillPath,
        skill.replace("name: fixture-skill", "name: other-skill"),
      ),
    /name "other-skill" must match folder "fixture-skill"/,
  ],
  [
    "reserved word in name",
    ({ write }) =>
      write(
        "skills/claude-fixture/SKILL.md",
        skill
          .replace("name: fixture-skill", "name: claude-fixture")
          .replace("See [the guide](references/guide.md).\n", ""),
      ),
    /must not contain the reserved words/,
  ],
  [
    "missing description",
    ({ write }) => write(skillPath, skill.replace(/^description: .*\n/m, "")),
    /description must be a nonempty string/,
  ],
  [
    "overlong description",
    ({ write }) =>
      write(
        skillPath,
        skill.replace(
          "A fixture for validator regression tests.",
          "x".repeat(1025),
        ),
      ),
    /description must be a nonempty string of at most 1024 characters/,
  ],
  [
    "angle brackets in description",
    ({ write }) =>
      write(skillPath, skill.replace("A fixture", "A <b>fixture</b>")),
    /description must not contain angle brackets/,
  ],
  [
    "unknown frontmatter field",
    ({ write }) =>
      write(
        skillPath,
        skill.replace("license: MIT", "license: MIT\nwhen_to_use: Always."),
      ),
    /unknown field "when_to_use"/,
  ],
  [
    "overlong compatibility",
    ({ write }) =>
      write(
        skillPath,
        skill.replace(
          "license: MIT",
          `license: MIT\ncompatibility: ${"x".repeat(501)}`,
        ),
      ),
    /compatibility must be a nonempty string of at most 500 characters/,
  ],
  [
    "non-string metadata value",
    ({ write }) =>
      write(
        skillPath,
        skill.replace(
          `version: "${version}"`,
          `version: "${version}"\n  build: 7`,
        ),
      ),
    /metadata\.build must be a string/,
  ],
  [
    "CRLF line endings",
    ({ write }) => write(skillPath, skill.replaceAll("\n", "\r\n")),
    /SKILL\.md: repository policy requires LF line endings/,
  ],
  [
    "missing frontmatter",
    ({ write }) => write(skillPath, "# Fixture skill\n"),
    /missing YAML frontmatter/,
  ],
  [
    "invalid frontmatter YAML",
    ({ write }) =>
      write(
        skillPath,
        skill.replace("name: fixture-skill", "name: [fixture-skill"),
      ),
    /invalid YAML frontmatter/,
  ],
  [
    "too many body lines",
    ({ write }) => write(skillPath, skill + "line\n".repeat(501)),
    /limits the skill body to 500 lines/,
  ],
  [
    "oversized body",
    ({ write }) => write(skillPath, `${skill}${"x".repeat(20_001)}\n`),
    /limits the skill body to 20000 characters/,
  ],
  [
    "invisible character",
    ({ write }) => write(skillPath, `${skill}Zero​width\n`),
    /SKILL\.md: remove the invisible character U\+200B/,
  ],
  [
    "CRLF in a reference file",
    ({ write }) => write(guidePath, "# Guide\r\n"),
    /references\/guide\.md: repository policy requires LF line endings/,
  ],
  [
    "invisible character in a reference file",
    ({ write }) => write(guidePath, "# Gui‮de\n"),
    /references\/guide\.md: remove the invisible character U\+202E/,
  ],
  ...[
    ["absolute", "[Outside](/etc/hosts)"],
    ["file URL", "[Outside](file:///etc/hosts)"],
  ].map(([label, link]) => [
    `${label} link`,
    ({ write }) => write(skillPath, skill + "\n" + link + "\n"),
    /link.*must be relative to the skill/,
  ]),
  [
    "changelog version mismatch",
    ({ write }) =>
      write("CHANGELOG.md", changelog.replaceAll(version, "9.9.9")),
    /CHANGELOG\.md: latest version heading must match/,
  ],
  [
    "missing changelog version link",
    ({ write }) => write("CHANGELOG.md", changelog.replace(/^\[\d.*\n/m, "")),
    /CHANGELOG\.md: add a \[1\.2\.3\] link reference/,
  ],
  [
    "stale unreleased comparison link",
    ({ write }) =>
      write(
        "CHANGELOG.md",
        changelog.replace(`v${version}...HEAD`, "v1.2.2...HEAD"),
      ),
    /CHANGELOG\.md: \[unreleased\] must compare v1\.2\.3\.\.\.HEAD/,
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
  ["root-license", /LICENSE\.txt/],
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
