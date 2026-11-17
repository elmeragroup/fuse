/**
 * `figma:capture`: capture the kit's capture-backed sets in Chromium and write each set's capture
 * to `captures/<set>.json`, or, with `--check`, fail where a fresh capture differs from the file.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:capture [<set>…] [--check] [--repeat <n>]
 *
 * With no set named, the run captures every set whose kit entry is switched to the capture.
 * `--repeat` captures each set n times and fails unless every run writes the same bytes.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Runtime } from "effect";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { formatCapture } from "../src/capture/capture-format.ts";
import { captureTargets } from "../src/capture/capture-targets.ts";
import { captureSet } from "../src/capture/run-capture.ts";
import { CompareBrowser } from "../src/compare/browser-render.ts";
import { loadRenderers } from "../src/compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";

const CAPTURES = fileURLToPath(new URL("../captures/", import.meta.url));

/** The run stopped, and what it printed says why. */
class CaptureStopped extends Data.TaggedError("CaptureStopped") {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = 1;
}

const main = Effect.fn("capture.main")(function* () {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { check: { type: "boolean", default: false }, repeat: { type: "string", default: "1" } },
  });
  const repeat = Number(values.repeat);
  const targets = captureTargets(positionals.length === 0 ? undefined : new Set(positionals));
  const fs = yield* FileSystem.FileSystem;
  const build = yield* locateFuseBuild();
  const renderers = yield* loadRenderers(new Set(targets.map((target) => target.key)));
  const assets = yield* readPageAssets(build, renderers);
  const browser = yield* CompareBrowser.launch(assets);
  let failed = false;
  for (const target of targets) {
    const renderer = renderers.get(target.key);
    if (renderer === undefined) {
      yield* Console.error(`${target.key}: no renderer`);
      failed = true;
      continue;
    }
    const texts: string[] = [];
    for (let run = 0; run < repeat; run += 1) {
      const started = performance.now();
      texts.push(formatCapture(yield* captureSet(browser, target, renderer)));
      yield* Console.log(`${target.key}: captured in ${(performance.now() - started).toFixed(0)} ms`);
    }
    const [first = "", ...others] = texts;
    if (others.some((text) => text !== first)) {
      yield* Console.error(`${target.key}: ${String(repeat)} captures differ`);
      failed = true;
    }
    const path = join(CAPTURES, `${target.key}.json`);
    if (values.check) {
      const committed = yield* fs.readFileString(path).pipe(Effect.orElseSucceed(() => ""));
      if (committed !== first) {
        yield* Console.error(`${target.key}: the capture differs from ${path}`);
        failed = true;
      }
    } else {
      yield* fs.makeDirectory(CAPTURES, { recursive: true });
      yield* fs.writeFileString(path, first);
    }
  }
  if (failed) {
    return yield* new CaptureStopped();
  }
});

main().pipe(Effect.scoped, Effect.provide(NodeServices.layer), NodeRuntime.runMain);
