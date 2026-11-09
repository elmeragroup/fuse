/**
 * Unit under test: the Carousel engine's position math in Chromium, Firefox and WebKit, which
 * report scroll positions their own way: a right-to-left `scrollLeft` runs from 0 at the start
 * to negative values, and WebKit may end a scroll without `scrollend`. Oracle: each fixture's
 * hand-sized layout, where page N starts N slide lengths from the scroll origin.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, wait } from "../../../test/animation-frames";
import { carouselViewport, currentIndicator, settledOn } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { CarouselIndexChangeReason } from "./carousel-context";
import type { CarouselOrientation } from "./carousel-engine";
import { Carousel } from "./index";

/** The slide length on the scroll axis. */
const LENGTH = 200;

function Fixture({
  orientation = "horizontal",
  dir = "ltr",
  defaultIndex = 0,
}: {
  readonly orientation?: CarouselOrientation;
  readonly dir?: "ltr" | "rtl";
  readonly defaultIndex?: number;
}): ReactElement {
  const vertical = orientation === "vertical";
  return withLocale(
    "en-US",
    <div dir={dir}>
      <Carousel.Root
        aria-label="Offers"
        orientation={orientation}
        style={{ width: LENGTH }}
        defaultIndex={defaultIndex}>
        <Carousel.Viewport style={vertical ? { height: LENGTH } : undefined}>
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

describe.each([
  { name: "left to right", orientation: "horizontal", dir: "ltr", read: (v: HTMLElement) => v.scrollLeft },
  // A right-to-left viewport's `scrollLeft` is 0 at the start and negative toward the end.
  { name: "right to left", orientation: "horizontal", dir: "rtl", read: (v: HTMLElement) => -v.scrollLeft },
  { name: "vertical", orientation: "vertical", dir: "ltr", read: (v: HTMLElement) => v.scrollTop },
] as const)("Carousel $name", ({ orientation, dir, read }) => {
  it("stops a directional scroll of nearly two slides at the next slide", async () => {
    renderThemed(<Fixture orientation={orientation} dir={dir} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    // A relative scroll is directional, so `scroll-snap-stop: always` on each slide stops it at
    // the first slide it would pass, though the second is the snap position nearest 1.8 slides in.
    const distance = 1.8 * LENGTH;
    viewport.scrollBy(
      orientation === "vertical"
        ? { top: distance, behavior: "instant" }
        : { left: dir === "rtl" ? -distance : distance, behavior: "instant" }
    );
    await pollFrames(() => Math.round(read(viewport)), LENGTH, 180);
    // The indicator follows once the scroll has ended, and nothing moves on afterwards.
    await pollFrames(currentIndicator, 1);
    await wait(300);
    expect(Math.round(read(viewport))).toBe(LENGTH);
    expect(currentIndicator()).toBe(1);
  });

  it("scrolls to the page a control asks for and lands on its snap position", async () => {
    renderThemed(<Fixture orientation={orientation} dir={dir} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);

    await userEvent.click(roleNamed("button", "Next slide"));
    await pollFrames(() => Math.round(read(viewport)), LENGTH, 180);
    expect(currentIndicator()).toBe(1);

    await userEvent.click(roleNamed("button", "Slide 4 of 4"));
    await pollFrames(() => Math.round(read(viewport)), 3 * LENGTH, 180);
    expect(currentIndicator()).toBe(3);
    expect(roleNamed("button", "Next slide").getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(roleNamed("button", "Previous slide"));
    await pollFrames(() => Math.round(read(viewport)), 2 * LENGTH, 180);
    expect(currentIndicator()).toBe(2);
  });

  it("follows the page a native scroll lands on", async () => {
    renderThemed(<Fixture orientation={orientation} dir={dir} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    const physical = orientation === "vertical" ? "top" : "left";
    const sign = dir === "rtl" ? -1 : 1;
    viewport.scrollTo({ [physical]: sign * 2 * LENGTH, behavior: "instant" });
    await pollFrames(currentIndicator, 2);
    viewport.scrollTo({ [physical]: sign * LENGTH, behavior: "instant" });
    await pollFrames(currentIndicator, 1);
  });

  it("shows only the slide in view to assistive technology", async () => {
    renderThemed(<Fixture orientation={orientation} dir={dir} />);
    const inert = () =>
      ["1 of 4", "2 of 4", "3 of 4", "4 of 4"].map((name) => roleNamed("group", name).hasAttribute("inert"));
    await pollFrames(inert, [false, true, true, true]);
    await userEvent.click(roleNamed("button", "Slide 3 of 4"));
    await pollFrames(inert, [true, true, false, true], 180);
  });
});

describe("Carousel direction change", () => {
  it.each([
    ["ltr", "rtl"],
    ["rtl", "ltr"],
  ] as const)("follows a switch from %s to %s that resizes nothing", async (from, to) => {
    function Switching(): ReactElement {
      const [dir, setDir] = useState<"ltr" | "rtl">(from);
      return (
        <>
          <button type="button" onClick={() => setDir(to)}>
            Switch direction
          </button>
          <Fixture dir={dir} />
        </>
      );
    }
    renderThemed(<Switching />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(currentIndicator, 0);
    await userEvent.click(roleNamed("button", "Switch direction"));

    // After the switch, `scrollLeft` runs negative toward the end exactly when the carousel is
    // right to left.
    const logical = () => (to === "rtl" ? -viewport.scrollLeft : viewport.scrollLeft);
    await userEvent.click(roleNamed("button", "Next slide"));
    await pollFrames(() => Math.round(logical()), LENGTH, 180);
    expect(currentIndicator()).toBe(1);
    await userEvent.click(roleNamed("button", "Slide 4 of 4"));
    await pollFrames(() => Math.round(logical()), 3 * LENGTH, 180);
    expect(currentIndicator()).toBe(3);
  });
});

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
    expect(page.getByRole("group", { name: "Choose slide to display" }).element().children).toHaveLength(4);
    await pollFrames(inert, [true, true, false, true]);

    await userEvent.click(roleNamed("button", "Previous slide"));
    await pollFrames(logical(to === "rtl"), LENGTH, 180);
    expect(currentIndicator()).toBe(1);
    await pollFrames(inert, [true, false, true, true]);
  });
});

describe("Carousel mounted at zero scale", () => {
  it("waits for a measurable layout, then places its page once the ancestor scales up", async () => {
    function Growing(): ReactElement {
      const [scale, setScale] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setScale(1)}>
            Grow
          </button>
          {/* As an opening popup animates: from nothing, over a transition. */}
          <div
            style={{ transform: `scale(${scale})`, transformOrigin: "0 0", transition: "transform 300ms" }}>
            <Fixture defaultIndex={2} />
          </div>
        </>
      );
    }
    renderThemed(<Growing />);
    // At zero scale nothing paints, so the carousel has no role to find yet, and it must stay
    // settled meanwhile rather than render without end.
    await nextFrames(2);

    await userEvent.click(roleNamed("button", "Grow"));
    await expect.poll(() => page.getByRole("region", { name: "Offers" }).query()).not.toBeNull();
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, 2 * LENGTH);
    await pollFrames(currentIndicator, 2);
    const names = ["1 of 4", "2 of 4", "3 of 4", "4 of 4"];
    await pollFrames(
      () => names.map((name) => roleNamed("group", name).hasAttribute("inert")),
      [true, true, false, true]
    );
  });
});

