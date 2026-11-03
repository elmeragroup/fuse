/**
 * Whether the comparison page reaches a forced Link hover. Unit under test: `CompareBrowser`'s
 * check that a forced state changed the cell, which reads a style signature off the forced cell
 * and its resting twin in Chromium. Oracle: `link-variants.ts`, whose `always` underline changes
 * only `text-decoration-color` under `enabled-hover:`, from its text color at 35% in the light
 * preview to `currentcolor`, so forcing `:hover` must read as `forced` and never as `missing`.
 *
 * It launches Playwright's Chromium and reads the Fuse build, so it runs in the `chromium` project,
 * which `test:browser` runs after the Fuse build.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec";
import { LINK } from "../components/link-kit";
import { CompareBrowser } from "./browser-render";
import { loadRenderers } from "./cell-renderers";
import { locateFuseBuild, readPageAssets } from "./page-assets";
import { PAGE_LAYOUT } from "./preview-page";
import { parsePreviewTheme } from "./preview-theme";
import { planCells, renderables } from "./run-compare";

const THEME = parsePreviewTheme(
  Object.entries({
    "Fuse tokens": "Light",
    "Fuse variant": "Internal",
    "Fuse segment": "Private",
    "Fuse brand": "Fjordkraft",
    "Fuse density": "Dense",
  }).map(([collection, mode]) => ({ collection, mode }))
);

/** The state the page reaches for an always Link's hover cell, rendered alone. */
const alwaysHoverState = Effect.gen(function* () {
  if (Result.isFailure(THEME)) {
    return yield* Effect.die(THEME.failure);
  }
  const build = yield* locateFuseBuild();
  const renderers = yield* loadRenderers(new Set([LINK.key]));
  if (!renderers.has(LINK.key)) {
    return yield* Effect.die(new Error("no Link renderer"));
  }
  const variant = variantKey(LINK, { variant: "default", underline: "always", state: "hover" });
  const { planned } = planCells(
    [{ key: `preview/${variant}`, variant, box: { x: 0, y: 0, width: 0, height: 0 }, image: null }],
    renderables(renderers),
    new Set(),
    PAGE_LAYOUT
  );
  const [cell] = planned;
  if (cell === undefined) {
    return yield* Effect.die(new Error(`the comparison cannot render ${variant}`));
  }
  const browser = yield* CompareBrowser.launch(yield* readPageAssets(build, renderers));
  const rendered = yield* browser.renderPreview(THEME.success, [cell.request], PAGE_LAYOUT);
  return rendered.cells.get(cell.request.id)?.state;
});

describe("the comparison page's forced states", () => {
  it("reaches the hover of an always link, whose underline only changes color", async () => {
    const state = await Effect.runPromise(
      alwaysHoverState.pipe(Effect.scoped, Effect.provide(NodeServices.layer))
    );
    expect(state).toBe("forced");
  });
});
