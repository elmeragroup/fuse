import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pollFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { carouselSlides, unsteadyReadings } from "../../../test/carousel-fixtures";
import {
  carouselIndicators,
  carouselViewport,
  currentIndicator,
  settledOn,
} from "../../../test/carousel-queries";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { CarouselIndexChangeReason } from "./carousel-context";
import { useCarousel } from "./carousel-context";
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
});

describe("Carousel structure", () => {
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

describe("Carousel reconciliation", () => {
  it("takes a controlled parent's new slides and index together, with no intermediate change", async () => {
    // Fake timeouts let the final check fire every pending settle timer instead of waiting.
    useFakeTimeouts();
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
    vi.runOnlyPendingTimers();
    await nextFrames(2);
    expect(changes).toEqual([]);
    expect(carouselIndicators()).toHaveLength(2);
    expect(currentIndicator()).toBe(0);
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

describe("Carousel controlled index", () => {
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

/**
 * Unit under test: the Carousel engine's paging in Chromium: a right-to-left `scrollLeft` runs from
 * 0 at the start to negative values, and reports must not trail a scroll. Oracle: each fixture's
 * hand-sized layout, where page N starts N slide lengths from the scroll origin.
 */
describe("paging", () => {
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

  function PagingFixture({
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
            <PagingFixture dir={dir} defaultIndex={2} />
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

  describe("Carousel whose pages shrink under a finger that took over from a waiting press", () => {
    /** A finger held on the viewport until it lifts. */
    type HeldFinger = { readonly lift: () => void };

    /** A finger held on the viewport, put down and lifted as the browser dispatches a touch's pointer. */
    function touchDown(viewport: HTMLElement): HeldFinger {
      const touch = (type: string) =>
        new PointerEvent(type, { pointerId: 1, pointerType: "touch", bubbles: true, composed: true });
      viewport.dispatchEvent(touch("pointerdown"));
      return { lift: () => document.dispatchEvent(touch("pointerup")) };
    }

    /** Jump the viewport to `left`, and wait until its scroll event has reached the carousel. */
    async function scrollInstantly(viewport: HTMLElement, left: number): Promise<void> {
      const scrolled = new Promise<void>((resolve) => {
        viewport.addEventListener("scroll", () => resolve(), { once: true });
      });
      viewport.scrollTo({ left, behavior: "instant" });
      await scrolled;
    }

    it.each([
      ["an uncontrolled Root", false],
      ["a parent that accepts every change", true],
    ] as const)(
      "stays where the finger left it, and reports that page once released, under %s",
      async (_, controlled) => {
        const changes: [number, CarouselIndexChangeReason][] = [];
        const unsteady = unsteadyReadings();
        const { ancestor, slide: unsteadySlide } = unsteady;
        function Shrinking(): ReactElement {
          const [count, setCount] = useState(4);
          const [index, setIndex] = useState(0);
          return withLocale(
            "en-US",
            <>
              <button type="button" onClick={() => setCount(2)}>
                Remove two slides
              </button>
              <div ref={ancestor}>
                <Carousel.Root
                  aria-label="Offers"
                  style={{ width: LENGTH }}
                  index={controlled ? index : undefined}
                  onIndexChange={(next, { reason }) => {
                    changes.push([next, reason]);
                    setIndex(next);
                  }}>
                  <Carousel.Viewport>
                    {Array.from({ length: count }, (__, slide) => (
                      <Carousel.Slide key={slide} ref={unsteadySlide}>
                        <div style={{ height: LENGTH }}>Slide body {slide + 1}</div>
                      </Carousel.Slide>
                    ))}
                  </Carousel.Viewport>
                  <Carousel.Controls>
                    <Carousel.Indicators />
                  </Carousel.Controls>
                </Carousel.Root>
              </div>
            </>
          );
        }
        renderThemed(<Shrinking />);
        const viewport = carouselViewport(roleNamed("region", "Offers"));
        await pollFrames(() => carouselIndicators().length, 4);

        // Page 4 is pressed while no reading holds still, so its scroll to 600px waits for one. A
        // finger then scrolls to page 2 and back to page 1, which takes over from the press. Every
        // unsteady reading retries on the next frame and the engine accepts one only after many in
        // a row, so the steps wait on each scroll's own event, never on time: however loaded the
        // runner, no reading is accepted before the slides go.
        unsteady.start();
        roleNamed("button", "Slide 4 of 4").click();
        const finger = touchDown(viewport);
        await scrollInstantly(viewport, LENGTH);
        await scrollInstantly(viewport, 0);

        // Still held, the last two slides go while the readings come to rest: two pages, at 0 and
        // 200px, and the finger left the viewport on the first.
        unsteady.stop();
        roleNamed("button", "Remove two slides").click();
        await pollFrames(() => carouselIndicators().length, 2);

        // Released, the scroll's end reports page 1, where the finger left it, and nothing moved.
        finger.lift();
        await pollFrames(() => {
          vi.runOnlyPendingTimers();
          return currentIndicator();
        }, 0);
        await afterPendingTimers();
        expect(Math.round(viewport.scrollLeft)).toBe(0);
        expect(changes).toEqual([
          [3, "indicator"],
          [0, "scroll"],
        ]);
      }
    );
  });
});
