/**
 * Unit under test: Carousel rotation in Chromium, through the rotation control's name and the
 * current indicator. Oracles: the APG carousel pattern (rotation pauses on hover, stops on keyboard
 * focus and any other user action, restarts only from the rotation control, which then keeps it
 * running) and WCAG 2.2.2, under which rotation the user did not ask for stays stopped.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pendingTimeout, pollFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import { carouselIndicators, carouselViewport, currentIndicator } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

/** The fixture's slide width, so page N's slide starts N × WIDTH into the scroll range. */
const WIDTH = 240;

/** The autoplay delay every fixture sets, the time {@link turn} moves the page's clock on. */
const DELAY = 200;

// The page's timeouts are fake, so rotation turns a page only when a test moves the clock: a slow
// runner can neither skip a page nor turn one early.
beforeEach(() => {
  useFakeTimeouts();
});

/**
 * Waits for rotation to arm its next turn, moves the page's clock past one autoplay delay, then
 * waits for the page it turns to. Rotation arms each turn in an effect after the render that shows
 * the page before it, so the clock moves only once that turn is pending.
 *
 * @param expected - The indicator that should then be current.
 */
async function turn(expected: number): Promise<void> {
  await pendingTimeout();
  vi.advanceTimersByTime(DELAY);
  await pollFrames(currentIndicator, expected);
}

/** Moves the page's clock past several delays and checks the first page is still current. */
async function staysOnFirstPage(): Promise<void> {
  vi.advanceTimersByTime(DELAY * 5);
  await nextFrames(2);
  expect(currentIndicator()).toBe(0);
}

