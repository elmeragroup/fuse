/**
 * The `pnpm shots` entry point. It wires the Node runtime to the command line, and importing it
 * runs the CLI. On Ctrl-C the runtime interrupts the run, so the local server and the browsers
 * close through their finalizers.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";

import { runCli } from "./cli.ts";

runCli(process.argv.slice(2)).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
