/**
 * Unit under test: the Carousel parts in Chromium, through their roles and names. Oracles: the
 * WAI-ARIA APG carousel pattern (roles, role descriptions, names, the picker's `aria-disabled`,
 * the live region, the rotation control), each fixture's hand-sized layout (a slide is a known
 * width, so page N starts N widths in), and the locale rows written out here.
 */
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, wait } from "../../../test/animation-frames";
import {
  assertFocusRingAtBothDensities,
  assertKeyboardFocusRingAtBothDensities,
} from "../../../test/assert-focus-ring";
import { assertNoAxeViolations } from "../../../test/axe";
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
import { expectTargets } from "../../../test/target-size";
import { CONTROL_SM, px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme";
import { useCarousel } from "./carousel-context";
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

describe("Carousel structure", () => {
  it("is a named carousel region of slides named by their place", async () => {
    renderThemed(<Fixture />);
    const region = roleNamed("region", "Offers");
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
    await expect.poll(() => page.getByRole("group", { name: "1 of 4" }).query()).not.toBeNull();
    for (const name of ["1 of 4", "2 of 4", "3 of 4", "4 of 4"]) {
      expect(roleNamed("group", name).getAttribute("aria-roledescription")).toBe("slide");
    }
    await assertNoAxeViolations(region);
  });

  it("speaks the provider's locale", async () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <Carousel.Root aria-label="Tilbud" style={{ width: WIDTH }}>
          <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
          <Carousel.Controls>
            <Carousel.Previous />
            <Carousel.Indicators />
            <Carousel.Next />
            <Carousel.Status />
          </Carousel.Controls>
        </Carousel.Root>
      )
    );
    expect(roleNamed("region", "Tilbud").getAttribute("aria-roledescription")).toBe("karusell");
    await expect.poll(() => page.getByText("1 av 3", { exact: true }).query()).not.toBeNull();
    expect(roleNamed("group", "2 av 3").getAttribute("aria-roledescription")).toBe("lysbilde");
    expect(roleNamed("button", "Forrige lysbilde")).toBeInstanceOf(HTMLButtonElement);
    expect(roleNamed("button", "Neste lysbilde")).toBeInstanceOf(HTMLButtonElement);
    expect(roleNamed("button", "Lysbilde 3 av 3")).toBeInstanceOf(HTMLButtonElement);
    expect(roleNamed("group", "Velg lysbilde")).toBeInstanceOf(HTMLElement);
  });

  it("keeps a consumer's own slide name and role description", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Carousel.Root aria-label="Offers">
          <Carousel.Viewport>
            <Carousel.Slide aria-label="Summer price">Summer</Carousel.Slide>
            <Carousel.Slide aria-roledescription="offer" aria-label={undefined}>
              Winter
            </Carousel.Slide>
          </Carousel.Viewport>
        </Carousel.Root>
      )
    );
    expect(roleNamed("group", "Summer price").getAttribute("aria-roledescription")).toBe("slide");
    // A forwarded `aria-label={undefined}` leaves the automatic name in place.
    await expect.poll(() => page.getByRole("group", { name: "2 of 2" }).query()).not.toBeNull();
    expect(roleNamed("group", "2 of 2").getAttribute("aria-roledescription")).toBe("offer");
  });
});