describe("Carousel autoplay", () => {
  function AutoplayFixture(): ReactElement {
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Controls>
            <Carousel.Autoplay delay={DELAY} />
            <Carousel.Previous />
            <Carousel.Indicators />
            <Carousel.Next />
          </Carousel.Controls>
          <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
        </Carousel.Root>
      </>
    );
  }

  it("rotates every delay, rewinds from the last page, and silences the live region meanwhile", async () => {
    renderThemed(<AutoplayFixture />);
    await userEvent.hover(roleNamed("button", "Outside"));
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    expect(roleNamed("button", "Stop automatic slide show").hasAttribute("aria-pressed")).toBe(false);
    expect(viewport.getAttribute("aria-live")).toBe("off");
    await turn(1);
    await turn(2);
    await turn(0);
  });

  it("pauses while hovered and resumes when the pointer leaves", async () => {
    renderThemed(<AutoplayFixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(viewport);
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("polite");
    await staysOnFirstPage();
    expect(roleNamed("button", "Stop automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await userEvent.hover(roleNamed("button", "Outside"));
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("off");
    await turn(1);
  });

  it("stops for good when keyboard focus lands on the rotation control or anywhere else in it", async () => {
    renderThemed(<AutoplayFixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(roleNamed("button", "Outside"));
    roleNamed("button", "Outside").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Start automatic slide show"));
    // Moving on through the carousel and out of it does not resume it.
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Previous slide"));
    await userEvent.keyboard("{Shift>}{Tab}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("button", "Outside"));
    await staysOnFirstPage();
    expect(viewport.getAttribute("aria-live")).toBe("polite");
  });

  it("pauses while the document is hidden", async () => {
    renderThemed(<AutoplayFixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // The test page cannot be hidden, so the document reports hidden through its own property.
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await userEvent.hover(roleNamed("button", "Outside"));
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("polite");
    await staysOnFirstPage();
    visibility.mockRestore();
    document.dispatchEvent(new Event("visibilitychange"));
    // The render that reads the visible document schedules the next turn.
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("off");
    await turn(1);
  });

  it("stops for good when a control changes the page, until the user starts it", async () => {
    renderThemed(<AutoplayFixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    roleNamed("button", "Next slide").click();
    await userEvent.hover(roleNamed("button", "Outside"));
    await pollFrames(currentIndicator, 1);
    expect(roleNamed("button", "Start automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    expect(viewport.getAttribute("aria-live")).toBe("polite");
    vi.advanceTimersByTime(DELAY * 5);
    await nextFrames(2);
    expect(currentIndicator()).toBe(1);

    await userEvent.click(roleNamed("button", "Start automatic slide show"));
    await userEvent.hover(roleNamed("button", "Outside"));
    await turn(2);
  });

  it("stays stopped when its delay changes", async () => {
    function Configurable(): ReactElement {
      const [delay, setDelay] = useState(DELAY);
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setDelay(DELAY + 50)}>
            Slower
          </button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
            <Carousel.Controls>
              <Carousel.Autoplay delay={delay} />
              <Carousel.Indicators />
            </Carousel.Controls>
            <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
          </Carousel.Root>
        </>
      );
    }
    renderThemed(<Configurable />);
    roleNamed("button", "Stop automatic slide show").click();
    await userEvent.click(roleNamed("button", "Slower"));
    await nextFrames(2);
    expect(roleNamed("button", "Start automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await staysOnFirstPage();
  });

  it("keeps rotating after the user presses Play, through focus on the control, hover and Tab", async () => {
    renderThemed(<AutoplayFixture />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(roleNamed("button", "Outside"));
    roleNamed("button", "Outside").focus();
    await userEvent.keyboard("{Tab}");
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();

    // An explicit Play: focus stays on the control, and rotation runs.
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(roleNamed("button", "Stop automatic slide show"));
    await turn(1);

    // Neither the pointer over the slides nor keyboard focus moving inside pauses it now.
    await userEvent.hover(viewport);
    await turn(2);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Previous slide"));
    await turn(0);
    expect(viewport.getAttribute("aria-live")).toBe("off");
  });
});

describe("Carousel autoplay that mounts late", () => {
  function Late({ onShow }: { readonly onShow: (show: () => void) => void }): ReactElement {
    const [shown, setShown] = useState(false);
    onShow(() => setShown(true));
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Controls>
            {shown ? <Carousel.Autoplay delay={DELAY} /> : null}
            <Carousel.Previous />
            <Carousel.Indicators />
            <Carousel.Next />
          </Carousel.Controls>
          <Carousel.Viewport>{carouselSlides(4, 1)}</Carousel.Viewport>
        </Carousel.Root>
      </>
    );
  }

  function renderLate(): () => void {
    let show: () => void = () => undefined;
    renderThemed(
      <Late
        onShow={(next) => {
          show = next;
        }}
      />
    );
    return () => show();
  }

  it("starts paused when the pointer is already over the carousel", async () => {
    const show = renderLate();
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await expect.poll(() => carouselIndicators().length).toBe(4);
    await userEvent.hover(viewport);
    show();
    // Rotating, as nothing stopped it, but paused under the pointer.
    await expect
      .poll(() => page.getByRole("button", { name: "Stop automatic slide show" }).query())
      .not.toBeNull();
    expect(viewport.getAttribute("aria-live")).toBe("polite");
    await staysOnFirstPage();
    // The pointer leaving resumes it: the hover paused it and stopped nothing.
    await userEvent.hover(roleNamed("button", "Outside"));
    await turn(1);
  });

  it("starts stopped when keyboard focus is already inside the carousel", async () => {
    const show = renderLate();
    await expect.poll(() => carouselIndicators().length).toBe(4);
    await userEvent.hover(roleNamed("button", "Outside"));
    roleNamed("button", "Outside").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Previous slide"));
    show();
    // APG: keyboard focus inside stops rotation, and only the rotation control starts it.
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await staysOnFirstPage();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("button", "Start automatic slide show"));
    await userEvent.keyboard("{Enter}");
    await turn(1);
  });
});

describe("Carousel autoplay that mounts with focus already moving in", () => {
  /** A carousel mounted with its Autoplay in one commit, with `focusable` autofocused in slide 1. */
  function Autofocused({ focusable }: { readonly focusable: ReactElement }): ReactElement {
    return (
      <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
        <Carousel.Controls>
          <Carousel.Autoplay delay={DELAY} />
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
        <Carousel.Viewport>
          <Carousel.Slide>
            <div style={{ height: 80 }}>{focusable}</div>
          </Carousel.Slide>
          {carouselSlides(3, 1)}
        </Carousel.Viewport>
      </Carousel.Root>
    );
  }

  /**
   * A page that mounts the carousel when Open is pressed, as a dialog or a route change would. A
   * keyboard press mounts it already stopped; a mouse press leaves it rotating.
   */
  function Opener({ focusable }: { readonly focusable: ReactElement }): ReactElement {
    const [open, setOpen] = useState(false);
    return withLocale(
      "en-US",
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        {open ? <Autofocused focusable={focusable} /> : null}
      </>
    );
  }

  it("starts stopped when an autofocused field takes keyboard focus as the carousel mounts", async () => {
    renderThemed(<Opener focusable={<input aria-label="Code" autoFocus />} />);
    await userEvent.hover(roleNamed("button", "Open"));
    roleNamed("button", "Open").focus();
    await userEvent.keyboard("{Enter}");
    const field = roleNamed("textbox", "Code");
    expect(document.activeElement).toBe(field);
    // The precondition: the browser counts this focus as keyboard focus.
    expect(field.matches(":focus-visible")).toBe(true);
    // APG: keyboard focus inside stops rotation, and only the rotation control starts it.
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await staysOnFirstPage();
    expect(carouselViewport(roleNamed("region", "Offers")).getAttribute("aria-live")).toBe("polite");
  });

  it("rotates when an autofocused button takes focus after a mouse press", async () => {
    renderThemed(
      <Opener
        focusable={
          <button type="button" autoFocus>
            Details
          </button>
        }
      />
    );
    await userEvent.click(roleNamed("button", "Open"));
    const details = roleNamed("button", "Details");
    expect(document.activeElement).toBe(details);
    // The precondition: focus that follows a mouse press is not keyboard focus.
    expect(details.matches(":focus-visible")).toBe(false);
    // The pointer rests on Open, above the carousel, so nothing pauses the rotation either.
    expect(roleNamed("region", "Offers").matches(":hover")).toBe(false);
    expect(page.getByRole("button", { name: "Stop automatic slide show" }).query()).not.toBeNull();
    await turn(1);
  });
});

describe("Carousel autoplay and keyboard focus in a portal", () => {
  it("stops when keyboard focus lands in a field a slide portals out of the carousel", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Outside</button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
            <Carousel.Controls>
              <Carousel.Autoplay delay={DELAY} />
              <Carousel.Indicators />
            </Carousel.Controls>
            <Carousel.Viewport>
              <Carousel.Slide>
                <div style={{ height: 80 }}>{createPortal(<input aria-label="Note" />, document.body)}</div>
              </Carousel.Slide>
              {carouselSlides(3, 1)}
            </Carousel.Viewport>
          </Carousel.Root>
        </>
      )
    );
    const region = roleNamed("region", "Offers");
    // A popover's field: in the carousel's React tree, outside its element. It takes keyboard
    // focus while the carousel rotates, before the clock moves.
    const note = roleNamed("textbox", "Note");
    expect(region.contains(note)).toBe(false);
    expect(page.getByRole("button", { name: "Stop automatic slide show" }).query()).not.toBeNull();
    note.focus();
    expect(note.matches(":focus-visible")).toBe(true);
    // Stopped, not paused: with the pointer off the carousel, the first page stays.
    await userEvent.hover(roleNamed("button", "Outside"));
    expect(page.getByRole("button", { name: "Start automatic slide show" }).query()).not.toBeNull();
    await staysOnFirstPage();
  });

  it("starts stopped when it mounts late with keyboard focus already in a slide's portal", async () => {
    function LatePortal({ onShow }: { readonly onShow: (show: () => void) => void }): ReactElement {
      const [shown, setShown] = useState(false);
      onShow(() => setShown(true));
      return withLocale(
        "en-US",
        <>
          <button type="button">Outside</button>
          <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
            <Carousel.Controls>
              {shown ? <Carousel.Autoplay delay={DELAY} /> : null}
              <Carousel.Indicators />
            </Carousel.Controls>
            <Carousel.Viewport>
              <Carousel.Slide>
                <div style={{ height: 80 }}>{createPortal(<input aria-label="Note" />, document.body)}</div>
              </Carousel.Slide>
              {carouselSlides(3, 1)}
            </Carousel.Viewport>
          </Carousel.Root>
        </>
      );
    }
    let show: () => void = () => undefined;
    renderThemed(
      <LatePortal
        onShow={(next) => {
          show = next;
        }}
      />
    );
    await expect.poll(() => carouselIndicators().length).toBe(4);
    await userEvent.hover(roleNamed("button", "Outside"));
    const note = roleNamed("textbox", "Note");
    expect(roleNamed("region", "Offers").contains(note)).toBe(false);
    note.focus();
    expect(note.matches(":focus-visible")).toBe(true);
    show();
    // APG: keyboard focus inside the carousel, a portal from it included, stops rotation.
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await staysOnFirstPage();
    expect(document.activeElement).toBe(note);
  });

  it.each(["portal", "slide"] as const)(
    "rotates when it mounts late after the keyboard-focused field in a %s is removed",
    async (place) => {
      type Steps = { readonly removeNote: () => void; readonly showAutoplay: () => void };
      function RemovedNote({ onSteps }: { readonly onSteps: (steps: Steps) => void }): ReactElement {
        const [noted, setNoted] = useState(true);
        const [shown, setShown] = useState(false);
        onSteps({ removeNote: () => setNoted(false), showAutoplay: () => setShown(true) });
        const note = noted ? <input aria-label="Note" /> : null;
        return withLocale(
          "en-US",
          <>
            <button type="button">Outside</button>
            <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
              <Carousel.Controls>
                {shown ? <Carousel.Autoplay delay={DELAY} /> : null}
                <Carousel.Indicators />
              </Carousel.Controls>
              <Carousel.Viewport>
                <Carousel.Slide>
                  <div style={{ height: 80 }}>
                    {place === "portal" ? createPortal(note, document.body) : note}
                  </div>
                </Carousel.Slide>
                {carouselSlides(3, 1)}
              </Carousel.Viewport>
            </Carousel.Root>
          </>
        );
      }
      let steps: Steps = { removeNote: () => undefined, showAutoplay: () => undefined };
      renderThemed(
        <RemovedNote
          onSteps={(next) => {
            steps = next;
          }}
        />
      );
      await expect.poll(() => carouselIndicators().length).toBe(4);
      await userEvent.hover(roleNamed("button", "Outside"));
      const note = roleNamed("textbox", "Note");
      note.focus();
      expect(note.matches(":focus-visible")).toBe(true);
      steps.removeNote();
      await expect.poll(() => note.isConnected).toBe(false);
      steps.showAutoplay();
      // Removing the field took keyboard focus out of the carousel, so nothing stops rotation.
      await expect
        .poll(() => page.getByRole("button", { name: "Stop automatic slide show" }).query())
        .not.toBeNull();
      await turn(1);
    }
  );
});
