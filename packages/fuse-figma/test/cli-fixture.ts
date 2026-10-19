/**
 * The command line wired to an in-memory Figma file, shared by the CLI tests. It runs `runCli`
 * with a test terminal, console and config, and reads results back the way a designer's frame
 * sees them.
 */

import { ConfigProvider, Effect, FileSystem, Layer, Path, Stdio, Terminal } from "effect";
import { CliOutput } from "effect/cli";
import { ChildProcessSpawner } from "effect/process";
import { TestConsole } from "effect/testing";

import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";

import { runCli } from "../src/cli.ts";
import type { InMemoryFigma } from "./in-memory-figma.ts";

/** The key of the fake file. */
export const FILE_KEY = "FuseFile123";

/** The personal access token the fake file accepts. */
export const TOKEN = "figd_test-token";

const cliEnvironment = Layer.mergeAll(
  FileSystem.layerNoop({}),
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(100),
      rows: Effect.succeed(40),
      readInput: Effect.die("the CLI never reads input"),
      readLine: Effect.die("the CLI never reads input"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("the CLI never spawns processes"))
  ),
  CliOutput.layer(CliOutput.defaultFormatter({ colors: false }))
);

function environment(figma: InMemoryFigma, env: Record<string, string> = { FIGMA_TOKEN: TOKEN }) {
  return Layer.mergeAll(cliEnvironment, figma.layer(), ConfigProvider.layer(ConfigProvider.fromEnv({ env })));
}

/** One run of the command line. */
type CliRun = ReturnType<typeof runCli>;

/** Run the command line with `argv` against the fake file, with `FIGMA_TOKEN` set unless `env` replaces it. */
export function run(
  figma: InMemoryFigma,
  argv: readonly string[],
  env?: Record<string, string>
): Effect.Effect<Effect.Success<CliRun>, Effect.Error<CliRun>> {
  return runCli(argv).pipe(Effect.provide(environment(figma, env)));
}

/** Everything the run logged to stdout, one line per log. */
export const output = Effect.map(TestConsole.logLines, (lines) => lines.map(String).join("\n"));
/** Everything the run logged to stderr, one line per log. */
export const errors = Effect.map(TestConsole.errorLines, (lines) => lines.map(String).join("\n"));

/** The POST requests the fake file received. */
export function writes(figma: InMemoryFigma): number {
  return figma.requests.filter((request) => request.method === "POST").length;
}

/** The GET requests the fake file received. */
export function reads(figma: InMemoryFigma): number {
  return figma.requests.filter((request) => request.method === "GET").length;
}

/** A resolved color as `#RRGGBB`. */
export function hex(value: ReturnType<InMemoryFigma["resolve"]>): string {
  if (!(value instanceof Object)) throw new Error(`expected a color, got ${String(value)}`);
  return Hex.formatOpaque(getOrThrow(Srgb.make({ r: value.r, g: value.g, b: value.b, alpha: value.a })));
}

/** The brand modes by brand code, as designers read them in the Appearance panel. */
export const BRAND_MODES = new Map([
  ["fkas", "Fjordkraft"],
  ["tkas", "TrøndelagKraft"],
  ["guen", "Gudbrandsdal Energi"],
  ["fkab", "Fjordkraft Företag (company only)"],
  ["fkse", "Telinet (private only)"],
  ["elma", "Elmera"],
  ["ngfi", "Nordic Green Energy"],
]);

const VARIANT_MODES = new Map([
  ["internal", "Internal"],
  ["external", "External"],
]);

const SEGMENT_MODES = new Map([
  ["private", "Private"],
  ["company", "Company"],
]);

/**
 * The modes a designer sets on a frame to preview a theme slug, such as
 * `external-fkas-private`, in one color scheme.
 */
export function frame(scheme: "Light" | "Dark", slug: string) {
  const [variant = "", brand = "", segment = ""] = slug.split("-");
  const mode = (modes: ReadonlyMap<string, string>, code: string): string => {
    const found = modes.get(code);
    if (found === undefined) throw new Error(`${slug} names no mode for ${code}`);
    return found;
  };
  return {
    "Fuse tokens": scheme,
    "Fuse variant": mode(VARIANT_MODES, variant),
    "Fuse segment": mode(SEGMENT_MODES, segment),
    "Fuse brand": mode(BRAND_MODES, brand),
  };
}

/** The modes of a light frame previewing a theme slug. */
export const light = (slug: string) => frame("Light", slug);
/** The modes of a dark frame previewing a theme slug. */
export const dark = (slug: string) => frame("Dark", slug);