describe("Carousel pages", () => {
  it("makes one indicator per snap position, not per slide", async () => {
    // Six slides a third of the viewport wide stop at four positions: 0, 1, 2 and 3 slides in.
    renderThemed(<Fixture count={6} perView={3} />);
    await pollFrames(() => carouselIndicators().length, 4);
    expect(carouselIndicators().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Slide 1 of 6",
      "Slide 2 of 6",
      "Slide 3 of 6",
      "Slide 4 of 6",
    ]);
  });

  it("disables Previous on the first page and Next on the last, keeping focus on Next", async () => {
    const { host } = renderThemed(<Fixture count={3} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const previous = roleNamed("button", "Previous slide");
    const next = roleNamed("button", "Next slide");
    await pollFrames(() => carouselIndicators().length, 3);
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(next.getAttribute("aria-disabled")).not.toBe("true");

    await userEvent.click(next);
    await settledOn(viewport, WIDTH);
    expect(currentIndicator()).toBe(1);
    expect(previous.getAttribute("aria-disabled")).not.toBe("true");

    await userEvent.click(next);
    await settledOn(viewport, 2 * WIDTH);
    expect(currentIndicator()).toBe(2);
    expect(next.getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(next);
    // A disabled Next stays put, and keeps focus. Playwright will not click an aria-disabled
    // button, so the click is the element's own.
    next.click();
    await settledOn(viewport, 2 * WIDTH);
    expect(currentIndicator()).toBe(2);
    expect(host.contains(document.activeElement)).toBe(true);
  });

  it("scrolls to the page an indicator names and marks it current for assistive technology", async () => {
    renderThemed(<Fixture count={4} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);
    expect(currentIndicator()).toBe(0);

    await userEvent.click(roleNamed("button", "Slide 3 of 4"));
    await settledOn(viewport, 2 * WIDTH);
    expect(currentIndicator()).toBe(2);
    expect(roleNamed("button", "Slide 3 of 4").hasAttribute("data-current")).toBe(true);
  });

  it("follows a scroll of the viewport itself", async () => {
    renderThemed(<Fixture count={4} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(() => carouselIndicators().length, 4);
    viewport.scrollTo({ left: 3 * WIDTH, behavior: "instant" });
    await pollFrames(currentIndicator, 3);
  });

  it("starts on defaultIndex without a visible scroll", async () => {
    renderThemed(<Fixture count={4} root={{ defaultIndex: 2 }} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // Placed in a layout effect, so the first frame already shows page 3.
    expect(Math.round(viewport.scrollLeft)).toBe(2 * WIDTH);
    await pollFrames(currentIndicator, 2);
  });
});

describe("Carousel slide order and layout changes", () => {
  it("renumbers, re-measures and re-hides keyed slides reordered in place", async () => {
    function Reorderable(): ReactElement {
      const [order, setOrder] = useState(["A", "B", "C", "D"]);
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setOrder((current) => current.toReversed())}>
            Reverse
          </button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
            <Carousel.Viewport>
              {order.map((offer) => (
                <Carousel.Slide key={offer}>
                  <div style={{ height: 80 }}>Offer {offer}</div>
                </Carousel.Slide>
              ))}
            </Carousel.Viewport>
            <Carousel.Controls>
              <Carousel.Indicators />
            </Carousel.Controls>
          </Carousel.Root>
        </>
      );
    }
    renderThemed(<Reorderable />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const names = ["1 of 4", "2 of 4", "3 of 4", "4 of 4"];
    const contents = () => names.map((name) => roleNamed("group", name).textContent);
    const inert = () => names.map((name) => roleNamed("group", name).hasAttribute("inert"));
    // The oracle for "in view" is each slide's own box against the viewport's, read here.
    const outOfView = () =>
      names.map((name) => {
        const slide = roleNamed("group", name).getBoundingClientRect();
        const port = viewport.getBoundingClientRect();
        return Math.min(slide.right, port.right) - Math.max(slide.left, port.left) <= 1;
      });
    await pollFrames(contents, ["Offer A", "Offer B", "Offer C", "Offer D"]);
    await pollFrames(inert, [false, true, true, true]);

    // The same four slides, moved, not remounted: the document now reads D, C, B, A. The browser
    // may keep the slide it had snapped to in view, so the slide in view is read, not assumed.
    await userEvent.click(roleNamed("button", "Reverse"));
    await pollFrames(contents, ["Offer D", "Offer C", "Offer B", "Offer A"]);
    await pollFrames(() => inert().join(), outOfView().join());
    expect(inert().filter((hidden) => !hidden)).toHaveLength(1);

    await userEvent.click(roleNamed("button", "Slide 2 of 4"));
    await settledOn(viewport, WIDTH);
    await pollFrames(inert, [true, false, true, true]);
    expect(outOfView()).toEqual([true, false, true, true]);
    expect(roleNamed("group", "2 of 4").textContent).toBe("Offer C");
  });

  it("keeps its page and reports no change while its viewport is hidden and shown again", async () => {
    const changes: number[] = [];
    function Hideable(): ReactElement {
      const [hidden, setHidden] = useState(false);
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setHidden((current) => !current)}>
            Toggle
          </button>
          <div style={{ display: hidden ? "none" : "block" }}>
            <Carousel.Root
              aria-label="Offers"
              style={{ width: WIDTH }}
              defaultIndex={2}
              onIndexChange={(index) => changes.push(index)}>
              <Carousel.Viewport>{carouselSlides(4, 1)}</Carousel.Viewport>
              <Carousel.Controls>
                <Carousel.Indicators />
              </Carousel.Controls>
            </Carousel.Root>
          </div>
        </>
      );
    }
    renderThemed(<Hideable />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, 2 * WIDTH);

    await userEvent.click(roleNamed("button", "Toggle"));
    await nextFrames(3);
    await userEvent.click(roleNamed("button", "Toggle"));
    await nextFrames(3);
    await settledOn(viewport, 2 * WIDTH);
    expect(currentIndicator()).toBe(2);
    expect(changes).toEqual([]);
  });
});

