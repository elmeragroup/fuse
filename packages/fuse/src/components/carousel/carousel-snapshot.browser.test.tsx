/**
 * Unit under test: which parts the Root re-renders when its measurement changes, in Chromium.
 * Oracle: the fixture's hand-sized layout (a slide is a known width, so a quarter-width scroll
 * brings slide 2 into view while page 1 stays nearest) and the contract that a change to the
 * slides in view alone leaves `useCarousel()`'s `state`, `actions` and `meta` as they were, so a
 * caller that reads only them commits nothing.
 */
import { useLayoutEffect } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { wait } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import { carouselViewport } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { useCarousel } from "./carousel-context";
import { Carousel } from "./index";

/** The fixture's slide width, so a quarter of it is a quarter of the way to page 2. */
const WIDTH = 240;

describe("Carousel snapshot", () => {
  it("does not re-render a useCarousel caller when only the slides in view change", async () => {
    // Each commit that re-renders the caller runs its layout effect once. A React <Profiler>'s
    // onRender does not report a context-only re-render here, so the effect counts instead.
    let commits = 0;
    function Count(): ReactElement {
      useLayoutEffect(() => {
        commits += 1;
      });
      const { state } = useCarousel();
      return <p>{`Page ${state.index + 1} of ${state.pageCount}`}</p>;
    }
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          {/* Without snapping, a scroll can rest a quarter of a slide in, on no page of its own. */}
          <Carousel.Viewport style={{ scrollSnapType: "none", scrollBehavior: "auto" }}>
            {carouselSlides(4, 1)}
          </Carousel.Viewport>
          <Count />
        </Carousel.Root>
      )
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await expect.poll(() => page.getByText("Page 1 of 4", { exact: true }).query()).not.toBeNull();
    await expect.poll(() => roleNamed("group", "2 of 4").hasAttribute("inert")).toBe(true);
    // Let the mount's own scroll end and its commits land before counting.
    await wait(300);
    const before = commits;

    // A quarter of the way to page 2: slide 2 peeks into view, and page 1 is still nearest.
    viewport.scrollLeft = WIDTH / 4;
    await expect.poll(() => roleNamed("group", "2 of 4").hasAttribute("inert")).toBe(false);
    // Past the scroll's end, which a quiet spell or `scrollend` reports.
    await wait(300);
    expect(page.getByText("Page 1 of 4", { exact: true }).query()).not.toBeNull();
    expect(commits).toBe(before);
  });
});
