import { afterEach, describe, expect, it } from "vitest";

import type { BrandCode } from "@elmeragroup/fuse/theme";
import type { ResolvedColorScheme } from "@elmeragroup/fuse/theme-catalog";

import "../src/index.css";
import type { RenderHold } from "../src/motion/frame-clock";
import { FontGate, loadFaces, loadVideoFonts } from "../src/primitives/font-gate";
import type { VideoFace } from "../src/primitives/font-gate";
import { SceneTheme } from "../src/primitives/scene-theme";
import { render, unmountTree } from "./frame-harness";

afterEach(unmountTree);

// Unit under test: `index.css`'s heading font. Oracle: the family list Fuse's themes set as
// `--font-sans`, whose first face the video bundles, written out here. Fuse's Fjordkraft themes
// put Neo Sans ahead of it in `--font-heading`, in rules up to five attributes specific.
const BUNDLED_SANS = "Roboto, ui-sans-serif, system-ui, sans-serif";

describe("heading font", () => {
  const scopes: readonly { readonly brand: BrandCode; readonly scheme: ResolvedColorScheme }[] = [
    { brand: "fkas", scheme: "light" },
    { brand: "fkas", scheme: "dark" },
    { brand: "fkab", scheme: "light" },
    { brand: "fkab", scheme: "dark" },
  ];

  it.each(scopes)("draws $brand $scheme headings in the bundled sans", ({ brand, scheme }) => {
    render(
      <div data-theme={scheme}>
        <SceneTheme brand={brand} scheme={scheme}>
          <h2 className="font-heading">Heading</h2>
        </SceneTheme>
      </div>
    );
    const heading = document.querySelector("h2");
    if (heading === null) {
      throw new Error("The heading is not mounted");
    }
    expect(getComputedStyle(heading).fontFamily).toBe(BUNDLED_SANS);
  });
});

// Unit under test: `FontGate` over `loadFaces`. Oracle: `index.css` imports Roboto at 400, 500,
// 600 and 700 and no face of a family named "Not A Face", so the gate opens on the video's own
// faces and cancels the render, naming the family and weight, on a family or weight it lacks.
describe("font gate", () => {
  type Outcome = { readonly opened: boolean; readonly error: Error | undefined };

  /** Renders the gate over a load and resolves once it has opened or cancelled the render. */
  async function gate(load: () => Promise<void>): Promise<Outcome> {
    let cancelled: Error | undefined;
    let settle: () => void = () => undefined;
    const settled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const hold: RenderHold = {
      delayRender: () => 1,
      continueRender: settle,
      cancelRender: (error) => {
        cancelled = error;
        settle();
      },
    };
    render(
      <FontGate hold={hold} load={load}>
        <p>Text</p>
      </FontGate>
    );
    await settled;
    return { opened: document.querySelector("p") !== null, error: cancelled };
  }

  it("opens on the faces index.css loads", async () => {
    const outcome = await gate(loadVideoFonts);
    expect(outcome).toEqual({ opened: true, error: undefined });
  });

  const missing: readonly { readonly name: string; readonly face: VideoFace; readonly named: RegExp }[] = [
    { name: "a family", face: { family: "Not A Face", weights: [400] }, named: /Not A Face at weight 400/ },
    { name: "a weight", face: { family: "Roboto", weights: [300] }, named: /Roboto at weight 300/ },
  ];

  it.each(missing)("cancels the render on $name index.css never loaded", async ({ face, named }) => {
    const outcome = await gate(() => loadFaces([face]));
    expect(outcome.opened).toBe(false);
    expect(outcome.error?.message).toMatch(named);
  });
});