describe("Carousel under a scaled ancestor", () => {
  it.each(["horizontal", "vertical"] as const)(
    "%s: pages and hides slides by the viewport's own scroll coordinates at half scale",
    async (orientation) => {
      // A transform scales what the viewport paints, not its scroll range: a 200px slide still
      // starts 200 scroll px after the last, though it paints 100px after it.
      renderThemed(
        <div style={{ transform: "scale(0.5)", transformOrigin: "0 0" }}>
          <Fixture orientation={orientation} />
        </div>
      );
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      const read = () => (orientation === "vertical" ? viewport.scrollTop : viewport.scrollLeft);
      const names = ["1 of 4", "2 of 4", "3 of 4", "4 of 4"];
      const inert = () => names.map((name) => roleNamed("group", name).hasAttribute("inert"));
      await pollFrames(inert, [false, true, true, true]);

      await userEvent.click(roleNamed("button", "Next slide"));
      await pollFrames(() => Math.round(read()), LENGTH, 180);
      expect(currentIndicator()).toBe(1);
      await pollFrames(inert, [true, false, true, true]);

      viewport.scrollTo(
        orientation === "vertical"
          ? { top: 3 * LENGTH, behavior: "instant" }
          : { left: 3 * LENGTH, behavior: "instant" }
      );
      await pollFrames(currentIndicator, 3);
      await pollFrames(inert, [true, true, true, false]);
    }
  );
});

/**
 * Twelve slides three to a 360px viewport, so 120px each, placed on page 7 by `defaultIndex`. An
 * ancestor's `--spaced-gap` gives every slide a trailing gap along the axis, which nothing in the
 * carousel observes.
 */
function Spaced({
  orientation = "horizontal",
  dir = "ltr",
  onIndexChange,
}: {
  readonly orientation?: CarouselOrientation;
  readonly dir?: "ltr" | "rtl";
  readonly onIndexChange: (index: number, details: { readonly reason: CarouselIndexChangeReason }) => void;
}): ReactElement {
  const vertical = orientation === "vertical";
  const margin = vertical ? "margin-block-end" : "margin-inline-end";
  return withLocale(
    "en-US",
    <div aria-label="Ancestor" role="group" dir={dir}>
      <style>{`.spaced-slide { ${margin}: var(--spaced-gap, 0px); }`}</style>
      <Carousel.Root
        aria-label="Offers"
        orientation={orientation}
        style={{ width: 360 }}
        defaultIndex={6}
        onIndexChange={onIndexChange}>
        <Carousel.Viewport style={vertical ? { height: 360 } : undefined}>
          {Array.from({ length: 12 }, (_, slide) => (
            <Carousel.Slide key={slide} className="spaced-slide" style={{ flexBasis: `${100 / 3}%` }}>
              <div style={vertical ? undefined : { height: 80 }}>Offer {slide + 1}</div>
            </Carousel.Slide>
          ))}
        </Carousel.Viewport>
        <Carousel.Controls>
          <Carousel.Next />
          <Carousel.Indicators />
        </Carousel.Controls>
      </Carousel.Root>
    </div>
  );
}

