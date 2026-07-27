"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const policy = JSON.parse(
  fs.readFileSync(path.join(root, "audit-exceptions.json"), "utf8")
);
if (policy.formatVersion !== 1 || !Array.isArray(policy.exceptions)) {
  throw new Error("Unsupported audit exception policy");
}
const advisoryUrls = policy.exceptions.map((exception) => exception.advisory);
if (new Set(advisoryUrls).size !== advisoryUrls.length) {
  throw new Error("Audit exception policy contains duplicate advisories");
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["audit", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  process.stderr.write(result.stderr || result.stdout || "");
  throw new Error("npm audit did not return valid JSON");
}
if (!audit.vulnerabilities || !audit.metadata?.vulnerabilities) {
  throw new Error("npm audit response does not contain vulnerability data");
}

const exceptions = new Map(
  policy.exceptions.map((exception) => [exception.advisory, exception])
);
const usedExceptions = new Set();

for (const exception of exceptions.values()) {
  const expires = Date.parse(`${exception.expires}T23:59:59Z`);
  if (!Number.isFinite(expires)) {
    throw new Error(`Invalid audit exception expiry: ${exception.expires}`);
  }
  if (Date.now() > expires) {
    throw new Error(
      `Audit exception expired on ${exception.expires}: ${exception.advisory}`
    );
  }
  if (exception.scope !== "dev") {
    throw new Error(
      `Only development-only audit exceptions are allowed: ${exception.advisory}`
    );
  }
  if (exception.severity !== "high" && exception.severity !== "critical") {
    throw new Error(`Invalid audit exception severity: ${exception.advisory}`);
  }
  if (!exception.reason?.trim()) {
    throw new Error(
      `Audit exception reason is required: ${exception.advisory}`
    );
  }
}

function resolveAdvisories(name, seen = new Set()) {
  if (seen.has(name)) {
    return [];
  }
  seen.add(name);
  const vulnerability = audit.vulnerabilities[name];
  if (!vulnerability) {
    return [];
  }

  const advisories = [];
  for (const via of vulnerability.via) {
    if (typeof via === "string") {
      advisories.push(...resolveAdvisories(via, seen));
    } else if (via.url) {
      advisories.push({
        package: via.name,
        severity: via.severity,
        url: via.url,
      });
    }
  }
  return advisories;
}

const highOrCritical = Object.entries(audit.vulnerabilities).filter(
  ([, vulnerability]) =>
    vulnerability.severity === "high" || vulnerability.severity === "critical"
);

for (const [name] of highOrCritical) {
  const advisories = resolveAdvisories(name);
  if (!advisories.length) {
    throw new Error(`Unable to resolve the advisory chain for ${name}`);
  }
  for (const advisory of advisories) {
    const exception = exceptions.get(advisory.url);
    if (
      !exception ||
      exception.package !== advisory.package ||
      exception.severity !== advisory.severity
    ) {
      throw new Error(
        `Unapproved high/critical advisory for ${name}: ` +
          `${advisory.package} ${advisory.url}`
      );
    }
    usedExceptions.add(advisory.url);
  }
}

const unused = [...exceptions.keys()].filter(
  (advisory) => !usedExceptions.has(advisory)
);
if (unused.length) {
  throw new Error(
    `Unused audit exceptions must be removed: ${unused.join(", ")}`
  );
}

const counts = audit.metadata.vulnerabilities;
console.log(
  "Full audit findings: " +
    `info=${counts.info}, low=${counts.low}, moderate=${counts.moderate}, ` +
    `high=${counts.high}, critical=${counts.critical}`
);
const lowerSeverity = Object.entries(audit.vulnerabilities)
  .filter(([, vulnerability]) =>
    ["info", "low", "moderate"].includes(vulnerability.severity)
  )
  .map(([name, vulnerability]) => `${name}(${vulnerability.severity})`);
if (lowerSeverity.length) {
  console.log(`Non-blocking lower-severity paths: ${lowerSeverity.join(", ")}`);
}
console.log(
  `Full audit policy passed: ${highOrCritical.length} high/critical ` +
    `development paths covered by ${usedExceptions.size} unexpired exception`
);
