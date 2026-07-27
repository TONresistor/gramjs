"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "gramjs-generated-check-")
);
const checkout = path.join(temporaryRoot, "checkout");
const excluded = new Set([
  ".git",
  "browser",
  "coverage",
  "node_modules",
  "tasks",
]);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function hash(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

try {
  fs.cpSync(root, checkout, {
    recursive: true,
    filter(source) {
      const relative = path.relative(root, source);
      const first = relative.split(path.sep)[0];
      return !excluded.has(first);
    },
  });
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(checkout, "node_modules"),
    "dir"
  );

  run(process.execPath, ["scripts/verify-schema.js"], checkout);
  run(
    process.execPath,
    ["-r", "ts-node/register", "gramjs/tl/generateModule.js"],
    checkout
  );
  run(process.execPath, ["scripts/build-git-package.js"], checkout);

  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "git-package-manifest.json"), "utf8")
  ).files;
  const generatedSource = [
    "gramjs/tl/AllTLObjects.ts",
    "gramjs/tl/api.d.ts",
    "gramjs/tl/apiTl.js",
    "gramjs/tl/schemaTl.js",
    "git-package-manifest.json",
  ];

  for (const relative of [...generatedSource, ...manifest]) {
    const expected = path.join(root, relative);
    const actual = path.join(checkout, relative);
    if (!fs.existsSync(expected) || !fs.existsSync(actual)) {
      throw new Error(`Missing generated artifact: ${relative}`);
    }
    if (hash(expected) !== hash(actual)) {
      throw new Error(`Generated artifact drift: ${relative}`);
    }
  }

  console.log(
    `Generated artifacts are reproducible (${manifest.length} package files)`
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
