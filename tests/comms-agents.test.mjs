// cspell:ignore українська
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
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
const cli = join(root, "scripts/comms-agents.mjs");

function fixture(t) {
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, "instructions-test-"));
  t.after(() => {
    assert.equal(dirname(directory), temporaryRoot);
    assert.ok(basename(directory).startsWith("instructions-test-"));
    rmSync(directory, { recursive: true, force: true });
  });
  const target = join(directory, "project with spaces", "AGENTS.md");
  function run(...args) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    return result;
  }
  function write(content) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return { target, run, write, directory };
}

test("creates instructions from the skill without installing a skill", (t) => {
  const { target, run, directory } = fixture(t);
  const result = run("add", "--file", target);
  assert.equal(result.status, 0, result.stderr);
  const output = readFileSync(target, "utf8");
  const skill = readFileSync(join(root, "skills/comms/SKILL.md"), "utf8");
  const body = skill.slice(skill.indexOf("\n---", 4) + 4).trim();
  assert.ok(output.includes(body));
  assert.ok(
    output.includes(readFileSync(join(root, "LICENSE"), "utf8").trim()),
  );
  assert.ok(!output.includes("description:"));
  assert.ok(!existsSync(join(directory, ".agents")));
  assert.ok(!existsSync(join(directory, ".claude")));
});

for (const original of [
  "# Project\n\nKeep these rules.\n",
  "\uFEFF# Project\r\n\r\nKeep café and українська exactly.",
  "# Project without a final newline",
  "",
]) {
  test(`add, repeat, update and remove preserve existing bytes: ${JSON.stringify(original)}`, (t) => {
    const { target, run, write } = fixture(t);
    write(original);
    assert.equal(run("add", "--file", target).status, 0);
    const installed = readFileSync(target);
    assert.equal(run("add", "--file", target).status, 0);
    assert.deepEqual(readFileSync(target), installed);
    write(
      installed
        .toString()
        .replace("# Communication", "# Old communication rules"),
    );
    assert.equal(run("add", "--file", target).status, 0);
    assert.deepEqual(readFileSync(target), installed);
    if (original.includes("\r\n")) {
      assert.ok(!/(?<!\r)\n/.test(installed.toString()));
      assert.ok(installed.toString().startsWith("\uFEFF"));
    }
    assert.equal(run("remove", "--file", target).status, 0);
    assert.deepEqual(readFileSync(target), Buffer.from(original));
    assert.equal(run("remove", "--file", target).status, 0);
    assert.deepEqual(readFileSync(target), Buffer.from(original));
  });
}

test("updates and removes a section between user instructions", (t) => {
  const { target, run, write } = fixture(t);
  run("add", "--file", target);
  const block = readFileSync(target, "utf8");
  write(
    "# Before\n\n" +
      block.replace("# Communication", "# Old rules") +
      "# After\n",
  );
  assert.equal(run("add", "--file", target).status, 0);
  assert.equal(
    readFileSync(target, "utf8"),
    "# Before\n\n" + block + "# After\n",
  );
  assert.equal(run("remove", "--file", target).status, 0);
  assert.equal(readFileSync(target, "utf8"), "# Before\n\n# After\n");
});

test("previews add and removal without touching the filesystem", (t) => {
  const { target, run, write } = fixture(t);
  const preview = run("add", "--file", target, "--dry-run");
  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(preview.stdout.includes("# Communication"));
  assert.ok(!existsSync(dirname(target)));
  write(preview.stdout + "# My rules\n");
  const original = readFileSync(target);
  const removal = run("remove", "--file", target, "--dry-run");
  assert.equal(removal.status, 0, removal.stderr);
  assert.equal(removal.stdout, "# My rules\n");
  assert.deepEqual(readFileSync(target), original);
});

test("removing from a missing file does not create it", (t) => {
  const { target, run } = fixture(t);
  assert.equal(run("remove", "--file", target).status, 0);
  assert.ok(!existsSync(dirname(target)));
});

test("rejects ambiguous sections and invalid UTF-8 without changing bytes", (t) => {
  const { target, run, write } = fixture(t);
  for (const original of [
    Buffer.from("# Rules\n<!-- comms:start -->\nIncomplete"),
    Buffer.from("<!-- comms:end -->\n<!-- comms:start -->"),
    Buffer.from(
      "<!-- comms:start --><!-- comms:end --><!-- comms:start --><!-- comms:end -->",
    ),
    Buffer.from([0xff, 0xfe, 0x41, 0x00]),
  ]) {
    write(original);
    for (const action of ["add", "remove"]) {
      const result = run(action, "--file", target);
      assert.equal(result.status, 1, result.stdout);
      assert.deepEqual(readFileSync(target), original);
    }
  }
});

test("requires an explicit action and target and rejects unknown flags", (t) => {
  const { target, run } = fixture(t);
  for (const args of [
    [],
    ["add"],
    ["add", "--file", target, "--global"],
    ["update", "--file", target],
  ]) {
    assert.equal(run(...args).status, 1);
  }
  assert.equal(run("--help").status, 0);
  assert.ok(!existsSync(target));
});
