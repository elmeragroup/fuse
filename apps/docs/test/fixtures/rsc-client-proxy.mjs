/**
 * React Flight's client-module proxy, the same object Next installs for a `"use client"`
 * module. Property access one level deep is a client reference; a second dot throws
 * "Cannot access X.Y on the server".
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClientModuleProxy } = require("next/dist/compiled/react-server-dom-webpack/server.node.js");

export { createClientModuleProxy };
