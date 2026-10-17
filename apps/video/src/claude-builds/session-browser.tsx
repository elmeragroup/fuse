import { useRef } from "react";
import type { ReactElement } from "react";

import { interpolate } from "remotion";

import { splitWidths } from "../components/remocn/chat-to-preview-layout";
import type { ColumnSize } from "../components/remocn/chat-to-preview-layout";
import { SimulatedCursor } from "../components/remocn/simulated-cursor";
import type { SiteSection } from "../copy/catalog";
import { useCopy } from "../copy/copy";
import { CLAMP, ENTER, PAN } from "../motion/easing";
import { useFrameClock } from "../motion/frame-clock";
import { FrameToast } from "../motion/frame-toast";
import { bars } from "../music/beat-grid";
import { SceneTheme } from "../primitives/scene-theme";
import { CHORD_BARS, DROP_BAR } from "./grid";
import { MachineTheme } from "./machine-theme";
import { CHAT_REST, CLICK, FAQ_OPENS_AT, lookAt, OVERVIEW, SLIDER, WRITES } from "./session-script";
import { SITE_HEIGHT, SITE_WIDTH, sectionHeight, sectionTop } from "./site/site-layout";
import { SitePage, usePagePoint } from "./site/site-page";

/** The address the dev server answers on. */
const ADDRESS = "localhost:3000";

/** The browser's address bar, in stage pixels (`h-8`): it does not scale with the page. */
const BAR = 32;

/** The preview column's width once the split has opened, where the page stops scaling down. */
const REST_WIDTH = splitWidths(CHAT_REST).preview;

/** Frames the camera takes to scroll a landed section into view. */
const SCROLL_FRAMES = 18;

/** Room the camera leaves under a section it scrolls to, in site pixels. */
const SCROLL_MARGIN = 24;

/** Room it leaves under the calculator, where the toast its order raises comes up. */
const TOAST_ROOM = 150;

/** Room the camera leaves around the whole page when it pulls back to show it all, in stage pixels. */
const OVERVIEW_MARGIN = 20;

/** Frames the toast and the cursor take to fade once they are done. */
const FADE_FRAMES = 8;

/**
 * The camera's scroll on a frame, in site pixels: each move eases from where the last one left
 * it. While the page is built it settles on each section as it lands; through the drop it pans
 * a section further on each chord change, as the page takes its next look, and back up to the
 * hero for the landing.
 */
function scrollAt(frame: number, viewport: number): number {
  const most = Math.max(0, SITE_HEIGHT - viewport);
  const clamp = (scroll: number) => Math.min(most, Math.max(0, scroll));
  const bottomOf = (section: SiteSection, margin = SCROLL_MARGIN) =>
    clamp(sectionTop(section) + sectionHeight(section) - viewport + margin);
  const topOf = (section: SiteSection) => clamp(sectionTop(section) - SCROLL_MARGIN);
  const moves = [
    { at: WRITES.plans.lands, to: bottomOf("plans"), frames: SCROLL_FRAMES, easing: ENTER },
    {
      at: WRITES.calculator.lands,
      to: bottomOf("calculator", TOAST_ROOM),
      frames: SCROLL_FRAMES,
      easing: ENTER,
    },
    { at: WRITES.faq.lands, to: bottomOf("faq"), frames: SCROLL_FRAMES, easing: ENTER },
    { at: WRITES.footer.lands, to: bottomOf("footer"), frames: SCROLL_FRAMES, easing: ENTER },
    // Back to the top while the whole page shows, so the camera pushes in on the hero.
    { at: OVERVIEW.at + bars(2), to: 0, frames: bars(1), easing: PAN },
    { at: bars(DROP_BAR + CHORD_BARS), to: topOf("plans"), frames: bars(1), easing: PAN },
    { at: bars(DROP_BAR + 2 * CHORD_BARS), to: topOf("calculator"), frames: bars(1), easing: PAN },
    { at: bars(DROP_BAR + 3 * CHORD_BARS), to: 0, frames: bars(1), easing: PAN },
  ];
  return moves.reduce(
    (scroll, move) =>
      interpolate(frame, [move.at, move.at + move.frames], [scroll, move.to], {
        ...CLAMP,
        easing: move.easing,
      }),
    0
  );
}

/**
 * Where the camera puts the page on a frame: its scale and its top-left corner, in stage pixels,
 * with the near scale and the viewport's height in site pixels at that scale.
 */
type Camera = {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
  readonly near: number;
  readonly viewport: number;
};

/**
 * The camera on a frame. Near, the page fills the viewport's width, down to the column's resting
 * width, and scrolls; pulled back, the whole page fits the viewport's height, centred, so every
 * section shows a flip at once. The pull eases between the two.
 */
