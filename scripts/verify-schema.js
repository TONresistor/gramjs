"use strict";

const fs = require("fs");
const path = require("path");
const {
  buildSemanticReport,
  loadHistory,
  readLayer,
  resolveRepositoryPath,
  sha256,
  validateRemovals,
} = require("./schema-diff");

const root = path.resolve(__dirname, "..");
const lock = require(path.join(root, "telegram-schema.lock.json"));

function readLockedFile(entry, label) {
  const filePath = resolveRepositoryPath(root, entry.path, `${label} path`);
  const content = fs.readFileSync(filePath);
  const actualHash = sha256(content);

  if (actualHash !== entry.sha256) {
    throw new Error(
      `${label} hash mismatch: expected ${entry.sha256}, got ${actualHash}`
    );
  }

  return content.toString("utf8");
}

function countDefinitions(content) {
  return content
    .split(/\r?\n/)
    .filter(
      (line) => line.length > 0 && !line.startsWith("//") && line.endsWith(";")
    ).length;
}

const api = readLockedFile(lock.api, "API schema");
readLockedFile(lock.mtproto, "MTProto schema");

const apiLayer = readLayer(api, "API schema");
if (apiLayer !== lock.layer) {
  throw new Error(
    `Layer mismatch: lock has ${lock.layer}, schema has ${apiLayer}`
  );
}

const definitionCount = countDefinitions(api);
if (definitionCount !== lock.api.definitionCount) {
  throw new Error(
    `Definition count mismatch: expected ${lock.api.definitionCount}, got ${definitionCount}`
  );
}

const history = loadHistory(root, lock);
const firstHistory = history[0];
const lastHistory = history[history.length - 1];
if (
  lastHistory.layer !== lock.layer ||
  lastHistory.path !== lock.api.path ||
  lastHistory.sha256 !== lock.api.sha256 ||
  lastHistory.commit !== lock.source.commit
) {
  throw new Error("Final history snapshot must match the locked API schema");
}

const report = buildSemanticReport(history);
if (firstHistory.layer !== lock.semanticDiff.baselineLayer) {
  throw new Error(
    `Semantic diff baseline mismatch: expected ${lock.semanticDiff.baselineLayer}, got ${firstHistory.layer}`
  );
}
if (
  !Array.isArray(lock.trace) ||
  lock.trace.length !== report.transitions.length
) {
  throw new Error("Schema trace does not match the locked history");
}

for (let index = 0; index < report.transitions.length; index += 1) {
  const actual = report.transitions[index];
  const expected = lock.trace[index];
  const target = history[index + 1];
  const summaryMatches = Object.entries(actual.summary).every(
    ([key, value]) => expected[key] === value
  );
  if (
    actual.from !== expected.from ||
    actual.to !== expected.to ||
    expected.commit !== target.commit ||
    !summaryMatches
  ) {
    throw new Error(
      `Semantic diff mismatch for Layer ${actual.from}→${actual.to}`
    );
  }

  validateRemovals(
    actual.removed,
    expected.allowedRemovals,
    `Layer ${actual.from}→${actual.to}`
  );
}

const cumulativeMatches = Object.entries(report.cumulative.summary).every(
  ([key, value]) => lock.cumulativeFrom224[key] === value
);
if (!cumulativeMatches) {
  throw new Error("Cumulative semantic diff summary does not match the lock");
}

const reportContent = fs.readFileSync(
  resolveRepositoryPath(
    root,
    lock.semanticDiff.path,
    "Semantic diff report path"
  )
);
if (sha256(reportContent) !== lock.semanticDiff.sha256) {
  throw new Error("Semantic diff report hash does not match the lock");
}
const committedReport = JSON.parse(reportContent.toString("utf8"));
if (JSON.stringify(committedReport) !== JSON.stringify(report)) {
  throw new Error(
    "Semantic diff report is stale; run npm run update:schema-diff"
  );
}

const result = {
  layer: lock.layer,
  definitions: definitionCount,
  baselineLayer: firstHistory.layer,
  added: report.cumulative.summary.added,
  removed: report.cumulative.summary.removed,
  modified: report.cumulative.summary.modified,
  changedIds: report.cumulative.summary.changedIds,
  apiSha256: lock.api.sha256,
  mtprotoSha256: lock.mtproto.sha256,
  sourceCommit: lock.source.commit,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(
    `Verified Telegram Layer ${result.layer}: ${result.definitions} definitions; ` +
      `Layer ${result.baselineLayer}→${result.layer} ` +
      `+${result.added} / -${result.removed} / ${result.modified} modified / ` +
      `${result.changedIds} changed IDs`
  );
}
