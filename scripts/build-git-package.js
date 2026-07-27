"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "git-package-manifest.json");
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "gramjs-git-build-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function copy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function listFiles(directory, prefix = "") {
  if (prefix.split(path.sep).length > 64) {
    throw new Error(`Generated artifact tree is unexpectedly deep: ${prefix}`);
  }
  const files = [];
  const currentDirectory = path.join(directory, prefix);
  for (const entry of fs.readdirSync(currentDirectory, {
    withFileTypes: true,
  })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(directory, relative));
    } else {
      files.push(relative.split(path.sep).join("/"));
    }
  }
  return files.sort();
}

function safeGeneratedPath(relative) {
  if (
    path.isAbsolute(relative) ||
    relative.includes("..") ||
    relative === "package.json" ||
    relative === "package-lock.json"
  ) {
    throw new Error(`Unsafe generated path: ${relative}`);
  }
  return path.join(root, relative);
}

try {
  const packageMetadata = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const schemaLock = JSON.parse(
    fs.readFileSync(path.join(root, "telegram-schema.lock.json"), "utf8")
  );
  if (
    packageMetadata.name !== "telegram" ||
    packageMetadata.main !== "index.js" ||
    packageMetadata.types !== "index.d.ts"
  ) {
    throw new Error(
      "Unexpected package identity; expected telegram with root entry points"
    );
  }

  const tsc = require.resolve("typescript/bin/tsc");
  run(process.execPath, [
    tsc,
    "--project",
    path.join(root, "tsconfig.json"),
    "--outDir",
    stage,
  ]);

  copy(path.join(root, "gramjs/tl/api.d.ts"), path.join(stage, "tl/api.d.ts"));
  copy(path.join(root, "gramjs/define.d.ts"), path.join(stage, "define.d.ts"));
  copy(
    path.join(root, "gramjs/tl/static/api.tl"),
    path.join(stage, "tl/static/api.tl")
  );
  copy(
    path.join(root, "gramjs/tl/static/schema.tl"),
    path.join(stage, "tl/static/schema.tl")
  );

  const smoke = `
const path = require("path");
const stage = ${JSON.stringify(stage)};
const layer = require(path.join(stage, "tl/AllTLObjects.js")).LAYER;
const version = require(path.join(stage, "Version.js")).version;
const api = require(path.join(stage, "tl/index.js")).Api;
if (layer !== ${schemaLock.layer}) {
    throw new Error("Expected Layer ${schemaLock.layer}, got " + layer);
}
if (version !== ${JSON.stringify(packageMetadata.version)}) {
    throw new Error("Expected version ${
      packageMetadata.version
    }, got " + version);
}
if ((api.messages.SearchGlobal.CONSTRUCTOR_ID >>> 0) !== 0x6126a43c) {
    throw new Error("Unexpected messages.searchGlobal constructor");
}
`;
  run(process.execPath, ["-e", smoke], {
    env: {
      ...process.env,
      NODE_PATH: path.join(root, "node_modules"),
    },
  });

  const nextManifest = listFiles(stage);
  const previousManifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8")).files
    : [];

  for (const relative of previousManifest) {
    if (!nextManifest.includes(relative)) {
      fs.rmSync(safeGeneratedPath(relative), { force: true });
    }
  }
  for (const relative of nextManifest) {
    copy(path.join(stage, relative), safeGeneratedPath(relative));
  }

  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ files: nextManifest }, null, 2)}\n`
  );
  console.log(`Synchronized ${nextManifest.length} Git package artifacts`);
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