describe("Carousel reconciliation", () => {
  it("takes a controlled parent's new slides and index together, with no intermediate change", async () => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    function Shrinking(): ReactElement {
      const [shown, setShown] = useState({ count: 4, index: 2 });
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setShown({ count: 2, index: 0 })}>
            Shrink
          </button>
          <Carousel.Root
            aria-label="Offers"
            style={{ width: WIDTH }}
            index={shown.index}
            onIndexChange={(index, { reason }) => {
              changes.push([index, reason]);
              setShown((current) => ({ ...current, index }));
            }}>
            <Carousel.Viewport>{carouselSlides(shown.count, 1)}</Carousel.Viewport>
            <Carousel.Controls>
              <Carousel.Indicators />
            </Carousel.Controls>
          </Carousel.Root>
        </>
      );
    }
    renderThemed(<Shrinking />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, 2 * WIDTH);
    expect(changes).toEqual([]);

    // The parent supplies both the two slides and page 0 in one render: nothing changed the page
    // but the parent, so the carousel reports nothing back.
    await userEvent.click(roleNamed("button", "Shrink"));
    await settledOn(viewport, 0);
    await wait(300);
    expect(changes).toEqual([]);
    expect(carouselIndicators()).toHaveLength(2);
    expect(currentIndicator()).toBe(0);
  });

  it("measures once for a batch of appended slides, however many there are", async () => {
    function Growing(): ReactElement {
      const [count, setCount] = useState(4);
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setCount((current) => current + 10)}>
            Add ten
          </button>
          <button type="button" onClick={() => setCount((current) => current + 20)}>
            Add twenty
          </button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
            <Carousel.Viewport>{carouselSlides(count, 1)}</Carousel.Viewport>
          </Carousel.Root>
        </>
      );
    }
    renderThemed(<Growing />);
    const region = roleNamed("region", "Offers");
    const viewport = carouselViewport(region);
    await expect.poll(() => page.getByRole("group", { name: "4 of 4" }).query()).not.toBeNull();
    await nextFrames(3);

    // Counted per receiver: the viewport's box once per measurement, and each slide's box once, each
    // through one `getClientRects` call, which also tells a box from none. An append is neither a
    // navigation nor the end of a scroll, the two actions that measure again, so the batch's own
    // reconciliation is the only measurement.
    const reads = vi.spyOn(Element.prototype, "getClientRects");
    const counts = () => {
      const receivers = reads.mock.contexts;
      return {
        viewport: receivers.filter((receiver) => receiver === viewport).length,
        slides: receivers.filter(
          (receiver) => receiver instanceof HTMLElement && receiver.parentElement === viewport
        ).length,
      };
    };
    try {
      for (const [button, total] of [
        ["Add ten", 14],
        ["Add twenty", 34],
      ] as const) {
        await userEvent.click(roleNamed("button", button));
        await expect
          .poll(() => page.getByRole("group", { name: `${total} of ${total}` }).query())
          .not.toBeNull();
        await nextFrames(3);
        // One measurement for the whole batch: the viewport once, and every slide, old and new, once.
        expect(counts(), button).toEqual({ viewport: 1, slides: total });
        reads.mockClear();
      }
    } finally {
      reads.mockRestore();
    }
  });
});

