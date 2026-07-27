"use strict";

const assert = require("assert");
const bigInt = require("big-integer");
const packageMetadata = require("../package.json");
const semanticDiff = require("../telegram-schema-diff.json");
const schemaLock = require("../telegram-schema.lock.json");
const { version } = require("../Version");
const { LAYER, tlobjects } = require("../tl/AllTLObjects");
const { Api } = require("../tl");
const {
  getChangedIds,
  validateChangedIds,
  validateProtocolSerialization,
} = require("./package-smoke");

assert.strictEqual(packageMetadata.name, "telegram");
assert.strictEqual(packageMetadata.main, "index.js");
assert.strictEqual(packageMetadata.types, "index.d.ts");
assert.strictEqual(version, packageMetadata.version);
assert.strictEqual(LAYER, schemaLock.layer);
assert.strictEqual(Api.messages.SearchGlobal.CONSTRUCTOR_ID >>> 0, 0x6126a43c);
assert.strictEqual(
  tlobjects[Api.messages.SearchGlobal.CONSTRUCTOR_ID],
  Api.messages.SearchGlobal
);

const changedIds = getChangedIds(semanticDiff);
validateChangedIds(Api, tlobjects, changedIds);
validateProtocolSerialization(Api, bigInt);

console.log(
  `Root package smoke passed for version ${version} / Layer ${LAYER}`
);
