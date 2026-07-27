"use strict";
const fs = require("fs");
const path = require("path");
require("./types-generator/generate");
function main() {
    const apiTl = fs.readFileSync(path.resolve(__dirname, `./static/api.tl`), "utf-8");
    fs.writeFileSync(path.resolve(__dirname, "./apiTl.js"), `module.exports = \`${stripTl(apiTl)}\`;`);
    const schemaTl = fs.readFileSync(path.resolve(__dirname, `./static/schema.tl`), "utf-8");
    fs.writeFileSync(path.resolve(__dirname, "./schemaTl.js"), `module.exports = \`${stripTl(schemaTl)}\`;`);
    const layerMatches = [...apiTl.matchAll(/^\/\/ LAYER (\d+)\s*$/gm)];
    if (layerMatches.length !== 1) {
        throw new Error(`Expected exactly one layer marker, found ${layerMatches.length}`);
    }
    const layer = Number(layerMatches[0][1]);
    const allTlObjectsPath = path.resolve(__dirname, "./AllTLObjects.ts");
    const allTlObjects = fs.readFileSync(allTlObjectsPath, "utf8");
    const updatedAllTlObjects = allTlObjects.replace(/^export const LAYER = \d+;$/m, `export const LAYER = ${layer};`);
    if (updatedAllTlObjects === allTlObjects &&
        !allTlObjects.includes(`export const LAYER = ${layer};`)) {
        throw new Error("Unable to update the runtime layer constant");
    }
    fs.writeFileSync(allTlObjectsPath, updatedAllTlObjects);
}
function stripTl(tl) {
    return tl
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/\n\s*\n/g, "\n")
        .replace(/`/g, "\\`");
}
main();
