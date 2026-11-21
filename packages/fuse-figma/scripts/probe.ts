/**
 * `figma:probe`: run the perturbation probe over the kit's capture-backed sets. Each set's cells
 * render as `figma:capture` renders them; the probe widens each root's container and lengthens its
 * text, infers each box's horizontal sizing, and fails where the capture build maps a kind that
 * contradicts it, where a part the build drew has no box at its place, a box of another `data-slot`
 * or no layer at its recorded path, or where an anchored composite's measured gap differs from its
 * `sideOffset`. A nested popup's gap runs from the row it opens beside.
 *
 *     pnpm --filter @elmeragroup/fuse-figma figma:probe [<set>…]
 *
 * The measured boxes stay in this run: the probe prints what it compared and keeps nothing.
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Data, Effect, Runtime } from "effect";
import { parseArgs } from "node:util";

import { setTargets } from "../src/capture/capture-targets.ts";
import { probeCells } from "../src/capture/perturbation.ts";
import type { ProbedCell } from "../src/capture/perturbation.ts";
import { contradictions, sizingReadsOf } from "../src/capture/probe-sizing.ts";
import { CAPTURE_THEME, requestOf } from "../src/capture/run-capture.ts";
import { CompareBrowser } from "../src/compare/browser-render.ts";
import { loadRenderers } from "../src/compare/cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "../src/compare/page-assets.ts";
import { PAGE_LAYOUT } from "../src/compare/preview-page.ts";
import { buildComponentSets, densityLengths } from "../src/components/build-kit.ts";
import { possibleCells, variantKey } from "../src/components/component-spec.ts";

/** The run stopped, and what it printed says why. */
class ProbeStopped extends Data.TaggedError("ProbeStopped") {
  override readonly [Runtime.errorReported] = false;
  override readonly [Runtime.errorExitCode] = 1;
}

/** How many cells share a page. */
const CELLS_PER_PAGE = 60;

/** How far, in CSS pixels, a measured gap may sit from the `sideOffset`, for subpixel layout. */
const GAP_TOLERANCE = 0.5;

const main = Effect.fn("probe.main")(function* () {
  const { positionals } = parseArgs({ allowPositionals: true });
  const targets = setTargets(positionals.length === 0 ? undefined : new Set(positionals));
  const build = yield* locateFuseBuild();
  const renderers = yield* loadRenderers(new Set(targets.map((target) => target.key)));
  const browser = yield* CompareBrowser.launch(yield* readPageAssets(build, renderers));
  const built = yield* buildComponentSets();
  const sets = new Map(built.map((set) => [set.componentSet.key, set.componentSet]));
  // Each cell's drawn parts, by the set's key and then the cell's, as the build recorded them.
  const drawnIn = new Map(
    built.map((set) => [
      set.componentSet.key,
      new Map([...set.accounting].map(([cell, { parts }]) => [cell, parts])),
    ])
  );
  // The probe's page renders at the capture's density, so a bound length draws that mode's value.
  const reads = sizingReadsOf(
    [...sets.values()],
    yield* Effect.fromResult(densityLengths(CAPTURE_THEME.density))
  );
  let failed = false;
  let compared = 0;
  const kinds = new Map<string, number>();
  for (const target of targets) {
    const renderer = renderers.get(target.key);
    const set = sets.get(target.key);
    const drawn = drawnIn.get(target.key);
    if (renderer === undefined || set === undefined || drawn === undefined) {
      yield* Console.error(`${target.key}: no renderer or no built set`);
      failed = true;
      continue;
    }
    const cells = possibleCells(target).map((cell, index) => ({
      key: variantKey(target, cell),
      request: requestOf(target, renderer, cell, index),
    }));
    const probed = new Map<string, ProbedCell>();
    // A nested popup's gap runs from the row it opens beside.
    const anchor = target.anchor === undefined ? undefined : `[data-slot="${target.anchor.slot}"]`;
    for (let from = 0; from < cells.length; from += CELLS_PER_PAGE) {
      const chunk = cells.slice(from, from + CELLS_PER_PAGE);
      const read = yield* browser.openPreview(
        CAPTURE_THEME,
        chunk.map(({ request }) => request),
        PAGE_LAYOUT,
        (opened) =>
          probeCells(
            opened.page,
            chunk.map(({ request }) => {
              const cell = { id: request.id, measured: request.measured };
              return anchor === undefined ? cell : { ...cell, anchor };
            })
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
      found,
      compared: here,
      inferred,
      unpaired,
      unrecorded,
      unbuilt,
    } = contradictions(set, probed, drawn, reads);
    for (const [kind, count] of inferred) {
      kinds.set(kind, (kinds.get(kind) ?? 0) + count);
    }
    compared += here;
    for (const each of found) {
      yield* Console.error(
        each.widths === undefined
          ? `${each.cell} ${each.slot}: the probe infers ${each.inferred} for the part ${each.part} at ${each.place}, and the spec maps ${each.mapped}`
          : `${each.cell} ${each.slot}: the icon ${each.part} at ${each.place} ${each.widths.drawn === undefined ? "draws at a size the probe could not resolve" : `draws at ${String(each.widths.drawn)}px`}, and the probe measured ${String(each.widths.measured)}px in its ${each.widths.run} run`
      );
    }
    for (const each of unpaired) {
      yield* Console.error(
        `${each.cell} ${each.slot ?? "(no data-slot)"}: the probe cannot pair the part ${each.part} at ${each.place}, since ${each.why}`
      );
    }
    for (const cell of unrecorded) {
      yield* Console.error(`${cell}: the build recorded no parts for a cell the probe measured`);
    }
    for (const cell of unbuilt) {
      yield* Console.error(`${cell}: the build has no variant for a cell the probe measured`);
    }
    failed ||= found.length > 0 || unpaired.length > 0 || unrecorded.length > 0 || unbuilt.length > 0;
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
      `${target.key}: ${String(here)} boxes compared, ${String(found.length)} contradictions, ${String(unpaired.length)} unpaired`
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
