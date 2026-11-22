/**
 * `figma:capture`: capture the kit's capture-backed sets and the text style samples in Chromium, and
 * write each capture to `captures/<key>.json`. With `--check`, the run writes nothing and fails
 * where a fresh capture differs from the kept file.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:capture [<key>…] [--check] [--repeat <n>] [--shard <k>/<n>]
 *
 * With no key named, the run captures every set whose kit entry is switched to the capture, then the
 * text style samples, whose key is `text-styles`. `--repeat` takes each capture n times and fails
 * unless every run writes the same bytes. `--shard <k>/<n>` keeps every n-th of those targets,
 * starting at the k-th (`src/capture/capture-shard.ts`), so CI's figma-capture legs split the check.
 * Any value the flag is given, an empty one included, must be `<k>/<n>`. Omitting `--shard` keeps
 * all selected targets.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Runtime } from "effect";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { formatCapture } from "../src/capture/capture-format.ts";
import { parseCaptureShard, shardItems } from "../src/capture/capture-shard.ts";
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
    options: {
      check: { type: "boolean", default: false },
      repeat: { type: "string", default: "1" },
      shard: { type: "string" },
    },
  });
  const repeat = Number(values.repeat);
  const named = captureTargets(positionals.length === 0 ? undefined : new Set(positionals));
  const targets =
    values.shard === undefined
      ? named
      : shardItems(named, yield* Effect.fromResult(parseCaptureShard(values.shard)));
  if (values.shard !== undefined) {
    yield* Console.log(
      `shard ${values.shard}: ${String(targets.length)} of ${String(named.length)} captures`
    );
  }
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
