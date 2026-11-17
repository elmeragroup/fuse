/**
 * `figma:probe`: run the perturbation probe over the kit's capture-backed sets. Each set's cells
 * render as `figma:capture` renders them; the probe widens each root's container and lengthens its
 * text, infers each box's horizontal sizing, and fails where the capture build maps a kind that
 * contradicts it, or where an anchored composite's measured gap differs from its `sideOffset`.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:probe [<set>…]
 *
 * The measured boxes stay in this run: the probe prints what it compared and keeps nothing.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, FileSystem, Runtime } from "effect";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { captureTargets } from "../src/capture/capture-targets.ts";
import type { InstanceManifest, PartManifest } from "../src/capture/manifest.ts";
import { classifiesProbe, decodeOracle } from "../src/capture/oracle.ts";
import { contradictions, probeCells } from "../src/capture/perturbation.ts";
import type { ProbedCell } from "../src/capture/perturbation.ts";
import { CAPTURE_THEME, requestOf } from "../src/capture/run-capture.ts";
import { CompareBrowser } from "../src/compare/browser-render.ts";
import { loadRenderers } from "../src/compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";
import { PAGE_LAYOUT } from "../src/compare/preview-page.ts";
import { buildComponentSets, densityLengths } from "../src/components/build-kit.ts";
import { matrixCells, variantKey } from "../src/components/component-spec.ts";

const ORACLES = fileURLToPath(new URL("../oracles/", import.meta.url));

/** The run stopped, and what it printed says why. */
class ProbeStopped extends Data.TaggedError("ProbeStopped") {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = 1;
}

/** The key of the part each `data-slot` names in a manifest, where one part has it, at any depth. */
function keysBySlot(parts: readonly (PartManifest | InstanceManifest)[]): ReadonlyMap<string, string> {
  const found = new Map<string, string[]>();
  const visit = (part: PartManifest | InstanceManifest): void => {
    const slot = "kind" in part ? (part.slot ?? part.of.slot) : part.slot;
    if (slot !== undefined) {
      found.set(slot, [...(found.get(slot) ?? []), part.key]);
    }
    if (!("kind" in part)) {
      (part.parts ?? []).forEach(visit);
    }
  };
  parts.forEach(visit);
  return new Map(
    [...found].flatMap(([slot, keys]) =>
      keys.length === 1 && keys[0] !== undefined ? [[slot, keys[0]] as const] : []
    )
  );
}

/** A set's oracle file, or no entry where it has none. */
const oracleOf = Effect.fn("probe.oracleOf")(function* (key: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = join(ORACLES, `${key}.json`);
  if (!(yield* fs.exists(path))) {
    return { set: key, entries: [] };
  }
  return yield* Effect.fromResult(decodeOracle(JSON.parse(yield* fs.readFileString(path))));
});

/** How many cells share a page. */
const CELLS_PER_PAGE = 60;

/** How far, in CSS pixels, a measured gap may sit from the `sideOffset`, for subpixel layout. */
const GAP_TOLERANCE = 0.5;

const main = Effect.fn("probe.main")(function* () {
  const { positionals } = parseArgs({ allowPositionals: true });
  const targets = captureTargets(positionals.length === 0 ? undefined : new Set(positionals));
  const build = yield* locateFuseBuild();
  const renderers = yield* loadRenderers(new Set(targets.map((target) => target.key)));
  const browser = yield* CompareBrowser.launch(yield* readPageAssets(build, renderers));
  const sets = new Map((yield* buildComponentSets()).map((set) => [set.componentSet.key, set.componentSet]));
  // The probe's page renders at the capture's density, so a bound length draws that mode's value.
  const lengthOf = yield* Effect.fromResult(densityLengths(CAPTURE_THEME.density));
  let failed = false;
  let compared = 0;
  const kinds = new Map<string, number>();
  for (const target of targets) {
    const renderer = renderers.get(target.key);
    const set = sets.get(target.key);
    if (renderer === undefined || set === undefined) {
      yield* Console.error(`${target.key}: no renderer or no built set`);
      failed = true;
      continue;
    }
    const cells = matrixCells(target.axes).map((cell, index) => ({
      key: variantKey(target, cell),
      request: requestOf(target, renderer, cell, index),
    }));
    const probed = new Map<string, ProbedCell>();
    for (let from = 0; from < cells.length; from += CELLS_PER_PAGE) {
      const chunk = cells.slice(from, from + CELLS_PER_PAGE);
      const read = yield* browser.openPreview(
        CAPTURE_THEME,
        chunk.map(({ request }) => request),
        PAGE_LAYOUT,
        (opened) =>
          probeCells(
            opened.page,
            chunk.map(({ request }) => ({ id: request.id, measured: request.measured }))
          )
      );
      for (const [at, cell] of read.entries()) {
        const key = chunk[at]?.key;
        if (key !== undefined) {
          probed.set(key, cell);
        }
      }
    }
    const {
      found: all,
      compared: here,
      inferred,
    } = contradictions(set, probed, keysBySlot(target.parts ?? []), lengthOf);
    for (const [kind, count] of inferred) {
      kinds.set(kind, (kinds.get(kind) ?? 0) + count);
    }
    const oracle = yield* oracleOf(target.key);
    const found = all.filter((each) => !classifiesProbe(oracle, each));
    compared += here;
    for (const each of found) {
      yield* Console.error(
        `${each.cell} ${each.slot}: the probe infers ${each.inferred}, and the spec maps ${each.mapped}`
      );
    }
    failed ||= found.length > 0;
    if (target.sideOffset !== undefined) {
      for (const [key, cell] of probed) {
        if (cell.gap === undefined || Math.abs(cell.gap - target.sideOffset) > GAP_TOLERANCE) {
          yield* Console.error(
            `${key}: the popup sits ${String(cell.gap)}px from its anchor, and the manifest's sideOffset is ${String(target.sideOffset)}px`
          );
          failed = true;
        }
      }
    }
    yield* Console.log(
      `${target.key}: ${String(here)} boxes compared, ${String(all.length - found.length)} classified and ${String(found.length)} unclassified contradictions`
    );
  }
  yield* Console.log(
    `${String(compared)} boxes compared in ${String(targets.length)} sets, inferred: ${[...kinds]
      .map(([kind, count]) => `${kind} ${String(count)}`)
      .join(", ")}`
  );
  if (failed) {
    return yield* new ProbeStopped();
  }
});

main().pipe(Effect.scoped, Effect.provide(NodeServices.layer), NodeRuntime.runMain);
