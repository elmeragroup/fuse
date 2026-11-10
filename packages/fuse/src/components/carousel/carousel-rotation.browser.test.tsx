/**
 * Unit under test: Carousel rotation in Chromium, through the rotation control's name and the
 * current indicator. Oracles: the APG carousel pattern (rotation pauses on hover, stops on keyboard
 * focus and any other user action, restarts only from the rotation control, which then keeps it
 * running) and WCAG 2.2.2, under which rotation the user did not ask for stays stopped.
 */
import { useState } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { wait } from "../../../test/animation-frames";
import { carouselSlides } from "../../../test/carousel-fixtures";
import { carouselIndicators, carouselViewport, currentIndicator } from "../../../test/carousel-queries";
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
              {shown ? <Carousel.Autoplay delay={200} /> : null}
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
    await wait(850);
    expect(currentIndicator()).toBe(0);
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
                {shown ? <Carousel.Autoplay delay={200} /> : null}
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
      await expect.poll(currentIndicator, { timeout: 3000 }).toBe(1);
    }
  );
});
