#!/usr/bin/env node
/**
 * The `fuse-deck` executable. It wires the Node runtime to the command line, and importing it runs
 * the CLI. Logs go to stderr, so stdout carries only results.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as References from "effect/References";

import { runCli } from "./cli/cli.ts";

runCli(process.argv.slice(2)).pipe(
  Effect.provideService(References.LogToStderr, true),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
);
