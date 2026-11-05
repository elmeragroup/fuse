/**
 * Unit under test: the Carousel under `prefers-reduced-motion: reduce`, in every engine. Oracles:
 * the APG carousel pattern and WCAG 2.2.2, under which a user who asked for less motion gets no
 * automatic rotation until they start it, and the central reduced-motion rule in `fuse.css`,
 * which turns smooth scrolling and layout transitions off.
 */
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import { carouselIndicators, carouselViewport, settledOn } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

const WIDTH = 200;

function Fixture({ autoplay }: { readonly autoplay?: number }): ReactElement {
  return withLocale(
    "en-US",
    <>
      <button type="button">Outside</button>
      <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
        <Carousel.Controls>
          {autoplay === undefined ? null : <Carousel.Autoplay delay={autoplay} />}
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
        <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
      </Carousel.Root>
    </>
  );
}

describe("Carousel under reduced motion", () => {
  it("does not rotate until the user starts it", async () => {
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    renderThemed(<Fixture autoplay={150} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await expect
      .poll(() => roleNamed("button", "Start automatic slide show").getAttribute("aria-label"))
      .toBe("Start automatic slide show");
    expect(viewport.getAttribute("aria-live")).toBe("polite");
    await wait(500);
    expect(viewport.scrollLeft).toBe(0);

    // The press leaves focus on the rotation control, which does not pause it, and the pointer
    // then leaves the carousel.
    await userEvent.click(roleNamed("button", "Start automatic slide show"));
    await userEvent.hover(roleNamed("button", "Outside"));
    expect(roleNamed("button", "Stop automatic slide show")).toBe(document.activeElement);
    await settledOn(viewport, WIDTH);
  });

  it("jumps to a page without a smooth scroll, and moves the pill without a transition", async () => {
    renderThemed(<Fixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await expect.poll(() => carouselIndicators().length).toBe(3);
    expect(getComputedStyle(viewport).scrollBehavior).toBe("auto");
    const pill = getComputedStyle(carouselIndicators()[1] ?? viewport, "::after");
    expect(pill.transitionProperty.split(", ")).not.toContain("width");

    roleNamed("button", "Next slide").click();
    await nextFrames(2);
    expect(Math.round(viewport.scrollLeft)).toBe(WIDTH);
    expect(px(getComputedStyle(carouselIndicators()[1] ?? viewport, "::after").width)).toBe(28);
  });
});
