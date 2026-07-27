"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const manifest = require(path.join(root, "git-package-manifest.json")).files;
const packageMetadata = require(path.join(root, "package.json"));
const semanticDiff = require(path.join(root, "telegram-schema-diff.json"));
const schemaLock = require(path.join(root, "telegram-schema.lock.json"));
const { getChangedIds, validateInstalledPackage } = require("./package-smoke");
const metadataFiles = [
  "CHANGELOG.md",
  "FORK.md",
  "LICENSE",
  "README.md",
  "package.json",
];
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "gramjs-package-check-")
);
const fixture = path.join(temporaryRoot, "fixture");

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
  return result;
}

try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const pack = run(
    npm,
    ["pack", "--json", "--ignore-scripts", "--pack-destination", temporaryRoot],
    { cwd: root }
  );
  const reports = JSON.parse(pack.stdout);
  if (!Array.isArray(reports) || reports.length !== 1) {
    throw new Error("Expected exactly one npm pack report");
  }

  const report = reports[0];
  if (
    report.name !== packageMetadata.name ||
    report.version !== packageMetadata.version
  ) {
    throw new Error(
      `Unexpected tarball identity: ${report.name}@${report.version}`
    );
  }

  const expected = new Set([...manifest, ...metadataFiles]);
  const actual = new Set(report.files.map((entry) => entry.path));
  const missing = [...expected].filter((file) => !actual.has(file));
  const unexpected = [...actual].filter((file) => !expected.has(file));

  if (
    missing.length ||
    unexpected.length ||
    report.entryCount !== actual.size
  ) {
    throw new Error(
      [
        "Tarball contents do not match the generated manifest.",
        missing.length ? `Missing: ${missing.join(", ")}` : "",
        unexpected.length ? `Unexpected: ${unexpected.join(", ")}` : "",
        report.entryCount !== actual.size
          ? `Duplicate entries: report=${report.entryCount}, unique=${actual.size}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  fs.mkdirSync(fixture);
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    `${JSON.stringify({ private: true }, null, 2)}\n`
  );
  const tarball = path.join(temporaryRoot, report.filename);
  run(
    npm,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--omit=optional",
      tarball,
    ],
    { cwd: fixture }
  );

  const changedIds = getChangedIds(semanticDiff);
  validateInstalledPackage({
    fixture,
    expectedVersion: packageMetadata.version,
    expectedLayer: schemaLock.layer,
    changedIds,
  });

  console.log(
    `Verified and installed ${report.name}@${report.version} tarball: ` +
      `${actual.size} files, ${changedIds.length} changed IDs`
  );
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
