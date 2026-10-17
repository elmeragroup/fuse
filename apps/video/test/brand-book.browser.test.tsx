import { createRef, useRef } from "react";
import type { ReactElement } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import * as Hex from "@elmeragroup/color/hex";
import { getOrThrow } from "@elmeragroup/color/result";
import { LocaleProvider } from "@elmeragroup/fuse/theme";

import { SpecimenCard } from "../src/brand-book/scenes/anatomy/specimen";
import { SelectTile } from "../src/brand-book/scenes/collage/overlay-tiles";
import { PlateMotionContext } from "../src/brand-book/scenes/collage/plate";
import { roleHex } from "../src/brand/role-value";
import "../src/index.css";
import { beats } from "../src/music/beat-grid";
import { SceneTheme } from "../src/primitives/scene-theme";
import { useStageBox } from "../src/primitives/stage";
import type { StageBox } from "../src/primitives/stage";
import { play, render, unmountTree } from "./frame-harness";

afterEach(unmountTree);

/** An element's computed background as opaque hex, read through the colour package. */
function backgroundHex(element: Element): string {
  return Hex.formatOpaque(
    CssColor.toSrgb(getOrThrow(CssColor.parse(getComputedStyle(element).backgroundColor)))
  );
}

// Unit under test: the anatomy's specimen card, which holds each part in a neutral role until its
// role's beat. Oracle: Fuse's resolved catalog, which states every role's value in the theme
// independently of the DOM; the card's action must paint the muted role before the primary
// role's beat and the theme's primary from that beat on.
describe("the anatomy's specimen", () => {
  const SCOPE = { brand: "elma", scheme: "light" } as const;
  /** The primary role resolves on the scene's beat 10. */
  const PRIMARY_AT = beats(10);

  function Specimen({ frame }: { readonly frame: number }): ReactElement {
    return (
      <LocaleProvider locale="en-US">
        <SceneTheme brand={SCOPE.brand} scheme={SCOPE.scheme}>
          <SpecimenCard
            frame={frame}
            cardRef={createRef()}
            titleRef={createRef()}
            statusRef={createRef()}
            fieldRef={createRef()}
            actionRef={createRef()}
          />
        </SceneTheme>
      </LocaleProvider>
    );
  }

  it("paints the action in the muted role until the primary role's beat, then in the primary", async () => {
    const tree = (frame: number) => <Specimen frame={frame} />;
    const action = page.getByRole("button", { name: "Save reading" });

    await play([PRIMARY_AT - 1], tree);
    await expect.element(action).toBeInTheDocument();
    expect(backgroundHex(action.element())).toBe(roleHex(SCOPE, "muted"));

    await play([PRIMARY_AT], tree);
    expect(backgroundHex(action.element())).toBe(roleHex(SCOPE, "primary"));
  });
});

// Unit under test: `useStageBox`, which the anatomy's selections aim with. Oracle: the layout the
// tree declares in its styles; a scale on the stage and a translate on an ancestor must not move
// the box, because every frame has to read the same layout whatever is animating.
describe("useStageBox", () => {
  const PART = { left: 40, top: 30, width: 120, height: 48 } as const;
  const PANEL = { left: 200, top: 100, border: 2 } as const;

  function Probe({ onBox }: { readonly onBox: (box: StageBox | null) => void }): ReactElement {
    const part = useRef<HTMLDivElement>(null);
    onBox(useStageBox(part));
    return (
      <div
        data-stage=""
        style={{ position: "relative", width: 1280, height: 720, scale: "1.5", transformOrigin: "top left" }}>
        <div
          style={{
            position: "absolute",
            left: PANEL.left,
            top: PANEL.top,
            width: 600,
            height: 400,
            border: `${String(PANEL.border)}px solid black`,
            translate: "37px 11px",
            scale: "0.9",
          }}>
          <div
            ref={part}
            style={{
              position: "absolute",
              left: PART.left,
              top: PART.top,
              width: PART.width,
              height: PART.height,
            }}
          />
        </div>
      </div>
    );
  }

  it("reads a part's box in stage pixels from its layout, ignoring every transform above it", () => {
    let measured: StageBox | null = null;
    render(
      <Probe
        onBox={(box) => {
          measured = box;
        }}
      />
    );
    expect(measured).toEqual({
      x: PANEL.left + PANEL.border + PART.left,
      y: PANEL.top + PANEL.border + PART.top,
      width: PART.width,
      height: PART.height,
    });
  });
});

// Unit under test: the collage's overlay policy, through the Select plate's own tile. Oracle: a
// render that begins on a frame after the popup has closed, which never opened it and so never
// moved focus. Playing the popup open and shut must leave focus where that fresh render finds it,
// with no focus ring on the trigger, or every later frame of a render would depend on its history.
describe("an overlay on a collage plate", () => {
  const FPS = 30;
  const WINDOW = { openAt: 10, closeAt: 40 } as const;
  const AFTER_CLOSE = WINDOW.closeAt + 3;

  function Plate({ frame }: { readonly frame: number }): ReactElement {
    return (
      <LocaleProvider locale="en-US">
        <SceneTheme brand="fkab" scheme="light" className="relative h-80 w-90 p-5">
          <PlateMotionContext value={{ clock: { frame, fps: FPS }, window: WINDOW }}>
            <SelectTile />
          </PlateMotionContext>
        </SceneTheme>
      </LocaleProvider>
    );
  }

  /** What holds focus: a Fuse part's slot, or the element's tag outside any part. */
  function focused(): string {
    const element = document.activeElement;
    return element?.getAttribute("data-slot") ?? element?.tagName ?? "none";
  }

  it("opens on its window's first frame and is gone after its last", async () => {
    const tree = (frame: number) => <Plate frame={frame} />;
    await play([WINDOW.openAt - 1], tree);
    expect(document.querySelector('[data-slot="select-content"]')).toBeNull();
    await play([WINDOW.openAt, WINDOW.openAt + 20], tree);
    expect(document.querySelector('[data-slot="select-content"]')).not.toBeNull();
    await play([WINDOW.closeAt, AFTER_CLOSE], tree);
    expect(document.querySelector('[data-slot="select-content"]')).toBeNull();
  });

  it("leaves focus where a fresh render of the frame finds it once the popup has closed", async () => {
    const tree = (frame: number) => <Plate frame={frame} />;
    await play([0, WINDOW.openAt, WINDOW.openAt + 20, WINDOW.closeAt - 1, WINDOW.closeAt, AFTER_CLOSE], tree);
    const played = focused();
    const ringed = document.querySelector('[data-slot="select-trigger"]:focus-visible');
    unmountTree();

    await play([AFTER_CLOSE], tree);
    expect(played).toBe(focused());
    expect(ringed).toBeNull();
  });
});
