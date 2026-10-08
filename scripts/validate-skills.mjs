// Validate the Agent Skills specification plus this repository's release policy.
// License copies, matching versions, LF text, and contained links are repo rules.
// https://agentskills.io/specification

import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS_DIR = join(ROOT, "skills");
const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const license = readText("LICENSE");
const changelog = readText("CHANGELOG.md");

if (pkg) {
  if (pkg.private !== true) fail("package.json", "tooling must stay private");
  if (pkg.license !== "MIT")
    fail("package.json", "repository license must be MIT");
  if (
    typeof pkg.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(pkg.version)
  ) {
    fail("package.json", "version must be a semantic version string");
  }
  if (lock) {
    for (const [where, entry] of [
      ["package-lock.json", lock],
      ['package-lock.json packages[""]', lock.packages?.[""]],
    ]) {
      if (entry?.name !== pkg.name || entry?.version !== pkg.version) {
        fail(where, "name and version must match package.json");
      }
    }
  }
  if (changelog !== null) checkChangelog(changelog);
}
if (existsSync(join(ROOT, "SKILL.md"))) {
  fail(
    "SKILL.md",
    "a root skill hides skills/ and can install the whole repository",
  );
}

const names = existsSync(SKILLS_DIR)
  ? readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];
if (names.length === 0) fail("skills/", "no skill folders found");
for (const name of names) validateSkill(name);
if (errors.length === 0) checkInstall(names);

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ ${names.join(", ")} valid; Codex and Claude Code installs match source bytes`,
  );
}

function readText(path) {
  try {
    return readFileSync(join(ROOT, path), "utf8");
  } catch (error) {
    fail(path, `cannot read file: ${error.message}`);
    return null;
  }
}

function readJson(path) {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(path, `invalid JSON: ${error.message}`);
    return null;
  }
}

function validateSkill(dirName) {
  const skillDir = join(SKILLS_DIR, dirName);
  const where = `skills/${dirName}/SKILL.md`;
  const text = readText(where);
  if (text === null) return;
  if (text.includes("\r"))
    fail(where, "repository policy requires LF line endings");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return fail(where, "missing YAML frontmatter");

  let frontmatter;
  try {
    frontmatter = parse(match[1]);
  } catch (error) {
    return fail(where, `invalid YAML frontmatter: ${error.message}`);
  }
  if (!isPlainObject(frontmatter))
    return fail(where, "frontmatter must be a mapping");
  for (const field of Object.keys(frontmatter)) {
    if (!ALLOWED_FIELDS.has(field))
      fail(where, `unknown field "${field}"; use metadata`);
  }

  const { name, description, compatibility, metadata } = frontmatter;
  if (
    typeof name !== "string" ||
    !NAME_PATTERN.test(name) ||
    name.length > 64
  ) {
    fail(
      where,
      "name must be 1-64 lowercase letters, digits, and single hyphens",
    );
  } else if (name !== dirName) {
    fail(where, `name "${name}" must match folder "${dirName}"`);
  }
  if (
    typeof description !== "string" ||
    !description.trim() ||
    description.length > 1024
  ) {
    fail(
      where,
      "description must be a nonempty string of at most 1024 characters",
    );
  }
  if (
    compatibility !== undefined &&
    (typeof compatibility !== "string" ||
      !compatibility.trim() ||
      compatibility.length > 500)
  ) {
    fail(
      where,
      "compatibility must be a nonempty string of at most 500 characters",
    );
  }
  if (
    frontmatter["allowed-tools"] !== undefined &&
    typeof frontmatter["allowed-tools"] !== "string"
  ) {
    fail(where, "allowed-tools must be a string");
  }

  // The specification makes license and metadata optional. This repo requires
  // them so each installed payload identifies its license and release version.
  if (pkg && frontmatter.license !== pkg.license) {
    fail(where, `repository policy requires license "${pkg.license}"`);
  }
  const licenseFile = join(skillDir, "LICENSE.txt");
  if (
    license !== null &&
    (!existsSync(licenseFile) ||
      !readFileSync(licenseFile).equals(Buffer.from(license)))
  ) {
    fail(
      `skills/${dirName}/LICENSE.txt`,
      "must match root LICENSE byte for byte",
    );
  }
  if (!isPlainObject(metadata)) {
    fail(where, "repository policy requires metadata with a version");
  } else {
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value !== "string")
        fail(where, `metadata.${key} must be a string`);
    }
    if (pkg && metadata.version !== pkg.version) {
      fail(
        where,
        `repository policy requires metadata.version "${pkg.version}"`,
      );
    }
  }
  if (text.slice(match[0].length).trimEnd().split("\n").length > 500) {
    fail(where, "repository policy limits the skill body to 500 lines");
  }
  for (const file of listFiles(skillDir)) {
    if (file.endsWith(".md")) checkLinks(skillDir, join(skillDir, file));
  }
}

// Check inline and reference links in prose, excluding fenced and inline code.
function checkLinks(skillDir, file) {
  const where = relative(ROOT, file).split(sep).join("/");
  const prose = readFileSync(file, "utf8")
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, "")
    .replace(/(`+)[\s\S]*?\1/g, "");
  const targets = [
    ...prose.matchAll(
      /\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g,
    ),
    ...prose.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(<[^>\n]+>|[^\s]+)/gm),
  ];
  for (const [, raw] of targets) {
    const target = raw.startsWith("<") ? raw.slice(1, -1) : raw;
    if (/^(?:[a-z]:[\\/]|file:)/i.test(target)) {
      fail(where, `link "${target}" must be relative to the skill`);
      continue;
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    let path;
    try {
      const decoded = decodeURIComponent(target.split(/[?#]/)[0]);
      if (isAbsolute(decoded)) {
        fail(where, `link "${target}" must be relative to the skill`);
        continue;
      }
      path = resolve(dirname(file), decoded);
    } catch {
      fail(where, `link "${target}" is not a valid URI`);
      continue;
    }
    if (!isContained(skillDir, path)) {
      fail(where, `link "${target}" points outside the installed skill`);
    } else if (!existsSync(path)) {
      fail(where, `link "${target}" does not resolve`);
    } else if (!isContained(realpathSync(skillDir), realpathSync(path))) {
      fail(where, `link "${target}" resolves outside the installed skill`);
    }
  }
}

function isContained(parent, child) {
  const path = relative(parent, child);
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function checkChangelog(text) {
  const latest = /^## \[([^\]]+)\] - (Unreleased|\d{4}-\d{2}-\d{2})$/m.exec(
    text,
  );
  if (latest?.[1] !== pkg.version) {
    fail("CHANGELOG.md", `latest version heading must match ${pkg.version}`);
  }
  if (!/^### Added$/m.test(text))
    fail("CHANGELOG.md", "initial release must list Added changes");
}

function checkInstall(skillNames) {
  const require = createRequire(import.meta.url);
  const cli = join(
    dirname(require.resolve("skills/package.json")),
    "bin",
    "cli.mjs",
  );
  const temporaryRoot = realpathSync(tmpdir());
  const scratch = mkdtempSync(join(temporaryRoot, "comms-skills-install-"));
  try {
    for (const [agent, folder] of [
      ["codex", ".agents"],
      ["claude-code", ".claude"],
    ]) {
      const project = join(scratch, agent);
      mkdirSync(project);
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "add",
          ROOT,
          "--skill",
          ...skillNames,
          "--agent",
          agent,
          "--yes",
          "--copy",
        ],
        {
          cwd: project,
          encoding: "utf8",
          timeout: 120_000,
          env: {
            ...process.env,
            DISABLE_TELEMETRY: "1",
            DO_NOT_TRACK: "1",
            NO_COLOR: "1",
            CI: "1",
          },
        },
      );
      const where = `skills CLI (${agent})`;
      if (result.status !== 0) {
        fail(
          where,
          result.error?.message ??
            `exited ${result.status}\n${result.stdout}${result.stderr}`,
        );
        continue;
      }
      const installRoot = join(project, folder, "skills");
      const installed = existsSync(installRoot)
        ? readdirSync(installRoot).sort()
        : [];
      if (JSON.stringify(installed) !== JSON.stringify(skillNames)) {
        fail(where, `installed [${installed}], expected [${skillNames}]`);
      }
      for (const name of skillNames) {
        const sourceRoot = join(SKILLS_DIR, name);
        const copiedRoot = join(installRoot, name);
        const source = listFiles(sourceRoot);
        const copied = listFiles(copiedRoot);
        if (JSON.stringify(source) !== JSON.stringify(copied)) {
          fail(where, `${name} installed [${copied}], expected [${source}]`);
          continue;
        }
        for (const file of source) {
          if (
            !readFileSync(join(sourceRoot, file)).equals(
              readFileSync(join(copiedRoot, file)),
            )
          ) {
            fail(where, `${name}/${file} differs from source bytes`);
          }
        }
      }
    }
  } finally {
    // Remove only the freshly created scratch directory inside the OS temp root.
    if (
      dirname(scratch) !== temporaryRoot ||
      !basename(scratch).startsWith("comms-skills-install-")
    ) {
      throw new Error(
        `Refusing to clean unexpected temporary path: ${scratch}`,
      );
    }
    rmSync(scratch, { recursive: true, force: true });
  }
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (lstatSync(path).isSymbolicLink()) {
        fail(
          relative(ROOT, path),
          "repository policy requires regular payload files, not symlinks",
        );
      } else if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push(relative(dir, path).split(sep).join("/"));
      }
    }
  }
  visit(dir);
  return files.sort();
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