describe("Carousel layout inherited from outside it", () => {
  /** Slides spaced by what an ancestor sets, which no box resize and no carousel mutation reports. */
  function Spaced(): ReactElement {
    return withLocale(
      "en-US",
      <div aria-label="Ancestor" role="group">
        {/* What a host stylesheet would write: the slides read a gap the ancestor sets, by a custom
            property or by a breakpoint class. */}
        <style>
          {".offer-slide { margin-inline-end: var(--offer-gap, 0px); } .roomy { --offer-gap: 160px; }"}
        </style>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Viewport>
            {[1, 2, 3, 4].map((offer) => (
              <Carousel.Slide key={offer} className="offer-slide">
                <div style={{ height: 80 }}>Offer {offer}</div>
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

  const names = ["1 of 4", "2 of 4", "3 of 4", "4 of 4"];
  const inert = () => names.map((name) => roleNamed("group", name).hasAttribute("inert"));

  it("pages by the gap an ancestor's custom property sets, after it changes", async () => {
    renderThemed(<Spaced />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(inert, [false, true, true, true]);
    // 240px slides 200px apart start every 440px; set on the ancestor, outside React.
    roleNamed("group", "Ancestor").style.setProperty("--offer-gap", "200px");
    await userEvent.click(roleNamed("button", "Slide 3 of 4"));
    await settledOn(viewport, 880);
    expect(currentIndicator()).toBe(2);
    await pollFrames(inert, [true, true, false, true]);
  });

  it("pages by the spacing a breakpoint class on an ancestor sets, after it changes", async () => {
    renderThemed(<Spaced />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await pollFrames(inert, [false, true, true, true]);
    // 240px slides 160px apart start every 400px.
    roleNamed("group", "Ancestor").classList.add("roomy");
    await userEvent.click(roleNamed("button", "Next slide"));
    await settledOn(viewport, 400);
    expect(currentIndicator()).toBe(1);
    await pollFrames(inert, [true, false, true, true]);
  });
});

describe("Carousel snap grouping set from outside it", () => {
  it("pages by three once an ancestor class leaves only every third slide snapping", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div aria-label="Ancestor" role="group">
          {/* A host rule that pages by groups of three: slides 2, 3, 5 and 6 stop snapping. */}
          <style>{".grouped .grouped-slide:not(:nth-child(3n + 1)) { scroll-snap-align: none; }"}</style>
          <Carousel.Root aria-label="Offers" style={{ width: 300 }}>
            <Carousel.Viewport>
              {[1, 2, 3, 4, 5, 6].map((offer) => (
                <Carousel.Slide key={offer} className="grouped-slide" style={{ flexBasis: `${100 / 3}%` }}>
                  <div style={{ height: 80 }}>Offer {offer}</div>
                </Carousel.Slide>
              ))}
            </Carousel.Viewport>
            <Carousel.Controls>
              <Carousel.Next />
              <Carousel.Indicators />
            </Carousel.Controls>
          </Carousel.Root>
        </div>
      )
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // Six 100px slides in a 300px viewport stop at 0, 100, 200 and 300: four pages.
    await pollFrames(() => carouselIndicators().length, 4);

    // Snapping only at slides 1 and 4 leaves two pages, at 0 and 300. No box resizes and nothing
    // in the carousel mutates; the press reads the layout as it is.
    roleNamed("group", "Ancestor").classList.add("grouped");
    await userEvent.click(roleNamed("button", "Next slide"));
    await settledOn(viewport, 300);
    expect(carouselIndicators()).toHaveLength(2);
    expect(currentIndicator()).toBe(1);
  });
});

describe("Carousel slides hidden by a host rule", () => {
  it("leaves a slide without a layout box out of the pages, the numbers and navigation", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div aria-label="Ancestor" role="group">
          {/* A responsive rule that drops one slide on a compact layout. */}
          <style>{".compact .optional-slide { display: none; }"}</style>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }} defaultIndex={6}>
            <Carousel.Viewport>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((offer) => (
                <Carousel.Slide key={offer} className={offer === 3 ? "optional-slide" : undefined}>
                  <div style={{ height: 80 }}>Offer {offer}</div>
                </Carousel.Slide>
              ))}
            </Carousel.Viewport>
            <Carousel.Controls>
              <Carousel.Previous />
              <Carousel.Indicators />
            </Carousel.Controls>
          </Carousel.Root>
        </div>
      )
    );
    const region = roleNamed("region", "Offers");
    const viewport = carouselViewport(region);
    await settledOn(viewport, 6 * WIDTH);
    const shown = (count: number) => Array.from({ length: count }, (_, index) => `${index + 1} of ${count}`);
    const inView = (count: number) =>
      shown(count).filter((name) => !roleNamed("group", name).hasAttribute("inert"));

    roleNamed("group", "Ancestor").classList.add("compact");
    // Seven slides with a box: seven pages, numbered of seven, and Offer 3 has no number.
    await pollFrames(() => carouselIndicators().length, 7);
    expect(shown(7).map((name) => roleNamed("group", name).textContent)).toEqual([
      "Offer 1",
      "Offer 2",
      "Offer 4",
      "Offer 5",
      "Offer 6",
      "Offer 7",
      "Offer 8",
    ]);
    expect(page.getByRole("group", { name: /of 8$/u }).elements()).toEqual([]);
    // The one slide in view and the current indicator agree, whichever slide the browser kept.
    await pollFrames(() => inView(7).length, 1);
    const [current] = inView(7);
    const number = Number.parseInt(current ?? "", 10);
    await pollFrames(currentIndicator, number - 1);
    await settledOn(viewport, (number - 1) * WIDTH);

    // Previous moves the viewport one slide back, and the selection with it.
    await userEvent.click(roleNamed("button", "Previous slide"));
    await settledOn(viewport, (number - 2) * WIDTH);
    expect(currentIndicator()).toBe(number - 2);
    // The slide left behind turns inert once the scroll has ended, after it lands.
    await pollFrames(() => inView(7), [`${number - 1} of 7`]);

    // Shown again, the slide counts again.
    roleNamed("group", "Ancestor").classList.remove("compact");
    await pollFrames(() => carouselIndicators().length, 8);
    expect(roleNamed("group", "3 of 8").textContent).toBe("Offer 3");
  });
});

