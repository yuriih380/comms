#!/usr/bin/env node

// Optional instructions-file distribution. Regular skill installs never run this.
import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const START = "<!-- comms:start -->";
const END = "<!-- comms:end -->";
const HELP = `Usage: comms-agents <add|remove> [--file <path>] [--dry-run]

add       Prepend communication rules, or update the existing comms section.
remove    Remove only the managed comms section.
--file    Override the default project-root AGENTS.md with an explicit path.
--dry-run Print the resulting file without writing it.
--help    Show this help.

This optional command does not install the comms skill.
The project root is the nearest Git root, otherwise the nearest package.json
folder, otherwise the current directory. Git worktrees are supported.
`;

try {
  main();
} catch (error) {
  console.error(`comms-agents: ${error.message}`);
  process.exitCode = 1;
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      file: { type: "string" },
      "dry-run": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  const [action] = positionals;
  if (
    positionals.length !== 1 ||
    !["add", "remove"].includes(action) ||
    (values.file !== undefined && !values.file.trim())
  ) {
    throw new Error(HELP);
  }

  const target = values.file
    ? resolve(values.file)
    : resolve(findProjectRoot(process.cwd()), "AGENTS.md");
  let original = "";
  let mode;
  try {
    const stat = lstatSync(target);
    if (!stat.isFile()) {
      throw new Error(
        "Target must be a regular file, not a directory or symlink.",
      );
    }
    mode = stat.mode;
    // Reject non-UTF-8 input rather than silently corrupting the user's text.
    original = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(readFileSync(target));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const section = findSection(original);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  let updated = original;
  if (action === "add") {
    const block = createBlock(newline);
    if (section) {
      updated =
        original.slice(0, section.start) + block + original.slice(section.end);
    } else {
      // Keep a UTF-8 BOM at the beginning of the file.
      const offset = original.startsWith("\uFEFF") ? 1 : 0;
      updated = original.slice(0, offset) + block + original.slice(offset);
    }
  } else if (section) {
    updated = original.slice(0, section.start) + original.slice(section.end);
  }

  if (values["dry-run"]) {
    process.stdout.write(updated);
    return;
  }
  if (updated === original) {
    console.log(`No changes: ${target}`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  // Replace only after the complete output has been written successfully.
  const temporary = `${target}.comms-${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, updated, { encoding: "utf8", flag: "wx", mode });
    renameSync(temporary, target);
  } finally {
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  console.log(
    `${action === "add" ? "Added or updated" : "Removed"} comms: ${target}`,
  );
}

function findProjectRoot(start) {
  let directory = start;
  let packageRoot;
  while (true) {
    // A .git file identifies a worktree; a directory identifies a checkout.
    if (existsSync(resolve(directory, ".git"))) return directory;
    if (!packageRoot && existsSync(resolve(directory, "package.json"))) {
      packageRoot = directory;
    }
    const parent = dirname(directory);
    if (parent === directory) return packageRoot ?? start;
    directory = parent;
  }
}

function findSection(text) {
  const starts = text.split(START).length - 1;
  const ends = text.split(END).length - 1;
  if (!starts && !ends) return null;
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (starts !== 1 || ends !== 1 || end < start) {
    throw new Error(
      "Incomplete or duplicate comms markers; repair them before retrying.",
    );
  }
  // The two line breaks after the end marker belong to the generated block.
  const after = end + END.length;
  const spacing = /^(?:\r?\n){0,2}/.exec(text.slice(after))[0];
  return { start, end: after + spacing.length };
}

function createBlock(newline) {
  const skill = readFileSync(
    new URL("../skills/comms/SKILL.md", import.meta.url),
    "utf8",
  );
  const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(skill);
  if (!frontmatter)
    throw new Error("The bundled skill is missing its frontmatter.");
  const body = skill.slice(frontmatter[0].length).trim();
  if (!body) throw new Error("The bundled skill has no instructions.");
  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const license = readFileSync(
    new URL("../skills/comms/LICENSE.txt", import.meta.url),
    "utf8",
  ).trim();
  return [
    START,
    `<!-- comms version: ${version}; source: https://github.com/yuriih380/comms -->`,
    "",
    body,
    "",
    "<!--",
    license,
    "-->",
    END,
    "",
    "",
  ]
    .join("\n")
    .replace(/\r?\n/g, newline);
}
