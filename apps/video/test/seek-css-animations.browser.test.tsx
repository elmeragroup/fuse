import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { Button } from "@elmeragroup/fuse/button";
import { Popover } from "@elmeragroup/fuse/popover";
import { Sheet } from "@elmeragroup/fuse/sheet";
import { LocaleProvider, ThemeScope } from "@elmeragroup/fuse/theme";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { CLICK } from "../src/fuse-release/scenes/montage/montage-shot";
import { PriceAreaSelect } from "../src/fuse-release/scenes/montage/select-shot";
import { NewOrderSheet } from "../src/fuse-release/scenes/montage/sheet-shot";
import "../src/index.css";
import type { RenderHold } from "../src/motion/frame-clock";
import { FrameToast } from "../src/motion/frame-toast";
import { MOTION_ELAPSED_ATTRIBUTE, settleAnimations } from "../src/motion/seek-css-animations";
import { ReadyFrame } from "../src/primitives/scene-frame";
import { play, render, unmountTree } from "./frame-harness";

// Oracle for every case: the motion Fuse declares for these parts, read off their classes rather
// than computed by the helpers under test. Anchored popups fade and zoom in from transparent over
// the overlay timing rung, `duration-100`. The Sheet slides in from fully off its edge
// (`data-starting-style:[transform:translateX(100%)]`) over `duration-200`. Tailwind's
// `animate-spin` turns once a second.
const POPUP_MS = 100;
const SHEET_MS = 200;
const SPIN_MS = 1000;

/** The longest any Fuse open or close runs; past it every motion has ended. */
const SETTLED_MS = 5000;

const FPS = 30;
/** The montage shots open their part on the cursor's click. */
const OPEN_AT = CLICK;

/** A frame two frames into the Sheet's 200 ms slide, when it is still entering. */
const ENTERING = OPEN_AT + 2;

/** A frame past every motion, when the Sheet is at rest. */
const AT_REST = OPEN_AT + 12;

afterEach(unmountTree);

/** A themed stage in a brand, with Fuse's locale, as a scene renders. */
function Scope({
  brand,
  children,
}: {
  readonly brand: Exclude<BrandCode, "fkab">;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <LocaleProvider locale="en-US">
      <ThemeScope
        theme={{ variant: "external", brand, segment: "private" }}
        className="relative h-150 w-250 bg-background p-10">
        {children}
      </ThemeScope>
    </LocaleProvider>
  );
}

function sheetBox(): DOMRect {
  const popup = document.querySelector('[data-slot="sheet-content"]');
  if (popup === null) {
    throw new Error("The sheet is not mounted");
  }
  return popup.getBoundingClientRect();
}

