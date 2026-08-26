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
  getDisplayName,
  getInputChannel,
  getInputPeer,
  getPeerId,
} = require("../Utils");
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

const community = new Api.Community({
  id: bigInt(42),
  accessHash: bigInt(99),
  title: "Community",
  photo: new Api.ChatPhotoEmpty(),
  date: 0,
});
assert.ok(getInputPeer(community) instanceof Api.InputPeerChannel);
assert.ok(getInputChannel(community) instanceof Api.InputChannel);
assert.strictEqual(getPeerId(community), "-10042");
assert.strictEqual(getDisplayName(community), "Community");

const richMessage = new Api.RichMessage({
  part: true,
  blocks: [
    new Api.PageBlockParagraph({
      text: new Api.TextPlain({ text: "Rich content" }),
    }),
  ],
  photos: [],
  documents: [],
});
const message = new Api.Message({
  id: 1,
  peerId: new Api.PeerUser({ userId: bigInt(1) }),
  date: 0,
  message: "",
  richMessage,
});
assert.strictEqual(message.richMessage, richMessage);
assert.strictEqual(message.richMessage.part, true);

console.log(
  `Root package smoke passed for version ${version} / Layer ${LAYER}`
);
