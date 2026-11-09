/**
 * Unit under test: the Carousel in WebKit configured as an iPhone 15 (393px wide, three device
 * pixels per CSS pixel, touch, mobile viewport), the closest a test runner gets to iOS Safari.
 * Playwright cannot drag a finger in WebKit, so the swipe itself is covered in Chromium's touch
 * suite; here WebKit proves the parts a swipe ends in: the snap container WebKit parses, its
 * re-snap of a scroll that stops between slides, the engine's page math on fractional slide
 * widths at three device pixels, and taps on the controls and a peeking slide.
 *
 * Oracle: the fixture's hand-sized layout. Slides are 85% of the 393px viewport, 334.05px, 12px
 * apart, so page N starts N × 346.05px in, and the last page clamps to the scroll range's end:
 * five slides end at 5 × 334.05 + 4 × 12 = 1718.25px, so the range ends at 1325.25px.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";

import "../../../dist/styles.css";
import { pollFrames } from "../../../test/animation-frames";
import { serverRendered } from "../../../test/carousel-fixtures";
import { carouselIndicators, carouselViewport, currentIndicator } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

const STEP = 0.85 * 393 + 12;
const POSITIONS = [0, STEP, 2 * STEP, 3 * STEP, 5 * 0.85 * 393 + 4 * 12 - 393];

function Fixture(): ReactElement {
  const [tapped, setTapped] = useState("none");
  return withLocale(
    "en-US",
    <>
      <Carousel.Root aria-label="Offers" style={{ width: 393 }}>
        <Carousel.Viewport style={{ gap: 12 }}>
          {[1, 2, 3, 4, 5].map((slide) => (
            <Carousel.Slide key={slide} style={{ flexBasis: "85%" }}>
              <button
                type="button"
                style={{ height: 120, width: "100%" }}
                onClick={() => setTapped(`${slide}`)}>
                Offer {slide}
              </button>
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <Carousel.Controls>
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
      </Carousel.Root>
      <p>{`Tapped ${tapped}`}</p>
    </>
  );
}

async function tap(element: HTMLElement): Promise<void> {
  const box = element.getBoundingClientRect();
  await commands.tap(box.left + box.width / 2, box.top + box.height / 2);
}

/**
 * Device pixels are a third of a CSS pixel, so a landed scroll sits within one of them, half a CSS
 * pixel from its position. A scroll moves only as the page renders, so this counts four seconds in
 * frames.
 */
async function landsOn(viewport: HTMLElement, position: number): Promise<void> {
  await pollFrames(() => viewport.scrollLeft, expect.closeTo(position, 0), 240);
}

describe("Carousel on an iPhone-sized WebKit", () => {
  it("runs on WebKit's native snap container, with the page's vertical pan left alone", () => {
    expect(devicePixelRatio).toBe(3);
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const style = getComputedStyle(viewport);
    expect(style.scrollSnapType).toBe("x mandatory");
    expect(style.overscrollBehaviorX).toBe("contain");
    expect(style.touchAction).toBe("auto");
    expect(getComputedStyle(roleNamed("group", "1 of 5")).scrollSnapStop).toBe("always");
  });

  it("makes one page per snap position on fractional slide widths", async () => {
    renderThemed(<Fixture />);
    await pollFrames(() => carouselIndicators().length, 5);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    for (const [page, position] of POSITIONS.entries()) {
      await tap(roleNamed("button", `Slide ${page + 1} of 5`));
      await landsOn(viewport, position);
      expect(currentIndicator()).toBe(page);
    }
  });

  it("follows WebKit's re-snap of a scroll that stops between slides", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    // 70% of the way to page 2: mandatory snapping moves it on to page 2's position.
    viewport.scrollTo({ left: 0.7 * STEP, behavior: "instant" });
    await landsOn(viewport, STEP);
    await pollFrames(currentIndicator, 1);
  });

  it("answers taps on Next and on the slide peeking in", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    // Slide 2 peeks 46.95px into the viewport, so it is not inert and takes a tap.
    const peek = roleNamed("button", "Offer 2");
    const box = peek.getBoundingClientRect();
    await commands.tap(box.left + 20, box.top + box.height / 2);
    await expect.poll(() => page.getByText("Tapped 2", { exact: true }).query()).not.toBeNull();

    await tap(roleNamed("button", "Next slide"));
    await landsOn(viewport, STEP);
    expect(currentIndicator()).toBe(1);
  });

  it("rotates after hydration when a tap before it left the carousel in a sticky :hover", async () => {
    const server = serverRendered(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="News" style={{ width: 393 }}>
          <Carousel.Controls>
            <Carousel.Autoplay delay={200} />
            <Carousel.Indicators />
          </Carousel.Controls>
          <Carousel.Viewport>
            {[1, 2, 3].map((slide) => (
              <Carousel.Slide key={slide}>
                <div style={{ height: 120 }}>Story {slide}</div>
              </Carousel.Slide>
            ))}
          </Carousel.Viewport>
        </Carousel.Root>
      )
    );
    const region = roleNamed("region", "News");
    // The viewport's middle is on the first story.
    await tap(carouselViewport(region));
    // The preconditions: the tap left WebKit's `:hover` on the carousel, on a device whose
    // primary pointer cannot hover, so no pointer is over the carousel.
    expect(region.matches(":hover")).toBe(true);
    expect(matchMedia("(hover: hover)").matches).toBe(false);
    server.hydrate();
    await pollFrames(currentIndicator, 1, 180);
    expect(carouselViewport(region).getAttribute("aria-live")).toBe("off");
    expect(server.recoverableErrors).toEqual([]);
  });
});
