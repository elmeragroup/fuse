/**
 * Unit under test: the Carousel under a finger, in Chromium with touch on. Each finger goes through
 * Chromium's touch input, so the native scroller, its scroll snapping and the fling after the
 * lift answer it; the carousel adds no touch handler of its own. Oracles: the fixture's hand-sized
 * layout, where page N starts N slide widths in, and mandatory snapping, under which a scroll
 * comes to rest on a snap position. `scroll-snap-stop` is proven by a directional scroll in
 * `carousel.engines.browser.test.tsx`: a synthetic flick in headless Chromium on Linux barely
 * flings past a slide with or without it, so no flick here can tell the two apart.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it, onTestFinished } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, wait } from "../../../test/animation-frames";
import { carouselViewport, currentIndicator, settledOn } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

const WIDTH = 300;

function Fixture({ autoplay }: { readonly autoplay?: number }): ReactElement {
  return withLocale(
    "en-US",
    // Taller than the frame, so a vertical swipe has a page to scroll.
    <div style={{ height: 3000, paddingTop: 40 }}>
      <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
        {autoplay === undefined ? null : (
          <Carousel.Controls>
            <Carousel.Autoplay delay={autoplay} />
          </Carousel.Controls>
        )}
        <Carousel.Viewport>
          {[1, 2, 3, 4, 5].map((slide) => (
            <Carousel.Slide key={slide}>
              <div style={{ height: 160 }}>Slide body {slide}</div>
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <Carousel.Controls>
          <Carousel.Indicators />
        </Carousel.Controls>
      </Carousel.Root>
    </div>
  );
}

/**
 * Swipe across the viewport, lifting the finger while it still moves. A negative `dx` scrolls
 * toward the next slide, as a finger moving left does. The finger lands near the edge it moves
 * away from, so it stays on the page however far it goes.
 */
async function swipe(viewport: HTMLElement, dx: number, dy: number, speed: number): Promise<void> {
  // A scroller mounted a moment ago may not have reached the compositor, which hit-tests a
  // touch, so the first swipe waits for a few painted frames.
  await nextFrames(3);
  const box = viewport.getBoundingClientRect();
  const x = dx < 0 ? box.right - 10 : dx > 0 ? box.left + 10 : box.left + box.width / 2;
  const y = dy < 0 ? box.bottom - 10 : dy > 0 ? box.top + 10 : box.top + box.height / 2;
  await commands.touchSwipe(x, y, dx, dy, speed);
}

async function settles(viewport: HTMLElement, left: number): Promise<void> {
  await pollFrames(() => Math.round(viewport.scrollLeft), left, 240);
  await wait(400);
  expect(Math.round(viewport.scrollLeft)).toBe(left);
}

describe("Carousel swipe", () => {
  it("turns one page per quick flick, in either direction", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);

    // A 1500px/s flick a little past half a slide comes to rest one page on.
    await swipe(viewport, -(WIDTH * 0.6), 0, 1500);
    await settles(viewport, WIDTH);
    await pollFrames(currentIndicator, 1);

    await swipe(viewport, -(WIDTH * 0.6), 0, 1500);
    await settles(viewport, 2 * WIDTH);
    await pollFrames(currentIndicator, 2);

    await swipe(viewport, WIDTH * 0.6, 0, 1500);
    await settles(viewport, WIDTH);
    await pollFrames(currentIndicator, 1);
  });

  it("snaps a short drag released at rest back to the page it started on", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    await nextFrames(3);
    const box = viewport.getBoundingClientRect();
    const x = box.right - 20;
    const y = box.top + box.height / 2;
    await commands.touchStart(x, y);
    try {
      // 40px toward the next slide, held still long enough that the lift does not fling.
      for (const step of [10, 20, 30, 40, 40, 40, 40]) {
        await commands.touchMove(x - step, y);
        await wait(16);
      }
      // The viewport followed the finger, so the snap back below is the scroll's own.
      await pollFrames(() => Math.round(viewport.scrollLeft) > 20, true);
    } finally {
      await commands.touchEnd();
    }
    await settles(viewport, 0);
    expect(currentIndicator()).toBe(0);
  });

  it("leaves a vertical swipe to the page", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    expect(getComputedStyle(viewport).touchAction).toBe("auto");
    const before = document.scrollingElement?.scrollTop ?? 0;
    // A finger moving up scrolls the page down.
    await swipe(viewport, 0, -240, 1200);
    await pollFrames(() => (document.scrollingElement?.scrollTop ?? 0) - before > 100, true);
    expect(viewport.scrollLeft).toBe(0);
    expect(currentIndicator()).toBe(0);
    document.scrollingElement?.scrollTo({ top: 0, behavior: "instant" });
  });

  it("keeps a swipe past the last slide from scrolling a sideways-scrolling ancestor", async () => {
    // The carousel sits in the middle of a strip that scrolls sideways, scrolled to show it, so the
    // strip could scroll further either way. Without containment the swipe that the carousel's last
    // slide cannot take chains to the strip.
    renderThemed(
      withLocale(
        "en-US",
        <div aria-label="Strip" role="region" style={{ width: 400, overflowX: "auto", paddingTop: 40 }}>
          <div style={{ display: "flex", width: 1500 }}>
            <div style={{ flex: "0 0 600px" }} />
            <Carousel.Root aria-label="Offers" style={{ width: WIDTH, flex: "0 0 auto" }}>
              <Carousel.Viewport>
                {[1, 2, 3].map((slide) => (
                  <Carousel.Slide key={slide}>
                    <div style={{ height: 160 }}>Slide body {slide}</div>
                  </Carousel.Slide>
                ))}
              </Carousel.Viewport>
              <Carousel.Controls>
                <Carousel.Indicators />
              </Carousel.Controls>
            </Carousel.Root>
            <div style={{ flex: "0 0 600px" }} />
          </div>
        </div>
      )
    );
    const strip = roleNamed("region", "Strip");
    strip.scrollTo({ left: 550, behavior: "instant" });
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    viewport.scrollTo({ left: 2 * WIDTH, behavior: "instant" });
    await pollFrames(currentIndicator, 2);
    expect(strip.scrollLeft).toBe(550);

    await swipe(viewport, -(WIDTH * 0.6), 0, 1500);
    await settles(viewport, 2 * WIDTH);
    expect(strip.scrollLeft).toBe(550);
    expect(currentIndicator()).toBe(2);
  });
});

