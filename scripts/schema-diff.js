"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function resolveRepositoryPath(root, relative, label) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const resolved = path.resolve(root, relative);
  const fromRoot = path.relative(root, resolved);
  if (
    !fromRoot ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(fromRoot)
  ) {
    throw new Error(`${label} escapes the repository: ${relative}`);
  }
  return resolved;
}

function readLayer(content, label) {
  const matches = [...content.matchAll(/^\/\/ LAYER (\d+)\s*$/gm)];
  if (matches.length !== 1) {
    throw new Error(
      `${label} must contain exactly one layer marker, found ${matches.length}`
    );
  }
  return Number(matches[0][1]);
}

function parseSchema(content, label) {
  let kind = "constructor";
  const definitions = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) {
      continue;
    }
    if (line === "---types---") {
      kind = "constructor";
      continue;
    }
    if (line === "---functions---") {
      kind = "function";
      continue;
    }
    if (!line.endsWith(";")) {
      continue;
    }

    const match = line.match(/^([\w.]+)#([0-9a-fA-F]+)\b/);
    if (!match) {
      throw new Error(`Unable to parse ${label} definition: ${line}`);
    }

    const name = match[1];
    const key = `${kind}:${name}`;
    if (definitions.has(key)) {
      throw new Error(`Duplicate ${label} definition: ${key}`);
    }

    definitions.set(key, {
      key,
      kind,
      name,
      id: `0x${match[2].toLowerCase().padStart(8, "0")}`,
      signature: line,
    });
  }

  return definitions;
}

function compareSchemas(fromDefinitions, toDefinitions, from, to) {
  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, definition] of toDefinitions) {
    if (!fromDefinitions.has(key)) {
      added.push(definition);
    }
  }

  for (const [key, definition] of fromDefinitions) {
    const next = toDefinitions.get(key);
    if (!next) {
      removed.push(definition);
    } else if (definition.signature !== next.signature) {
      modified.push({
        key,
        kind: definition.kind,
        name: definition.name,
        before: {
          id: definition.id,
          signature: definition.signature,
        },
        after: {
          id: next.id,
          signature: next.signature,
        },
      });
    }
  }

  const byKey = (left, right) => left.key.localeCompare(right.key);
  added.sort(byKey);
  removed.sort(byKey);
  modified.sort(byKey);

  return {
    from,
    to,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      changedIds: modified.filter(
        (definition) => definition.before.id !== definition.after.id
      ).length,
    },
    added,
    removed,
    modified,
  };
}

function validateRemovals(removedDefinitions, allowedRemovals, label) {
  if (!Array.isArray(allowedRemovals)) {
    throw new Error(`${label} allowedRemovals must be an array`);
  }
  const allowed = new Set(allowedRemovals);
  if (allowed.size !== allowedRemovals.length) {
    throw new Error(`${label} allowedRemovals contains duplicates`);
  }

  const removed = new Set(
    removedDefinitions.map((definition) => definition.key)
  );
  const unexpected = [...removed].filter((key) => !allowed.has(key));
  const staleAllowances = [...allowed].filter((key) => !removed.has(key));
  if (unexpected.length) {
    throw new Error(
      `Unexpected removals in ${label}: ${unexpected.join(", ")}`
    );
  }
  if (staleAllowances.length) {
    throw new Error(
      `Stale removal allowances in ${label}: ${staleAllowances.join(", ")}`
    );
  }
}

function loadHistory(root, lock, options = {}) {
  if (!Array.isArray(lock.history) || lock.history.length < 2) {
    throw new Error("Schema lock must contain at least two history snapshots");
  }

  return lock.history.map((entry, index) => {
    const filePath = resolveRepositoryPath(
      root,
      entry.path,
      `Layer ${entry.layer} history path`
    );
    const content = fs.readFileSync(filePath);
    const actualHash = sha256(content);
    if (!options.allowHashUpdate && actualHash !== entry.sha256) {
      throw new Error(
        `Layer ${entry.layer} history hash mismatch: expected ${entry.sha256}, got ${actualHash}`
      );
    }

    const text = content.toString("utf8");
    const actualLayer = readLayer(text, `Layer ${entry.layer} history`);
    if (actualLayer !== entry.layer) {
      throw new Error(
        `History layer mismatch: lock has ${entry.layer}, schema has ${actualLayer}`
      );
    }

    const definitions = parseSchema(text, `Layer ${entry.layer}`);
    if (
      !options.allowHashUpdate &&
      definitions.size !== entry.definitionCount
    ) {
      throw new Error(
        `Layer ${entry.layer} definition count mismatch: expected ${entry.definitionCount}, got ${definitions.size}`
      );
    }

    if (index > 0 && lock.history[index - 1].layer + 1 !== entry.layer) {
      throw new Error("Schema history must contain every consecutive layer");
    }

    return {
      ...entry,
      sha256: actualHash,
      definitionCount: definitions.size,
      definitions,
    };
  });
}

function buildSemanticReport(history) {
  const transitions = [];
  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1];
    const current = history[index];
    transitions.push(
      compareSchemas(
        previous.definitions,
        current.definitions,
        previous.layer,
        current.layer
      )
    );
  }

  const first = history[0];
  const last = history[history.length - 1];
  return {
    formatVersion: 1,
    baselineLayer: first.layer,
    targetLayer: last.layer,
    transitions,
    cumulative: compareSchemas(
      first.definitions,
      last.definitions,
      first.layer,
      last.layer
    ),
  };
}

function withoutDefinitions(history) {
  return history.map(({ definitions, ...entry }) => entry);
}

module.exports = {
  buildSemanticReport,
  compareSchemas,
  loadHistory,
  parseSchema,
  readLayer,
  resolveRepositoryPath,
  sha256,
  validateRemovals,
  withoutDefinitions,
};
