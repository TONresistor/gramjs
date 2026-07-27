"use strict";

const packageMetadata = require("../package.json");

const tag = process.env.RELEASE_TAG || process.argv[2];
const expected = `v${packageMetadata.version}`;

if (!tag) {
  throw new Error("Release tag is required through RELEASE_TAG or argv");
}
if (tag !== expected) {
  throw new Error(`Release tag mismatch: expected ${expected}, got ${tag}`);
}

console.log(`Verified release tag ${tag}`);
