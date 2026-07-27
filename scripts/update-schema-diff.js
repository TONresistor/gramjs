"use strict";

const fs = require("fs");
const path = require("path");
const {
  buildSemanticReport,
  loadHistory,
  resolveRepositoryPath,
  sha256,
  withoutDefinitions,
} = require("./schema-diff");

const root = path.resolve(__dirname, "..");
const lockPath = path.join(root, "telegram-schema.lock.json");
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const history = loadHistory(root, lock, { allowHashUpdate: true });
const report = buildSemanticReport(history);
const reportPath = resolveRepositoryPath(
  root,
  lock.semanticDiff.path,
  "Semantic diff report path"
);
const reportContent = `${JSON.stringify(report, null, 2)}\n`;

const previousTrace = new Map(
  (lock.trace || []).map((entry) => [`${entry.from}:${entry.to}`, entry])
);
lock.history = withoutDefinitions(history);
lock.trace = report.transitions.map((transition, index) => {
  const target = history[index + 1];
  const previous = previousTrace.get(`${transition.from}:${transition.to}`);
  return {
    from: transition.from,
    to: transition.to,
    commit: target.commit,
    ...transition.summary,
    allowedRemovals: previous?.allowedRemovals || [],
  };
});
lock.cumulativeFrom224 = report.cumulative.summary;

fs.writeFileSync(reportPath, reportContent);
lock.semanticDiff.sha256 = sha256(Buffer.from(reportContent));
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

console.log(
  `Recorded Layer ${report.baselineLayer}→${report.targetLayer} semantic diff: ` +
    `+${report.cumulative.summary.added} / -${report.cumulative.summary.removed} / ` +
    `${report.cumulative.summary.modified} modified / ` +
    `${report.cumulative.summary.changedIds} changed IDs`
);
