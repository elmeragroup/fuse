/**
 * Unit under test: the Carousel engine's paging in Chromium: a right-to-left `scrollLeft` runs from
 * 0 at the start to negative values, and reports must not trail a scroll. Oracle: each fixture's
 * hand-sized layout, where page N starts N slide lengths from the scroll origin.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import {
  carouselIndicators,
  carouselViewport,
  currentIndicator,
  settledOn,
} from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { CarouselIndexChangeReason } from "./carousel-context";
import { Carousel } from "./index";

// The page's timeouts are fake: a check that nothing more is reported fires every pending settle
// timer at once, so it reads the final state without waiting on the clock.
beforeEach(() => {
  useFakeTimeouts();
});

/** Runs every timer the carousel left pending and lets the page render what they did. */
async function afterPendingTimers(): Promise<void> {
  vi.runOnlyPendingTimers();
  await nextFrames(2);
}

/** The slide length on the scroll axis. */
const LENGTH = 200;

function Fixture({
  dir = "ltr",
  defaultIndex = 0,
}: {
  readonly dir?: "ltr" | "rtl";
  readonly defaultIndex?: number;
}): ReactElement {
  return withLocale(
    "en-US",
    <div dir={dir}>
      <Carousel.Root aria-label="Offers" style={{ width: LENGTH }} defaultIndex={defaultIndex}>
        <Carousel.Viewport>
          {[1, 2, 3, 4].map((slide) => (
            <Carousel.Slide key={slide}>
              <div style={{ height: LENGTH }}>Slide body {slide}</div>
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <Carousel.Controls>
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
      </Carousel.Root>
    </div>
  );
}

describe("Carousel direction change away from the first page", () => {
  it.each([
    ["ltr", "rtl"],
    ["rtl", "ltr"],
  ] as const)("keeps page 3 through a switch from %s to %s", async (from, to) => {
    function Switching(): ReactElement {
      const [dir, setDir] = useState<"ltr" | "rtl">(from);
      return (
        <>
          <button type="button" onClick={() => setDir(to)}>
            Switch direction
          </button>
          <Fixture dir={dir} defaultIndex={2} />
        </>
      );
    }
    renderThemed(<Switching />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const names = ["1 of 4", "2 of 4", "3 of 4", "4 of 4"];
    const inert = () => names.map((name) => roleNamed("group", name).hasAttribute("inert"));
    const logical = (rtl: boolean) => () => Math.round(rtl ? -viewport.scrollLeft : viewport.scrollLeft);
    await pollFrames(logical(from === "rtl"), 2 * LENGTH);
    await pollFrames(currentIndicator, 2);

    await userEvent.click(roleNamed("button", "Switch direction"));
    // Page 3 stays selected and in view, at its place in the new direction.
    await pollFrames(logical(to === "rtl"), 2 * LENGTH, 180);
    expect(currentIndicator()).toBe(2);
    expect(carouselIndicators()).toHaveLength(4);
    await pollFrames(inert, [true, true, false, true]);

    await userEvent.click(roleNamed("button", "Previous slide"));
    await pollFrames(logical(to === "rtl"), LENGTH, 180);
    expect(currentIndicator()).toBe(1);
    await pollFrames(inert, [true, false, true, true]);
  });
});

describe("Carousel input that never scrolls", () => {
  it.each(["a click", "keys typed into a field"] as const)(
    "%s leaves nothing live: a later scroll reports only its own page, once",
    async (input) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      renderThemed(
        withLocale(
          "en-US",
          <div aria-label="Ancestor" role="group">
            <style>{".gapped-slide { margin-inline-end: var(--gapped, 0px); }"}</style>
            <Carousel.Root
              aria-label="Offers"
              style={{ width: LENGTH }}
              onIndexChange={(index, { reason }) => changes.push([index, reason])}>
              <Carousel.Viewport>
                {[1, 2, 3, 4].map((offer) => (
                  <Carousel.Slide key={offer} className="gapped-slide">
                    <div style={{ height: 80 }}>
                      <button type="button">Offer {offer}</button>
                      {offer === 1 ? <input aria-label="Postcode" /> : null}
                    </div>
                  </Carousel.Slide>
                ))}
              </Carousel.Viewport>
              <Carousel.Controls>
                <Carousel.Indicators />
              </Carousel.Controls>
            </Carousel.Root>
          </div>
        )
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await pollFrames(currentIndicator, 0);
      if (input === "a click") {
        await userEvent.click(roleNamed("button", "Offer 1"));
      } else {
        roleNamed("textbox", "Postcode").focus();
        await userEvent.keyboard("0150");
      }

      // An inherited 200px gap puts the slides at 0, 400, 800 and 1200, which nothing reports.
      roleNamed("group", "Ancestor").style.setProperty("--gapped", "200px");
      // With the viewport's own smooth motion, so the scroll spans frames before it ends.
      viewport.scrollTo({ left: 400 });
      await pollFrames(currentIndicator, 1, 180);
      await afterPendingTimers();
      expect(changes).toEqual([[1, "scroll"]]);
    }
  );
});

describe("Carousel presses in quick succession", () => {
  it("keeps each press's page when the scroll before it ends after the press", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root
          aria-label="Offers"
          style={{ width: LENGTH }}
          onIndexChange={(index, { reason }) => changes.push([index, reason])}>
          <Carousel.Viewport>{carouselSlides(6, 1)}</Carousel.Viewport>
          <Carousel.Controls>
            <Carousel.Indicators />
          </Carousel.Controls>
        </Carousel.Root>
      )
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    // Each press comes the moment the scroll before it arrives, before that scroll's `scrollend`,
    // which then reaches the carousel while the next page's scroll is under way.
    const pages = [2, 3, 4, 5, 6];
    for (const page of pages) {
      roleNamed("button", `Slide ${page} of 6`).click();
      await settledOn(viewport, (page - 1) * LENGTH);
      expect(currentIndicator(), `after pressing ${page}`).toBe(page - 1);
    }
    await afterPendingTimers();
    expect(currentIndicator()).toBe(5);
    expect(changes).toEqual([
      [1, "indicator"],
      [2, "indicator"],
      [3, "indicator"],
      [4, "indicator"],
      [5, "indicator"],
    ]);
  });
});
