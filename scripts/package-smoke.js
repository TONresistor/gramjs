"use strict";

const assert = require("assert");
const path = require("path");
const { createRequire } = require("module");

function toClassName(name) {
  return name
    .replace(/(?:^|_)([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/_/g, "");
}

function getApiClass(Api, definitionName) {
  const parts = definitionName.split(".");
  const name = toClassName(parts.pop());
  let current = Api;
  for (const namespace of parts) {
    current = current?.[namespace];
  }
  return current?.[name];
}

function getChangedIds(semanticDiff) {
  return semanticDiff.cumulative.modified
    .filter((definition) => definition.before.id !== definition.after.id)
    .map((definition) => ({
      name: definition.name,
      before: definition.before.id,
      after: definition.after.id,
    }));
}

function validateChangedIds(Api, tlobjects, changedIds) {
  assert.strictEqual(changedIds.length, 32);
  for (const definition of changedIds) {
    const apiClass = getApiClass(Api, definition.name);
    const oldId = Number.parseInt(definition.before.slice(2), 16);
    const newId = Number.parseInt(definition.after.slice(2), 16);
    assert.strictEqual(
      typeof apiClass,
      "function",
      `Missing API class for ${definition.name}`
    );
    assert.strictEqual(apiClass.CONSTRUCTOR_ID >>> 0, newId);
    assert.strictEqual(tlobjects[newId], apiClass);
    assert.notStrictEqual(tlobjects[oldId], apiClass);
  }
}

function validateProtocolSerialization(Api, bigInt) {
  const requests = [
    new Api.messages.SearchGlobal({
      q: "installed-consumer-smoke",
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: 0,
      maxDate: 0,
      offsetRate: 0,
      offsetPeer: new Api.InputPeerEmpty(),
      offsetId: 0,
      limit: 1,
    }),
    new Api.messages.SendMessage({
      peer: new Api.InputPeerSelf(),
      message: "message-smoke",
      randomId: bigInt.one,
    }),
    new Api.messages.EditMessage({
      peer: new Api.InputPeerSelf(),
      id: 1,
      message: "edit-smoke",
    }),
    new Api.messages.EditInlineBotMessage({
      id: new Api.InputBotInlineMessageID({
        dcId: 1,
        id: bigInt.one,
        accessHash: bigInt.one,
      }),
      message: "inline-edit-smoke",
    }),
  ];

  for (const request of requests) {
    assert(request.getBytes().length > 4);
  }
}

function validateInstalledPackage({
  fixture,
  expectedVersion,
  expectedLayer,
  changedIds,
}) {
  const fixtureRequire = createRequire(path.join(fixture, "package.json"));
  const packageMetadata = fixtureRequire("telegram/package.json");
  const { Api, version } = fixtureRequire("telegram");
  const bigInt = fixtureRequire("big-integer");
  const { LAYER, tlobjects } = fixtureRequire("telegram/tl/AllTLObjects.js");

  fixtureRequire("telegram/sessions/index.js");
  fixtureRequire("telegram/events/index.js");
  fixtureRequire("telegram/Password.js");

  assert.strictEqual(packageMetadata.name, "telegram");
  assert.strictEqual(packageMetadata.version, expectedVersion);
  assert.strictEqual(version, expectedVersion);
  assert.strictEqual(LAYER, expectedLayer);
  validateChangedIds(Api, tlobjects, changedIds);
  validateProtocolSerialization(Api, bigInt);
}

module.exports = {
  getChangedIds,
  validateChangedIds,
  validateInstalledPackage,
  validateProtocolSerialization,
};
