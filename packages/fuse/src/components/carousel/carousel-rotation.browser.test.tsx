/**
 * Unit under test: Carousel rotation in Chromium, through the rotation control's name and the
 * current indicator. Oracles: the APG carousel pattern (rotation pauses on hover, stops on keyboard
 * focus and any other user action, restarts only from the rotation control, which then keeps it
 * running) and WCAG 2.2.2, under which rotation the user did not ask for stays stopped.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import {
  carouselIndicators,
  carouselViewport,
  currentIndicator,
  settledOn,
} from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import "../../../test/pointer-press";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

/** The fixture's slide width, so page N's slide starts N × WIDTH into the scroll range. */
const WIDTH = 240;

describe("Carousel autoplay", () => {
  function AutoplayFixture({ delay }: { readonly delay: number }): ReactElement {
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Controls>
            <Carousel.Autoplay delay={delay} />
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
    // Longer than a smooth scroll across the three pages, so the rewind lands before the next tick.
    renderThemed(<AutoplayFixture delay={900} />);
    // The pointer rests where the last test left it, which may be over the new carousel.
    await userEvent.hover(roleNamed("button", "Outside"));
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    const control = roleNamed("button", "Stop automatic slide show");
    expect(control.hasAttribute("aria-pressed")).toBe(false);
    expect(viewport.getAttribute("aria-live")).toBe("off");
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(1);
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(2);
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(0);
    await settledOn(viewport, 0);
  });

  it("pauses while hovered and resumes when the pointer leaves", async () => {
    renderThemed(<AutoplayFixture delay={200} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(viewport);
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("polite");
    // The hover command takes its own time while the 200ms delay runs, so the page it paused on
    // is read once any scroll already under way has settled, not assumed to be the first.
    await nextFrames(2);
    const paused = currentIndicator();
    await settledOn(viewport, paused * WIDTH);
    await wait(500);
    expect(currentIndicator()).toBe(paused);
    expect(roleNamed("button", "Stop automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await userEvent.hover(roleNamed("button", "Outside"));
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("off");
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe((paused + 1) % 3);
  });

  it("stops for good when keyboard focus lands on the rotation control or anywhere else in the carousel", async () => {
    renderThemed(<AutoplayFixture delay={200} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(roleNamed("button", "Outside"));
    roleNamed("button", "Outside").focus();

    // Tab reaches the rotation control first, and keyboard focus there stops rotation.
    await userEvent.keyboard("{Tab}");
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    expect(document.activeElement).toBe(roleNamed("button", "Start automatic slide show"));
    const stoppedOn = currentIndicator();
    await settledOn(viewport, stoppedOn * WIDTH);

    // Moving on through the carousel and out of it does not resume it.
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Previous slide"));
    await userEvent.keyboard("{Shift>}{Tab}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("button", "Outside"));
    await wait(600);
    expect(currentIndicator()).toBe(stoppedOn);
    expect(viewport.getAttribute("aria-live")).toBe("polite");
  });

  it("keeps rotating after the user presses Play, through focus on the control, hover and Tab", async () => {
    renderThemed(<AutoplayFixture delay={200} />);
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
    const started = currentIndicator();
    await expect.poll(currentIndicator, { timeout: 3000 }).not.toBe(started);

    // Neither the pointer over the slides nor keyboard focus moving inside pauses it now.
    await userEvent.hover(viewport);
    const hovered = currentIndicator();
    await expect.poll(currentIndicator, { timeout: 3000 }).not.toBe(hovered);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Previous slide"));
    const tabbed = currentIndicator();
    await expect.poll(currentIndicator, { timeout: 3000 }).not.toBe(tabbed);
    expect(viewport.getAttribute("aria-live")).toBe("off");
  });

  it("pauses while the document is hidden", async () => {
    renderThemed(<AutoplayFixture delay={200} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // The test page cannot be hidden, so the document reports hidden through its own property,
    // synchronously after mount, before a browser command gives the 200ms delay time to run.
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    // The pointer rests where the last test left it, which may be over the new carousel.
    await userEvent.hover(roleNamed("button", "Outside"));
    await expect.poll(() => viewport.getAttribute("aria-live")).toBe("polite");
    await wait(500);
    expect(currentIndicator()).toBe(0);
    visibility.mockRestore();
    document.dispatchEvent(new Event("visibilitychange"));
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(1);
  });

  it("stops for good when a control changes the page, until the user starts it", async () => {
    renderThemed(<AutoplayFixture delay={200} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // Pressed synchronously after mount, so the 200ms delay cannot turn the page first.
    roleNamed("button", "Next slide").click();
    await expect.poll(() => carouselIndicators().length).toBe(3);
    await userEvent.hover(roleNamed("button", "Outside"));
    roleNamed("button", "Outside").focus();
    expect(roleNamed("button", "Start automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    expect(viewport.getAttribute("aria-live")).toBe("polite");
    await wait(600);
    expect(currentIndicator()).toBe(1);

    await userEvent.click(roleNamed("button", "Start automatic slide show"));
    await userEvent.hover(roleNamed("button", "Outside"));
    expect(roleNamed("button", "Stop automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(2);
  });

  it("stays stopped when its delay changes", async () => {
    function Configurable(): ReactElement {
      const [delay, setDelay] = useState(200);
      return withLocale(
        "en-US",
        <>
          <button type="button" onClick={() => setDelay(250)}>
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
    // Stopped synchronously after mount, so the 200ms delay cannot turn the page first.
    roleNamed("button", "Stop automatic slide show").click();
    await userEvent.click(roleNamed("button", "Slower"));
    await nextFrames(2);
    expect(roleNamed("button", "Start automatic slide show")).toBeInstanceOf(HTMLButtonElement);
    await wait(700);
    expect(currentIndicator()).toBe(0);
  });

  it("stops for good when the user scrolls the viewport", async () => {
    renderThemed(<AutoplayFixture delay={300} />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    // Scrolled synchronously after mount, so the delay cannot start a rotation scroll first.
    viewport.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    viewport.scrollTo({ left: 2 * WIDTH, behavior: "instant" });
    await expect.poll(() => carouselIndicators().length).toBe(3);
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await wait(700);
    expect(currentIndicator()).toBe(2);
  });
});

describe("Carousel wheel turns", () => {
  function Rotating(): ReactElement {
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Controls>
            <Carousel.Autoplay delay={400} />
            <Carousel.Indicators />
          </Carousel.Controls>
          <Carousel.Viewport>{carouselSlides(4, 1)}</Carousel.Viewport>
        </Carousel.Root>
      </>
    );
  }

  async function staysStopped(): Promise<void> {
    await expect
      .poll(() => page.getByRole("button", { name: "Start automatic slide show" }).query())
      .not.toBeNull();
    await userEvent.hover(roleNamed("button", "Outside"));
    await wait(300);
    const after = currentIndicator();
    await wait(900);
    expect(currentIndicator()).toBe(after);
  }

  it("stops rotation for good on a diagonal wheel turn that scrolls the slides sideways", async () => {
    renderThemed(<Rotating />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(viewport);
    // A real wheel through the browser, mostly vertical, which still scrolls the carousel.
    await commands.pointerWheel(240, 300);
    await expect.poll(() => viewport.scrollLeft, { timeout: 3000 }).toBeGreaterThan(0);
    await staysStopped();
  });

  it("stops rotation for good on a Shift + wheel turn, which a horizontal carousel scrolls by", async () => {
    renderThemed(<Rotating />);
    const viewport = carouselViewport(roleNamed("region", "Offers"));
    await userEvent.hover(viewport);
    // The operating system turns Shift + wheel sideways before the browser sees it, which a test
    // browser cannot do, so the turn arrives as the event a page receives: vertical, with Shift.
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, shiftKey: true, bubbles: true }));
    await staysStopped();
  });
});

describe("Carousel autoplay that mounts late", () => {
  /** A carousel whose Autoplay mounts only when `show` runs, as late slides or config would. */
  function Late({ onShow }: { readonly onShow: (show: () => void) => void }): ReactElement {
    const [shown, setShown] = useState(false);
    onShow(() => setShown(true));
    return withLocale(
      "en-US",
      <>
        <button type="button">Outside</button>
        <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
          <Carousel.Controls>
            {shown ? <Carousel.Autoplay delay={200} /> : null}
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
    await wait(850);
    expect(currentIndicator()).toBe(0);
    // The pointer leaving resumes it: the hover paused it and stopped nothing.
    await userEvent.hover(roleNamed("button", "Outside"));
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(1);
  });

  it("starts stopped when keyboard focus is already inside the carousel", async () => {
    const show = renderLate();
    const viewport = carouselViewport(roleNamed("region", "Offers"));
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
    await wait(850);
    expect(currentIndicator()).toBe(0);
    expect(viewport.getAttribute("aria-live")).toBe("polite");
    // The explicit Play still overrides: pressing Start runs it with focus left on the control.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(roleNamed("button", "Start automatic slide show"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(currentIndicator, { timeout: 3000 }).toBe(1);
    expect(document.activeElement).toBe(roleNamed("button", "Stop automatic slide show"));
  });
});

describe("Carousel autoplay that mounts with focus already moving in", () => {
  /** A carousel mounted with its Autoplay in one commit, with `focusable` autofocused in slide 1. */
  function Autofocused({
    focusable,
    delay,
  }: {
    readonly focusable: ReactElement;
    readonly delay: number;
  }): ReactElement {
    return (
      <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
        <Carousel.Controls>
          <Carousel.Autoplay delay={delay} />
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
   * keyboard press mounts it already
   * stopped; a mouse press leaves it rotating, so that case takes a `delay` longer than the click
   * command, which the test awaits before it reads where focus went.
   */
  function Opener({
    focusable,
    delay = 200,
  }: {
    readonly focusable: ReactElement;
    readonly delay?: number;
  }): ReactElement {
    const [open, setOpen] = useState(false);
    return withLocale(
      "en-US",
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        {open ? <Autofocused focusable={focusable} delay={delay} /> : null}
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
    await wait(850);
    expect(currentIndicator()).toBe(0);
    expect(carouselViewport(roleNamed("region", "Offers")).getAttribute("aria-live")).toBe("polite");
  });

  it("rotates when an autofocused button takes focus after a mouse press", async () => {
    renderThemed(
      <Opener
        delay={1500}
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
    await expect.poll(currentIndicator, { timeout: 4000 }).toBe(1);
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
              <Carousel.Autoplay delay={200} />
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
    // focus synchronously after mount, while the carousel rotates, before a browser command gives
    // the 200ms delay time to turn the page.
    const note = roleNamed("textbox", "Note");
    expect(region.contains(note)).toBe(false);
    expect(page.getByRole("button", { name: "Stop automatic slide show" }).query()).not.toBeNull();
    note.focus();
    expect(note.matches(":focus-visible")).toBe(true);
    // Stopped, not paused: with the pointer off the carousel, the first page stays.
    await userEvent.hover(roleNamed("button", "Outside"));
    expect(page.getByRole("button", { name: "Start automatic slide show" }).query()).not.toBeNull();
    await wait(850);
    expect(currentIndicator()).toBe(0);
  });
});
