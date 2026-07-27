"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { spawnSync } = require("child_process");
const { getChangedIds, validateInstalledPackage } = require("./package-smoke");

const root = path.resolve(__dirname, "..");
const packageMetadata = require(path.join(root, "package.json"));
const schemaLock = require(path.join(root, "telegram-schema.lock.json"));
const semanticDiff = require(path.join(root, "telegram-schema-diff.json"));
const manifest = require(path.join(root, "git-package-manifest.json")).files;
const metadataFiles = [
  "CHANGELOG.md",
  "FORK.md",
  "LICENSE",
  "README.md",
  "package.json",
];
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "gramjs-git-package-check-")
);
const repository = path.join(temporaryRoot, "repository");
const fixture = path.join(temporaryRoot, "fixture");
const excluded = new Set([".git", "browser", "coverage", "node_modules"]);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function listFiles(directory, prefix = "") {
  const files = [];
  const current = path.join(directory, prefix);
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (!prefix && entry.name === "node_modules") {
      continue;
    }
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(directory, relative));
    } else {
      files.push(relative.split(path.sep).join("/"));
    }
  }
  return files.sort();
}

try {
  fs.cpSync(root, repository, {
    recursive: true,
    filter(source) {
      const relative = path.relative(root, source);
      const first = relative.split(path.sep)[0];
      return !excluded.has(first) && !first.startsWith(".browser-build-");
    },
  });

  run("git", ["init", "--quiet"], { cwd: repository });
  run("git", ["config", "user.name", "GramJS package check"], {
    cwd: repository,
  });
  run("git", ["config", "user.email", "package-check@invalid"], {
    cwd: repository,
  });
  run("git", ["add", "--all"], { cwd: repository });
  run("git", ["commit", "--quiet", "-m", "temporary package validation"], {
    cwd: repository,
  });
  const commit = run("git", ["rev-parse", "HEAD"], { cwd: repository });
  if (run("git", ["status", "--porcelain"], { cwd: repository })) {
    throw new Error("Temporary Git package repository is not clean");
  }

  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`
  );
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const gitUrl = `git+${pathToFileURL(repository).href}#${commit}`;
  run(
    npm,
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--omit=optional",
      gitUrl,
    ],
    { cwd: fixture }
  );

  const installed = path.join(fixture, "node_modules", "telegram");
  const expectedFiles = [...manifest, ...metadataFiles].sort();
  const actualFiles = listFiles(installed);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const expected = new Set(expectedFiles);
    const actual = new Set(actualFiles);
    const missing = expectedFiles.filter((file) => !actual.has(file));
    const unexpected = actualFiles.filter((file) => !expected.has(file));
    throw new Error(
      [
        "Git package contents do not match the generated manifest.",
        missing.length ? `Missing: ${missing.join(", ")}` : "",
        unexpected.length ? `Unexpected: ${unexpected.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  for (const relative of expectedFiles) {
    const source = path.join(root, relative);
    const actual = path.join(installed, relative);
    if (!fs.existsSync(actual)) {
      throw new Error(`Git package is missing ${relative}`);
    }
    if (sha256(source) !== sha256(actual)) {
      throw new Error(`Git package content mismatch: ${relative}`);
    }
  }

  const changedIds = getChangedIds(semanticDiff);
  validateInstalledPackage({
    fixture,
    expectedVersion: packageMetadata.version,
    expectedLayer: schemaLock.layer,
    changedIds,
  });

  console.log(
    `Verified exact temporary Git commit ${commit.slice(0, 12)}: ` +
      `${expectedFiles.length} files, ` +
      `${changedIds.length} changed IDs`
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