describe("settleAnimations", () => {
  /** The host every overlay in these cases portals into, carrying the frame's elapsed time. */
  function host(): HTMLElement {
    const element = document.getElementById("motion-host");
    if (element === null) {
      throw new Error("The test tree has no motion host");
    }
    return element;
  }

  /** Sets the host's elapsed time, as an overlay does on a frame, and seeks. */
  async function seekTo(elapsedMs: number): Promise<void> {
    host().setAttribute(MOTION_ELAPSED_ATTRIBUTE, String(elapsedMs));
    await settleAnimations(0);
  }

  function Frame({
    open,
    part,
  }: {
    readonly open: boolean;
    readonly part: "popover" | "sheet";
  }): ReactElement {
    const target = { current: document.getElementById("motion-host") };
    return (
      <Scope brand="fkas">
        {part === "popover" ? (
          <Popover.Root open={open}>
            <Popover.Trigger render={<Button />}>Reading</Popover.Trigger>
            <Popover.Content container={target}>
              <Popover.Title>Meter reading</Popover.Title>
            </Popover.Content>
          </Popover.Root>
        ) : (
          <Sheet.Root open={open}>
            <Sheet.Content container={target} initialFocus={false}>
              <Sheet.Header>
                <Sheet.Title>New order</Sheet.Title>
              </Sheet.Header>
            </Sheet.Content>
          </Sheet.Root>
        )}
        <div id="motion-host" {...{ [MOTION_ELAPSED_ATTRIBUTE]: 0 }} />
      </Scope>
    );
  }

  function popupOpacity(): number {
    const popup = document.querySelector('[data-slot="popover-content"]');
    if (popup === null) {
      throw new Error("The popover is not mounted");
    }
    return Number(getComputedStyle(popup).opacity);
  }

  it("seeks a popover's opening to the frame's time", async () => {
    render(<Frame open={false} part="popover" />);
    render(<Frame open part="popover" />);
    await expect.element(page.getByRole("dialog", { name: "Meter reading" })).toBeInTheDocument();

    await seekTo(0);
    expect(popupOpacity()).toBe(0);

    await seekTo(POPUP_MS / 2);
    expect(popupOpacity()).toBeGreaterThan(0);
    expect(popupOpacity()).toBeLessThan(1);

    await seekTo(POPUP_MS);
    expect(popupOpacity()).toBe(1);
  });

  it("holds a closing popover at its start and unmounts it once the close has run", async () => {
    render(<Frame open={false} part="popover" />);
    render(<Frame open part="popover" />);
    await seekTo(SETTLED_MS);

    render(<Frame open={false} part="popover" />);
    await seekTo(0);
    expect(popupOpacity()).toBe(1);

    await seekTo(POPUP_MS / 2);
    expect(popupOpacity()).toBeGreaterThan(0);
    expect(popupOpacity()).toBeLessThan(1);

    await seekTo(SETTLED_MS);
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });

  it("seeks a sheet's slide from off its edge to in place", async () => {
    render(<Frame open={false} part="sheet" />);
    render(<Frame open part="sheet" />);
    await expect.element(page.getByRole("dialog", { name: "New order" })).toBeInTheDocument();
    const edge = document.documentElement.clientWidth;

    await seekTo(0);
    expect(Math.round(sheetBox().left)).toBeGreaterThanOrEqual(edge);

    await seekTo(SHEET_MS / 2);
    expect(sheetBox().left).toBeLessThan(edge);
    expect(Math.round(sheetBox().right)).toBeGreaterThan(edge);

    await seekTo(SHEET_MS);
    expect(Math.round(sheetBox().right)).toBe(edge);
  });

  it("puts an animation outside any host on the composition clock", async () => {
    render(<div data-testid="spinner" className="animate-spin bg-black size-10" />);
    const spinner = page.getByTestId("spinner").element();

    await settleAnimations(SPIN_MS / 4);
    const quarter = new DOMMatrix(getComputedStyle(spinner).transform);
    // A quarter turn maps the x axis onto the y axis: rotate(90deg) is matrix(0, 1, -1, 0, 0, 0).
    expect(quarter.a).toBeCloseTo(0, 5);
    expect(quarter.b).toBeCloseTo(1, 5);

    await settleAnimations(SPIN_MS / 2);
    const half = new DOMMatrix(getComputedStyle(spinner).transform);
    expect(half.a).toBeCloseTo(-1, 5);
    expect(half.b).toBeCloseTo(0, 5);
  });
});

// Units under test: the montage's own price-area Select and new-order Sheet, through their
// `SeekedOverlay`, and `FrameToast`, which keep a frame's pixels independent of the frames rendered
// before it and place the part where it belongs. Oracles: a fresh render of the same frame, the
// cross-check that must agree, and the motion and geometry Fuse declares for the part.
const toasts = () => document.querySelectorAll('[data-slot="toast-root"]').length;

/** Whether the Select trigger holds focus, and whether it would draw a keyboard ring. */
type TriggerFocus = { readonly focused: boolean; readonly focusVisible: boolean };

function triggerFocus(): TriggerFocus {
  const trigger = document.querySelector('[data-slot="select-trigger"]');
  if (trigger === null) {
    throw new Error("The Select is not mounted");
  }
  return { focused: document.activeElement === trigger, focusVisible: trigger.matches(":focus-visible") };
}