describe("Carousel input released outside the viewport", () => {
  /** Four slides and an Outside button, recording every page change. */
  function Recorded({ changes }: { readonly changes: [number, CarouselIndexChangeReason][] }): ReactElement {
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root
          aria-label="Offers"
          style={{ width: WIDTH }}
          onIndexChange={(index, { reason }) => changes.push([index, reason])}>
          <Carousel.Viewport>{carouselSlides(4, 1)}</Carousel.Viewport>
        </Carousel.Root>
      </>
    );
  }

  /** A script's smooth scroll to the last page, which no input of the user's began. */
  async function scriptScrollsToTheEnd(viewport: HTMLElement): Promise<void> {
    viewport.scrollTo({ left: 3 * WIDTH });
    await settledOn(viewport, 3 * WIDTH);
    await wait(300);
  }

  it.each([
    [
      "a mouse press released outside the viewport",
      async (viewport: HTMLElement) => {
        await userEvent.hover(viewport);
        await commands.pointerDown();
        const outside = roleNamed("button", "Outside").getBoundingClientRect();
        await commands.pointerGlide(outside.left + 4, outside.top + 4, 5);
        await commands.pointerUp();
      },
    ],
    [
      "a key whose release lands after Tab has moved focus out",
      async (viewport: HTMLElement) => {
        viewport.focus();
        await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
        expect(document.activeElement).toBe(roleNamed("button", "Outside"));
      },
    ],
    [
      "a mouse press still down when the window loses focus",
      async (viewport: HTMLElement) => {
        await userEvent.hover(viewport);
        await commands.pointerDown();
        // The window loses focus to another one while the button is down, as on Alt+Tab.
        window.dispatchEvent(new FocusEvent("blur"));
      },
    ],
  ] as const)("%s leaves nothing to report the next scroll live", async (_name, input) => {
    const changes: [number, CarouselIndexChangeReason][] = [];
    renderThemed(<Recorded changes={changes} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    try {
      await input(viewport);
      await scriptScrollsToTheEnd(viewport);
      // Reported once it ended, from where it ended: no page it passed.
      expect(changes).toEqual([[3, "scroll"]]);
    } finally {
      await commands.pointerUp();
    }
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
    await pollFrames(() => viewport.scrollLeft > 0, true, 180);
    await wait(500);
    // Repeats until past the last page: three presses reach it, and the later ones scroll nothing.
    for (let repeat = 0; repeat < 5; repeat += 1) {
      await userEvent.keyboard("{ArrowRight>}");
      await wait(400);
    }
    // Still held, so nothing has settled the parent's page back.
    await settledOn(viewport, 3 * WIDTH);
    await userEvent.keyboard("{/ArrowRight}");
    // The parent keeps page 1, so once the key is up the carousel goes back to it.
    await settledOn(viewport, 0);
  });
});

