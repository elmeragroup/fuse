/**
 * React Flight's client-module proxy, the same object Next installs for a `"use client"`
 * module. Property access one level deep is a client reference; a second dot throws
 * "Cannot access X.Y on the server".
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type ClientModuleProxy = {
  readonly [name: string]: ClientModuleProxy;
};

type FlightClientProxy = {
  createClientModuleProxy: (id: string) => ClientModuleProxy;
};

function loadFlightClientProxy(): FlightClientProxy {
  // SAFETY: Next ships this Flight server as untyped compiled CJS. The fixture only calls createClientModuleProxy.
  return require("next/dist/compiled/react-server-dom-webpack/server.node.js") as FlightClientProxy;
}

export const { createClientModuleProxy } = loadFlightClientProxy();
