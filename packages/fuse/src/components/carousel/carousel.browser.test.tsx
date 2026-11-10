import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { pollFrames } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import {
  carouselIndicators,
  carouselViewport,
  currentIndicator,
  settledOn,
} from "../../../test/carousel-queries";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { CarouselIndexChangeReason } from "./carousel-context";
import { Carousel } from "./index";

/** The fixture's slide width, so page N's slide starts N × WIDTH into the scroll range. */
const WIDTH = 240;

type FixtureProps = {
  readonly count?: number;
  /** Slides per view, through a basis class, as a consumer sizes them. */
  readonly perView?: 1 | 3;
  readonly children?: ReactNode;
  readonly root?: Partial<Parameters<typeof Carousel.Root>[0]>;
};

function Fixture({ count = 4, perView = 1, children, root }: FixtureProps): ReactElement {
  return withLocale(
    "en-US",
    <Carousel.Root aria-label="Offers" style={{ width: WIDTH }} {...root}>
      <Carousel.Viewport>{carouselSlides(count, perView)}</Carousel.Viewport>
      {children ?? (
        <Carousel.Controls>
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
      )}
    </Carousel.Root>
  );
}

afterEach(() => {
  document.documentElement.removeAttribute("data-density");
});

describe("Carousel roles and controls", () => {
  it("is a named carousel region of slides named by their place", async () => {
    renderThemed(<Fixture />);
    expect(roleNamed("region", "Offers").getAttribute("aria-roledescription")).toBe("carousel");
    await expect.poll(() => page.getByRole("group", { name: "1 of 4" }).query()).not.toBeNull();
    for (const name of ["1 of 4", "2 of 4", "3 of 4", "4 of 4"]) {
      expect(roleNamed("group", name).getAttribute("aria-roledescription")).toBe("slide");
    }
  });

  it("disables Previous on the first page and Next on the last, keeping focus on Next", async () => {
    renderThemed(<Fixture count={3} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const previous = roleNamed("button", "Previous slide");
    const next = roleNamed("button", "Next slide");
    await pollFrames(() => carouselIndicators().length, 3);
    expect(previous.getAttribute("aria-disabled")).toBe("true");

    await userEvent.click(next);
    await userEvent.click(next);
    await settledOn(viewport, 2 * WIDTH);
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(previous.getAttribute("aria-disabled")).not.toBe("true");
    // Playwright will not click an aria-disabled button, so the click is the element's own.
    next.click();
    await settledOn(viewport, 2 * WIDTH);
    expect(document.activeElement).toBe(next);
  });

  it("reports each change with its reason and scrolls to an index the parent sets", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    function Controlled(): ReactElement {
      const [index, setIndex] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setIndex(3)}>
            Jump to last
          </button>
          <Fixture
            count={4}
            root={{
              index,
              onIndexChange: (next, { reason }) => {
                changes.push([next, reason]);
                setIndex(next);
              },
            }}
          />
        </>
      );
    }
    renderThemed(<Controlled />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);

    await userEvent.click(roleNamed("button", "Next slide"));
    await settledOn(viewport, WIDTH);
    await userEvent.click(roleNamed("button", "Slide 3 of 4"));
    await settledOn(viewport, 2 * WIDTH);
    expect(roleNamed("button", "Slide 3 of 4").getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(roleNamed("button", "Previous slide"));
    await settledOn(viewport, WIDTH);
    viewport.scrollTo({ left: 0, behavior: "instant" });
    await pollFrames(currentIndicator, 0);
    expect(changes).toEqual([
      [1, "next"],
      [2, "indicator"],
      [1, "previous"],
      [0, "scroll"],
    ]);

    await userEvent.click(roleNamed("button", "Jump to last"));
    await settledOn(viewport, 3 * WIDTH);
    expect(currentIndicator()).toBe(3);
  });
});

describe("Carousel held keys", () => {
  it("returns a controlled carousel to its page once a held arrow key is released", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }} index={0}>
          <Carousel.Viewport>{carouselSlides(4, 1)}</Carousel.Viewport>
        </Carousel.Root>
      )
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    viewport.focus();
    // Held: the first press scrolls, and its scroll ends while the key is still down, so its settle
    // waits for the release. The key then repeats, each repeat new input on the viewport.
    await userEvent.keyboard("{ArrowRight>}");
    await settledOn(viewport, WIDTH);
    // Repeats until past the last page: three presses reach it, and the later ones scroll nothing.
    for (let repeat = 0; repeat < 5; repeat += 1) {
      await userEvent.keyboard("{ArrowRight>}");
      await settledOn(viewport, Math.min(repeat + 2, 3) * WIDTH);
    }
    // Still held, so nothing has settled the parent's page back.
    await settledOn(viewport, 3 * WIDTH);
    await userEvent.keyboard("{/ArrowRight}");
    // The parent keeps page 1, so once the key is up the carousel goes back to it.
    await settledOn(viewport, 0);
  });
});

describe("Carousel keyboard and focus", () => {
  it("scrolls one page per arrow key once the viewport has focus", async () => {
    renderThemed(<Fixture count={4} />);
    const region = roleNamed("region", "Offers");
    const viewport = carouselViewport(region);
    await pollFrames(() => carouselIndicators().length, 4);
    viewport.focus();
    await userEvent.keyboard("{ArrowRight}");
    await pollFrames(currentIndicator, 1, 180);
    await settledOn(viewport, WIDTH);
  });

  it("leaves a field's arrow keys to the field", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Viewport>
            <Carousel.Slide>
              <input aria-label="Postcode" defaultValue="0150" />
            </Carousel.Slide>
            <Carousel.Slide>Second</Carousel.Slide>
          </Carousel.Viewport>
        </Carousel.Root>
      )
    );
    const field = roleNamed("textbox", "Postcode");
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.click(field);
    await userEvent.keyboard("{End}{ArrowLeft}{ArrowLeft}{ArrowRight}");
    expect(field instanceof HTMLInputElement ? field.selectionStart : null).toBe(3);
    expect(viewport.scrollLeft).toBe(0);
  });

  it("keeps slides out of view inert, and the ones in view or holding focus reachable", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Viewport>
            {["First", "Second", "Third"].map((label) => (
              <Carousel.Slide key={label}>
                <a href="#offer">{label} offer</a>
              </Carousel.Slide>
            ))}
          </Carousel.Viewport>
          <Carousel.Controls>
            <Carousel.Next />
          </Carousel.Controls>
        </Carousel.Root>
      )
    );
    await expect.poll(() => page.getByRole("group", { name: "3 of 3" }).query()).not.toBeNull();
    const inert = () =>
      ["1 of 3", "2 of 3", "3 of 3"].map((name) => roleNamed("group", name).hasAttribute("inert"));
    await pollFrames(inert, [false, true, true]);

    // A slide that holds focus stays reachable while it scrolls out, and turns inert once focus
    // leaves it.
    roleNamed("link", "First offer").focus();
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    viewport.scrollTo({ left: WIDTH, behavior: "instant" });
    await pollFrames(inert, [false, false, true]);
    expect(document.activeElement).toBe(roleNamed("link", "First offer"));
    roleNamed("button", "Next slide").focus();
    await pollFrames(inert, [true, false, true]);
  });
});

describe("Carousel custom parts", () => {
  it("throws a named error for a part outside Carousel.Root", async () => {
    renderThemed(
      <CaughtError>
        <Carousel.Next />
      </CaughtError>
    );
    await pollFrames(() => caughtError().message, "Carousel.Next must be used within Carousel.Root.");
  });
});