function cameraAt(frame: number, size: ColumnSize): Camera {
  const height = size.height - BAR;
  const near = Math.max(size.width, REST_WIDTH) / SITE_WIDTH;
  const far = (height - 2 * OVERVIEW_MARGIN) / SITE_HEIGHT;
  const viewport = height / near;
  const scroll = scrollAt(frame, viewport);
  const pull = interpolate(
    frame,
    [OVERVIEW.at, OVERVIEW.at + bars(1), OVERVIEW.until, OVERVIEW.until + bars(1)],
    [0, 1, 1, 0],
    { ...CLAMP, easing: PAN }
  );
  return {
    scale: near + (far - near) * pull,
    x: ((size.width - SITE_WIDTH * far) / 2) * pull,
    y: -scroll * near * (1 - pull) + OVERVIEW_MARGIN * pull,
    near,
    viewport,
  };
}

/** The yearly use the calculator's slider shows on a frame, snapped to its 100 kWh step. */
function yearlyKwhAt(frame: number): number {
  const kwh = interpolate(frame, [SLIDER.from, SLIDER.to], [SLIDER.startKwh, SLIDER.endKwh], {
    ...CLAMP,
    easing: PAN,
  });
  return Math.round(kwh / 100) * 100;
}

/**
 * The preview: a browser on the dev server, its page in the look the session has given it on
 * this frame. The page keeps its layout width and scales to the column, down to the column's
 * resting width, below which the column clips it; the camera scrolls it in site pixels.
 *
 * @param props.size - The preview column's size this frame.
 * @returns The browser.
 */
export function SessionBrowser({ size }: { readonly size: ColumnSize }): ReactElement {
  const clock = useFrameClock();
  const { frame } = clock;
  const { site } = useCopy().claudeBuilds;
  const order = useRef<HTMLButtonElement>(null);
  const aim = usePagePoint(order);
  const look = lookAt(frame);
  const camera = cameraAt(frame, size);
  const done = (until: number) => interpolate(frame, [until, until + FADE_FRAMES], [1, 0], CLAMP);

  return (
    <div className="absolute inset-0">
      <MachineTheme className="absolute inset-x-0 top-0 h-8 border-b border-border bg-muted font-sans">
        <div className="flex h-full items-center gap-2 px-4">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-2.5 rounded-full bg-muted-foreground/40" />
          ))}
          <span className="text-xs mx-auto rounded-md bg-background px-16 py-1 text-muted-foreground">
            {ADDRESS}
          </span>
          <span className="w-12" />
        </div>
      </MachineTheme>
      <div
        className="absolute left-0 overflow-hidden"
        style={{ top: BAR, width: size.width, height: size.height - BAR }}>
        {/* What shows around the page while the camera has pulled back: the machine's own surface. */}
        <MachineTheme className="absolute inset-0 bg-muted" />
        <SceneTheme
          brand={look.brand}
          scheme={look.scheme}
          density={look.density}
          className="relative size-full font-sans text-foreground">
          <div
            style={{
              width: SITE_WIDTH,
              translate: `${String(camera.x)}px ${String(camera.y)}px`,
              scale: String(camera.scale),
              transformOrigin: "top left",
            }}>
            <SitePage
              brand={look.brand}
              writes={WRITES}
              yearlyKwh={yearlyKwhAt(frame)}
              faqOpensAt={FAQ_OPENS_AT}
              clock={clock}
              order={order}>
              {frame >= CLICK.call && frame < CLICK.toastUntil + FADE_FRAMES ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ opacity: done(CLICK.toastUntil) }}>
                  <SimulatedCursor
                    size={36}
                    stops={[
                      { x: aim.x + 180, y: aim.y + 110, at: CLICK.call },
                      { x: aim.x, y: aim.y, at: CLICK.at, click: true },
                    ]}
                  />
                </div>
              ) : null}
            </SitePage>
          </div>
          {frame < CLICK.toastUntil + FADE_FRAMES ? (
            <div
              className="absolute top-0 left-0"
              style={{
                width: SITE_WIDTH,
                height: camera.viewport,
                scale: String(camera.near),
                transformOrigin: "top left",
                opacity: done(CLICK.toastUntil),
              }}>
              <FrameToast
                at={CLICK.at}
                clock={clock}
                title={site.toast.title}
                description={site.toast.description}
                // Fuse places the viewport with `sm:` classes too; the stage's viewport is wider than `sm`.
                className="sm:right-6 sm:bottom-6 sm:w-80 absolute right-6 bottom-6 w-80"
              />
            </div>
          ) : null}
        </SceneTheme>
      </div>
      {/* The window's frame over the page, in the machine's theme, which cannot wrap the page. */}
      <MachineTheme className="rounded-2xl pointer-events-none absolute inset-0 border border-border" />
    </div>
  );
}
