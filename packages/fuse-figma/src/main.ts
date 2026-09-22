/**
 * The entry point. It wires the Node runtime and HTTP client to the command line, and
 * importing it runs the CLI.
 */

import { NodeHttpClient, NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";

import { runCli } from "./cli.ts";

runCli(process.argv.slice(2)).pipe(
  Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerUndici)),
  NodeRuntime.runMain
);