/** The Select trigger's chevron turns 180° over `duration-200` with `ease-in-out` as it opens. */
const CHEVRON_MS = 200;

/** Fuse's Select opens `sideOffset = 4` px below its trigger. */
const SELECT_SIDE_OFFSET = 4;

/** The stage's scale at 1920×1080, and the app window's own transform inside it, as in the montage. */
const STAGE_SCALE = 1.5;

/** A scaled stage with an offset, transformed app window inside it, as the montage nests a Select. */
function ScaledStage({ children }: { readonly children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        position: "relative",
        width: 1280,
        height: 720,
        scale: String(STAGE_SCALE),
        transformOrigin: "top left",
      }}>
      <div style={{ position: "absolute", top: 40, left: 120, width: 1020, height: 560, scale: "1" }}>
        <div className="flex justify-end p-6">{children}</div>
      </div>
    </div>
  );
}

/** The open Select's trigger and popup, in screen pixels. */
type SelectBoxes = { readonly trigger: DOMRect; readonly popup: DOMRect };

function selectBoxes(): SelectBoxes {
  const trigger = document.querySelector('[data-slot="select-trigger"]');
  const popup = document.querySelector('[data-slot="select-content"]');
  if (trigger === null || popup === null) {
    throw new Error("The Select is not open");
  }
  return { trigger: trigger.getBoundingClientRect(), popup: popup.getBoundingClientRect() };
}

/** The chevron's rotation in degrees; an unrotated chevron computes `none`. */
function chevronDegrees(): number {
  const chevron = document.querySelector('[data-slot="select-trigger"] svg');
  if (chevron === null) {
    throw new Error("The Select trigger has no chevron");
  }
  const rotate = getComputedStyle(chevron).rotate;
  return rotate === "none" ? 0 : Number.parseFloat(rotate);
}