describe("Carousel emptied and filled again", () => {
  it.each(["uncontrolled", "controlled"] as const)(
    "%s: shows the selected page once its slides come back",
    async (mode) => {
      function Emptying(): ReactElement {
        const [count, setCount] = useState(4);
        const [index, setIndex] = useState(2);
        const selection =
          mode === "controlled"
            ? { index, onIndexChange: (next: number) => setIndex(next) }
            : { defaultIndex: 2 };
        return withLocale(
          "en-US",
          <>
            <button type="button" onClick={() => setCount((current) => (current === 0 ? 4 : 0))}>
              Toggle slides
            </button>
            <Carousel.Root aria-label="Offers" style={{ width: WIDTH }} {...selection}>
              <Carousel.Viewport>{carouselSlides(count, 1)}</Carousel.Viewport>
              <Carousel.Controls>
                <Carousel.Indicators />
              </Carousel.Controls>
            </Carousel.Root>
          </>
        );
      }
      renderThemed(<Emptying />);
      const viewport = carouselViewport(roleNamed("region", "Offers"));
      await settledOn(viewport, 2 * WIDTH);

      await userEvent.click(roleNamed("button", "Toggle slides"));
      await expect.poll(() => page.getByRole("group", { name: "1 of 4" }).query()).toBeNull();
      await nextFrames(3);
      await userEvent.click(roleNamed("button", "Toggle slides"));

      // The indicator and the slide in view agree: page 3 is both selected and shown.
      await settledOn(viewport, 2 * WIDTH);
      expect(currentIndicator()).toBe(2);
      await pollFrames(
        () =>
          ["1 of 4", "2 of 4", "3 of 4", "4 of 4"].map((name) =>
            roleNamed("group", name).hasAttribute("inert")
          ),
        [true, true, false, true]
      );
    }
  );
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

  it("draws the shared focus ring on the viewport and an indicator at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Fixture count={3} />
      </>
    );
    await pollFrames(() => carouselIndicators().length, 3);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await assertKeyboardFocusRingAtBothDensities(roleNamed("button", "Before"), viewport);
    // The second and third: the first is current, which Playwright will not click.
    const [, second, third] = carouselIndicators();
    if (second === undefined || third === undefined) {
      throw new Error("expected three indicators");
    }
    await assertFocusRingAtBothDensities(second, third);
  });
});

describe("Carousel targets and sizes", () => {
  it("keeps every indicator a 24px target at both densities, the dot 8px and the pill 28px", async () => {
    renderThemed(<Fixture count={5} />);
    await pollFrames(() => carouselIndicators().length, 5);
    for (const density of DENSITIES) {
      stampDensity(density);
      expectTargets(carouselIndicators(), `${density} indicators`);
      const [current, other] = carouselIndicators().map((button) => getComputedStyle(button, "::after"));
      expect(px(current?.width ?? ""), `${density} pill`).toBe(28);
      expect(px(other?.width ?? ""), `${density} dot`).toBe(8);
      expect(px(other?.height ?? ""), `${density} dot height`).toBe(8);
    }
  });

  it("keeps an indicator with its own small content a 24px target at both densities", async () => {
    renderThemed(
      <Fixture count={3}>
        <Carousel.Indicators>
          {[0, 1, 2].map((index) => (
            <Carousel.Indicator key={index} index={index} aria-label={`Page ${index + 1}`}>
              <span style={{ display: "block", width: 8, height: 8 }} />
            </Carousel.Indicator>
          ))}
        </Carousel.Indicators>
      </Fixture>
    );
    await pollFrames(() => carouselIndicators().length, 3);
    for (const density of DENSITIES) {
      stampDensity(density);
      expectTargets(carouselIndicators(), `${density} custom indicators`);
    }
  });

  it("sizes Previous and Next as Button's small icon square", () => {
    renderThemed(<Fixture count={3} />);
    for (const density of DENSITIES) {
      stampDensity(density);
      for (const name of ["Previous slide", "Next slide"]) {
        const box = roleNamed("button", name).getBoundingClientRect();
        expect(box.height, `${density} ${name}`).toBe(CONTROL_SM[density].height);
        expect(box.width, `${density} ${name}`).toBe(CONTROL_SM[density].height);
      }
    }
  });
});

