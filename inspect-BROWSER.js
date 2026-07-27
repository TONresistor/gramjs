"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspect = void 0;
const custom = Symbol.for("nodejs.util.inspect.custom");
exports.inspect = {
    custom,
};