describe("Carousel spacing inherited while a later page is selected", () => {
  // CSS Scroll Snap 1 § 6.2 has the browser re-snap to the slide it was snapped to, so slide 7
  // stays at the start, now 6 × (120 + gap) in. With a 24px gap the old 720px is still a snap
  // position, slide 6's, and with a 20px gap the nearest one is 700px, slide 6's too: a re-snap to
  // the nearest position instead of the same slide would show slide 6. In the same task as the
  // first placement, Firefox does not re-snap that placement's slide, so the engine, whose own
  // scroll it was, puts its page back; later, every engine re-snaps it itself.
  it.each([
    { gap: 24, page7: 864, page8: 1008, when: "with the first placement" },
    { gap: 20, page7: 840, page8: 980, when: "with the first placement" },
    { gap: 24, page7: 864, page8: 1008, when: "once it has settled" },
  ] as const)(
    "keeps page 7 through a $gap px gap that arrives $when, and pages on from it",
    async ({ gap, page7, page8, when }) => {
      const changes: [number, CarouselIndexChangeReason][] = [];
      renderThemed(<Spaced onIndexChange={(index, { reason }) => changes.push([index, reason])} />);
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      // Page 7 starts six slides in, at 6 × 120 = 720px.
      expect(Math.round(viewport.scrollLeft)).toBe(720);
      if (when === "once it has settled") {
        await wait(400);
        expect(currentIndicator()).toBe(6);
      }

      roleNamed("group", "Ancestor").style.setProperty("--spaced-gap", `${gap}px`);
      await settledOn(viewport, page7);
      await wait(400);
      expect(Math.round(viewport.scrollLeft)).toBe(page7);
      expect(currentIndicator()).toBe(6);
      expect(changes).toEqual([]);

      // Next goes to page 8, slide 8 at 7 × (120 + gap).
      await userEvent.click(roleNamed("button", "Next slide"));
      await settledOn(viewport, page8);
      expect(currentIndicator()).toBe(7);
      expect(changes).toEqual([[7, "next"]]);
    }
  );
});

describe.each([
  { name: "left to right", orientation: "horizontal", dir: "ltr", read: (v: HTMLElement) => v.scrollLeft },
  { name: "right to left", orientation: "horizontal", dir: "rtl", read: (v: HTMLElement) => -v.scrollLeft },
  { name: "vertical", orientation: "vertical", dir: "ltr", read: (v: HTMLElement) => v.scrollTop },
] as const)("Carousel $name scrolled by a script as its spacing changes", ({ orientation, dir, read }) => {
  it("selects and reports the slide the script scrolled to", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    renderThemed(
      <Spaced
        orientation={orientation}
        dir={dir}
        onIndexChange={(index, { reason }) => changes.push([index, reason])}
      />
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => Math.round(read(viewport)), 720);
    await wait(400);
    expect(currentIndicator()).toBe(6);

    // In one task: a 24px gap moves slide 7 to 864px and slide 6 to 720px, and a script scrolls to
    // slide 6 there, where page 7 started before.
    roleNamed("group", "Ancestor").style.setProperty("--spaced-gap", "24px");
    const along = dir === "rtl" ? -720 : 720;
    viewport.scrollTo(
      orientation === "vertical" ? { top: 720, behavior: "instant" } : { left: along, behavior: "instant" }
    );
    await pollFrames(currentIndicator, 5, 180);
    await wait(400);
    expect(Math.round(read(viewport))).toBe(720);
    expect(currentIndicator()).toBe(5);
    expect(changes).toEqual([[5, "scroll"]]);
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
      await wait(300);
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
          <Carousel.Viewport>
            {[1, 2, 3, 4, 5, 6].map((offer) => (
              <Carousel.Slide key={offer}>
                <div style={{ height: 80 }}>Offer {offer}</div>
              </Carousel.Slide>
            ))}
          </Carousel.Viewport>
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
    await wait(400);
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

describe("Carousel caret direction", () => {
  it("points Previous toward the start: mirrored right to left", () => {
    renderThemed(
      <>
        <Fixture />
        <Fixture dir="rtl" />
      </>
    );
    const [ltr, rtl] = page
      .getByRole("button", { name: "Previous slide", exact: true })
      .elements()
      .map((button) => button.querySelector("svg"));
    if (ltr === undefined || ltr === null || rtl === undefined || rtl === null) {
      throw new Error("expected both Previous carets");
    }
    expect(getComputedStyle(ltr).scale).toBe("none");
    // A horizontal scale of -1 mirrors the left caret so it points right.
    expect(getComputedStyle(rtl).scale).toBe("-1 1");
  });
});