describe("Carousel controlled index", () => {
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

  it("scrolls back to its index when the parent keeps it", async () => {
    const onIndexChange = vi.fn<(index: number) => void>();
    renderThemed(<Fixture count={4} root={{ index: 1, onIndexChange }} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, WIDTH);
    viewport.scrollTo({ left: 3 * WIDTH, behavior: "instant" });
    await pollFrames(() => onIndexChange.mock.calls.at(-1)?.[0], 3);
    await settledOn(viewport, WIDTH);
    expect(currentIndicator()).toBe(1);
  });
});

describe("Carousel custom parts", () => {
  it("lets a consumer map thumbnails as indicators and read the state through useCarousel", async () => {
    function Count(): ReactElement {
      const { state } = useCarousel();
      return <p>{`Page ${state.index + 1} of ${state.pageCount}`}</p>;
    }
    renderThemed(
      <Fixture count={3}>
        <Carousel.Indicators>
          {["Red", "Green", "Blue"].map((colour, index) => (
            <Carousel.Indicator key={colour} index={index}>
              {colour}
            </Carousel.Indicator>
          ))}
        </Carousel.Indicators>
        <Carousel.Status />
        <Count />
      </Fixture>
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await expect.poll(() => page.getByText("Page 1 of 3", { exact: true }).query()).not.toBeNull();
    expect(roleNamed("button", "Red").getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(roleNamed("button", "Blue"));
    await settledOn(viewport, 2 * WIDTH);
    expect(page.getByText("Page 3 of 3", { exact: true }).query()).not.toBeNull();
    expect(page.getByText("3 of 3", { exact: true }).query()).not.toBeNull();
    expect(roleNamed("button", "Blue").getAttribute("aria-disabled")).toBe("true");
  });

  it("lets a consumer's onClick cancel each control's own action with preventBaseUIHandler", async () => {
    const clicks: string[] = [];
    const cancel = (name: string) => (event: { readonly preventBaseUIHandler: () => void }) => {
      clicks.push(name);
      event.preventBaseUIHandler();
    };
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Outside</button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }} defaultIndex={1}>
            <Carousel.Controls>
              <Carousel.Autoplay delay={60_000} onClick={cancel("autoplay")} />
              <Carousel.Previous onClick={cancel("previous")} />
              <Carousel.Indicators>
                {[0, 1, 2].map((index) => (
                  <Carousel.Indicator
                    key={index}
                    index={index}
                    aria-label={`Page ${index + 1}`}
                    onClick={cancel(`page ${index + 1}`)}
                  />
                ))}
              </Carousel.Indicators>
              <Carousel.Next onClick={cancel("next")} />
            </Carousel.Controls>
            <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
          </Carousel.Root>
        </>
      )
    );
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await settledOn(viewport, WIDTH);
    for (const name of ["Previous slide", "Page 3", "Next slide", "Stop automatic slide show"]) {
      await userEvent.click(roleNamed("button", name));
    }
    await userEvent.hover(roleNamed("button", "Outside"));
    await nextFrames(3);
    expect(clicks).toEqual(["previous", "page 3", "next", "autoplay"]);
    expect(Math.round(viewport.scrollLeft)).toBe(WIDTH);
    expect(roleNamed("button", "Page 2").getAttribute("aria-disabled")).toBe("true");
    // Neither the cancelled controls nor the cancelled rotation control stopped rotation.
    expect(roleNamed("button", "Stop automatic slide show")).toBeInstanceOf(HTMLButtonElement);
  });

  it("throws a named error for a part outside Carousel.Root", async () => {
    renderThemed(
      <CaughtError>
        <Carousel.Next />
      </CaughtError>
    );
    await pollFrames(() => caughtError().message, "Carousel.Next must be used within Carousel.Root.");
  });
});