describe("Carousel live indicators", () => {
  it("follows the finger before it lifts", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    await nextFrames(3);
    const box = viewport.getBoundingClientRect();
    const x = box.left + box.width - 20;
    const y = box.top + box.height / 2;
    await commands.touchStart(x, y);
    // Past half a slide toward the next, held there: the scroll has begun and has not ended.
    for (const step of [40, 80, 120, 160, 200]) {
      await commands.touchMove(x - step, y);
    }
    try {
      await pollFrames(currentIndicator, 1, 120);
      expect(Math.round(viewport.scrollLeft)).toBeGreaterThan(WIDTH / 2);
    } finally {
      await commands.touchEnd();
    }
    await settles(viewport, WIDTH);
  });
});

describe("Carousel swipe and rotation", () => {
  it("stops rotation for good on a short native touch drag that snaps back", async () => {
    // Longer than the drag takes to send, so rotation cannot advance before the finger is down.
    renderThemed(<Fixture autoplay={2500} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    expect(roleNamed("button", "Stop automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await nextFrames(3);
    // A real finger through Chromium's touch input: down, 30px left, a rest, up.
    const box = viewport.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    await commands.touchStart(x, y);
    for (const step of [10, 20, 30]) {
      await commands.touchMove(x - step, y);
    }
    // The finger rests before it lifts, so no fling carries the drag on to the next page.
    await wait(250);
    await commands.touchEnd();
    await settles(viewport, 0);
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await wait(3000);
    expect(currentIndicator()).toBe(0);
  });
});

/**
 * Make the page a browser without `scrollend`: the property is gone, so the engine takes its quiet
 * spell for every scroll's end, and the event itself never reaches an element. Both come back
 * when the test finishes, however it ends.
 */
function withoutScrollEnd(): void {
  const owners = [HTMLElement.prototype, Element.prototype, Document.prototype, Window.prototype].filter(
    (owner) => Object.hasOwn(owner, "onscrollend")
  );
  const saved = owners.flatMap((owner) => {
    const descriptor = Object.getOwnPropertyDescriptor(owner, "onscrollend");
    return descriptor === undefined ? [] : [[owner, descriptor] as const];
  });
  for (const owner of owners) {
    Reflect.deleteProperty(owner, "onscrollend");
  }
  const block = (event: Event) => event.stopImmediatePropagation();
  window.addEventListener("scrollend", block, true);
  onTestFinished(() => {
    window.removeEventListener("scrollend", block, true);
    for (const [owner, descriptor] of saved) {
      Object.defineProperty(owner, "onscrollend", descriptor);
    }
  });
}

/**
 * A controlled carousel whose parent takes the pages its controls ask for and refuses the ones a
 * scroll reports, so a settle that comes too early shows as the viewport snapping back.
 */
function Refusing(): ReactElement {
  const [index, setIndex] = useState(0);
  return withLocale(
    "en-US",
    <Carousel.Root
      aria-label="Offers"
      style={{ width: WIDTH }}
      index={index}
      onIndexChange={(next, { reason }) => {
        if (reason !== "scroll") {
          setIndex(next);
        }
      }}>
      <Carousel.Viewport>
        {[1, 2, 3, 4, 5].map((slide) => (
          <Carousel.Slide key={slide}>
            <div style={{ height: 160 }}>Slide body {slide}</div>
          </Carousel.Slide>
        ))}
      </Carousel.Viewport>
      <Carousel.Controls>
        <Carousel.Indicators />
      </Carousel.Controls>
    </Carousel.Root>
  );
}

/**
 * Put a finger down in the viewport and move it `distance` px, toward the next slide when positive
 * and the previous one when negative, then keep it down.
 */
async function dragAndHold(viewport: HTMLElement, distance: number): Promise<void> {
  const box = viewport.getBoundingClientRect();
  const x = distance > 0 ? box.left + box.width - 20 : box.left + 20;
  const y = box.top + box.height / 2;
  await commands.touchStart(x, y);
  const direction = Math.sign(distance);
  for (let step = 20; step <= Math.abs(distance); step += 20) {
    await commands.touchMove(x - direction * step, y);
  }
  await nextFrames(3);
}

/** The scroll position once it has stopped changing, as a held finger leaves it. */
async function atRest(viewport: HTMLElement): Promise<number> {
  let last = Number.NaN;
  for (;;) {
    await nextFrames(3);
    if (Math.abs(viewport.scrollLeft - last) < 1) {
      return viewport.scrollLeft;
    }
    last = viewport.scrollLeft;
  }
}

describe("Carousel held gestures", () => {
  it("settles a drag that a tap interrupts before its quiet spell ends", async () => {
    withoutScrollEnd();
    renderThemed(<Refusing />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    await nextFrames(3);
    await dragAndHold(viewport, 160);
    await atRest(viewport);
    // The finger lifts at rest, so nothing flings, and a tap that scrolls nothing follows at once,
    // within the drag's quiet spell.
    const box = viewport.getBoundingClientRect();
    const tap = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    await commands.touchEnd();
    // The lift's own snap comes to rest, and the tap lands inside the quiet spell after it.
    await atRest(viewport);
    await commands.touchStart(tap.x, tap.y);
    await commands.touchEnd();
    // The drag is still owed its end: the parent refused its page, so the carousel goes back.
    await settles(viewport, 0);
  });

  it("keeps touch input held while one of two fingers is still down", async () => {
    // Chromium's touch input through CDP stalls a pan once a second finger has landed and lifted,
    // as it does for the start of a pinch, so the two fingers are the events the browser would
    // send, in its order, and the held finger's drag is a scroll of the viewport.
    withoutScrollEnd();
    renderThemed(<Refusing />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    const box = viewport.getBoundingClientRect();
    const finger = (identifier: number, x: number) =>
      new Touch({ identifier, target: viewport, clientX: x, clientY: box.top + box.height / 2 });
    const pointer = (type: string, pointerId: number) =>
      new PointerEvent(type, { pointerId, pointerType: "touch", bubbles: true, composed: true });
    const touches = (type: string, down: readonly Touch[]) =>
      new TouchEvent(type, { touches: [...down], bubbles: true, composed: true });
    const first = finger(1, box.left + box.width - 20);

    // Two fingers land; the second lifts, the first stays down.
    viewport.dispatchEvent(pointer("pointerdown", 1));
    viewport.dispatchEvent(pointer("pointerdown", 2));
    viewport.dispatchEvent(pointer("pointerup", 2));
    viewport.dispatchEvent(touches("touchend", [first]));
    // The first finger's drag: the browser takes it for panning, then the viewport scrolls.
    viewport.dispatchEvent(pointer("pointercancel", 1));
    viewport.scrollTo({ left: 185, behavior: "instant" });
    const held = await atRest(viewport);
    expect(held).toBeGreaterThan(100);
    // Far past the quiet spell, with the first finger still down: nothing has ended.
    await wait(600);
    expect(Math.abs(viewport.scrollLeft - held)).toBeLessThan(2);

    viewport.dispatchEvent(touches("touchend", []));
    // Every finger up: the parent refused the page, so the carousel goes back to its own.
    await settles(viewport, 0);
  });

  it("does not settle a held drag in a browser without scrollend, and settles after the lift", async () => {
    withoutScrollEnd();
    renderThemed(<Refusing />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    await nextFrames(3);
    await dragAndHold(viewport, 160);
    const held = await atRest(viewport);
    expect(held).toBeGreaterThan(100);
    // Far past the quiet spell, with the finger still down: nothing has ended.
    await wait(600);
    expect(Math.abs(viewport.scrollLeft - held)).toBeLessThan(2);
    await commands.touchEnd();
    // The parent refused the page the drag reached, so after the lift the carousel returns to its own.
    await settles(viewport, 0);
  });

  it("does not let a quiet spell an earlier scroll left settle a drag the user then holds", async () => {
    // Without `scrollend`, the press's own scroll ends by a quiet spell, which is still pending the
    // moment the scroll arrives; the finger lands within it.
    withoutScrollEnd();
    renderThemed(<Refusing />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    roleNamed("button", "Slide 3 of 5").click();
    await settledOn(viewport, 2 * WIDTH);
    // Back past the middle toward page 2, held: nearer page 2 at 300px than the parent's page 3
    // at 600px, so an early settle would report page 2 and pull the viewport back to page 3.
    await dragAndHold(viewport, -180);
    const held = await atRest(viewport);
    expect(held).toBeLessThan(1.5 * WIDTH);
    await wait(600);
    expect(Math.abs(viewport.scrollLeft - held)).toBeLessThan(2);
    await commands.touchEnd();
    // Released, the parent's page 3 stands, as it refused the scroll's.
    await settles(viewport, 2 * WIDTH);
  });
});