describe("frame history", () => {
  it("turns a Select trigger's chevron from the frame it opens, not from the scene's start", async () => {
    // Settle on the scene's clock, as a render does: the frame's time since the scene began.
    const atFrame = async (frame: number) => {
      render(
        <Scope brand="fkas">
          <PriceAreaSelect clock={{ frame, fps: FPS }} />
        </Scope>
      );
      await settleAnimations((frame / FPS) * 1000);
    };
    const halfway = OPEN_AT + Math.round((CHEVRON_MS / 2 / 1000) * FPS);

    await atFrame(OPEN_AT - 1);
    expect(chevronDegrees()).toBe(0);
    await atFrame(OPEN_AT);
    // The opening frame is the start of the turn.
    expect(chevronDegrees()).toBe(0);
    await atFrame(halfway);
    // Halfway through an ease-in-out turn, well clear of both ends.
    expect(chevronDegrees()).toBeGreaterThan(30);
    expect(chevronDegrees()).toBeLessThan(150);
    await atFrame(OPEN_AT + 20);
    expect(chevronDegrees()).toBe(180);
  });

  it("opens a Select flush under its trigger inside the scaled stage and a transformed app window", async () => {
    // The render's viewport, so collision handling has the room a render gives it.
    await page.viewport(1920, 1080);
    render(
      <Scope brand="fkas">
        <ScaledStage>
          <PriceAreaSelect clock={{ frame: OPEN_AT + 20, fps: FPS }} />
        </ScaledStage>
      </Scope>
    );
    await settleAnimations(((OPEN_AT + 20) / FPS) * 1000);
    const { trigger, popup } = selectBoxes();
    // Both boxes are in screen pixels, so the side offset scales with the stage.
    expect(Math.abs(popup.left - trigger.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(popup.top - (trigger.bottom + SELECT_SIDE_OFFSET * STAGE_SCALE))).toBeLessThanOrEqual(1);
  });

  it("leaves focus where a fresh render leaves it when a rewind closes the Select", async () => {
    const tree = (frame: number) => (
      <Scope brand="fkas">
        <PriceAreaSelect clock={{ frame, fps: FPS }} />
      </Scope>
    );
    const BEFORE_CLICK = OPEN_AT - 1;
    await play([OPEN_AT, AT_REST, BEFORE_CLICK], tree);
    const rewound = triggerFocus();
    unmountTree();

    await play([BEFORE_CLICK], tree);
    expect(rewound).toEqual(triggerFocus());
  });

  it("shows a sheet rewound into its slide where a fresh render of that frame shows it", async () => {
    const tree = (frame: number) => (
      <Scope brand="fkas">
        <NewOrderSheet clock={{ frame, fps: FPS }} />
      </Scope>
    );
    await play([0, OPEN_AT, AT_REST, ENTERING], tree);
    const rewound = Math.round(sheetBox().right);
    unmountTree();

    await play([ENTERING], tree);
    const fresh = Math.round(sheetBox().right);

    expect(rewound).toBe(fresh);
    // Two frames into the slide, the Sheet has not reached the edge it rests against.
    expect(fresh).toBeGreaterThan(document.documentElement.clientWidth);
  });

  it("removes a toast at once on a rewind before it, and raises one toast going forward again", async () => {
    const tree = (frame: number) => (
      <Scope brand="ngfi">
        <FrameToast at={OPEN_AT} clock={{ frame, fps: FPS }} title="Reading saved" description="48,213 kWh" />
      </Scope>
    );
    await play([0, OPEN_AT, AT_REST + 3], tree);
    expect(toasts()).toBe(1);

    await play([OPEN_AT - 5], tree);
    expect(toasts()).toBe(0);

    await play([AT_REST + 3], tree);
    expect(toasts()).toBe(1);
  });
});

// Unit under test: `ReadyFrame`, a scene's readiness. Oracle: Remotion captures a frame the
// moment its last hold is released, so at that moment the Sheet must already sit where Fuse's
// slide puts it two frames in, partly on screen and short of its edge.
describe("readiness", () => {
  /** A slow font load, so the gate opens well after the first frame would have settled. */
  const SLOW_FONTS_MS = 500;

  type Capture = { readonly mounted: boolean; readonly left: number; readonly right: number };

  /** The holds a test passes in, and the page as it was when the last one was released. */
  type Readiness = { readonly hold: RenderHold; readonly ready: Promise<Capture> };

  /** Render holds that capture the page at the moment the last one is released. */
  function watchReadiness(): Readiness {
    let pending = 0;
    let handles = 0;
    let capture: (value: Capture) => void = () => undefined;
    const ready = new Promise<Capture>((resolve) => {
      capture = resolve;
    });
    const hold: RenderHold = {
      delayRender: () => {
        pending += 1;
        handles += 1;
        return handles;
      },
      continueRender: () => {
        pending -= 1;
        if (pending === 0) {
          const popup = document.querySelector('[data-slot="sheet-content"]');
          const box = popup?.getBoundingClientRect();
          capture({
            mounted: popup !== null,
            left: box?.left ?? Number.NaN,
            right: box?.right ?? Number.NaN,
          });
        }
      },
      cancelRender: (error) => {
        throw error;
      },
    };
    return { hold, ready };
  }

  it("is not ready until the overlay sits at its seeked place, however slowly the fonts load", async () => {
    const { hold, ready } = watchReadiness();
    render(
      <Scope brand="fkas">
        <ReadyFrame
          clock={{ frame: ENTERING, fps: FPS }}
          hold={hold}
          loadFonts={() => new Promise((resolve) => setTimeout(resolve, SLOW_FONTS_MS))}>
          <NewOrderSheet clock={{ frame: ENTERING, fps: FPS }} />
        </ReadyFrame>
      </Scope>
    );

    const captured = await ready;
    const edge = document.documentElement.clientWidth;
    expect(captured.mounted).toBe(true);
    expect(captured.left).toBeLessThan(edge);
    expect(Math.round(captured.right)).toBeGreaterThan(edge);
  });
});
