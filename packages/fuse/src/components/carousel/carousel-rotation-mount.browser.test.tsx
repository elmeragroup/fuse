/**
 * Unit under test: Carousel rotation in Chromium where the starting state is unusual: hover
 * that began before hydration, which only `:hover` still knows, and keyboard focus inside a
 * shadow root, whose focus event reaches the carousel retargeted to the shadow host, or inside
 * a same-origin frame a slide portals into, which the outer document reports only as the frame. Oracles: the
 * APG carousel pattern (rotation pauses while the pointer is over the carousel and stops when an
 * element in it receives keyboard focus) and each engine's own `:hover` and `:focus-visible`,
 * which the tests read as preconditions.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { createPortal } from "react-dom";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames, pendingTimeout, pollFrames, useFakeTimeouts } from "../../../test/animation-frames";
import { carouselSlides, serverRendered } from "../../../test/carousel-fixtures";
import { carouselViewport, currentIndicator } from "../../../test/carousel-queries";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Carousel } from "./index";

const WIDTH = 240;

/** Hero's autoplay delay. */
const DELAY = 200;

// The page's timeouts are fake, so rotation turns a page only when a test moves the clock.
beforeEach(() => {
  useFakeTimeouts();
});

/** Moves the clock past several delays and lets the page render whatever they turned. */
async function pastSeveralDelays(): Promise<void> {
  vi.advanceTimersByTime(DELAY * 5);
  await nextFrames(2);
}

/**
 * A rotating carousel below an Outside button, with `extra` in its first slide; with `autoplay`
 * false, its Autoplay is not mounted yet.
 */
function Hero({
  extra,
  autoplay = true,
}: {
  readonly extra?: ReactElement;
  readonly autoplay?: boolean;
}): ReactElement {
  return withLocale(
    "en-US",
    <>
      <button type="button">Outside</button>
      <Carousel.Root aria-label="Offers" style={{ width: WIDTH }}>
        <Carousel.Controls>
          {autoplay ? <Carousel.Autoplay delay={DELAY} /> : null}
          <Carousel.Previous />
          <Carousel.Indicators />
          <Carousel.Next />
        </Carousel.Controls>
        <Carousel.Viewport>
          <Carousel.Slide>
            <div style={{ height: 80 }}>{extra ?? "Slide body 0"}</div>
          </Carousel.Slide>
          {carouselSlides(3, 1)}
        </Carousel.Viewport>
      </Carousel.Root>
    </>
  );
}

const rotationControl = (name: "Start" | "Stop"): Element | null =>
  page.getByRole("button", { name: `${name} automatic slide show`, exact: true }).query();

/**
 * Rotation was stopped, not paused: with the pointer moved off the carousel, the rotation control
 * offers Start and page `on` stays through several delays.
 */
async function expectStoppedWithPointerOutside(on = 0): Promise<void> {
  await userEvent.hover(roleNamed("button", "Outside"));
  expect(rotationControl("Start")).not.toBeNull();
  await pastSeveralDelays();
  expect(currentIndicator()).toBe(on);
}

describe("Carousel rotation across engines", () => {
  it("starts paused when the pointer was over the carousel before hydration", async () => {
    const server = serverRendered(<Hero />);
    const region = roleNamed("region", "Offers");
    await userEvent.hover(carouselViewport(region));
    // The precondition: the engine knows the pointer is over the server's HTML.
    expect(region.matches(":hover")).toBe(true);
    server.hydrate();
    // Rotating, since nothing stopped it, but paused under the pointer.
    await expect.poll(() => rotationControl("Stop")).not.toBeNull();
    await expect.poll(() => carouselViewport(region).getAttribute("aria-live")).toBe("polite");
    await pastSeveralDelays();
    expect(currentIndicator()).toBe(0);
    expect(server.recoverableErrors).toEqual([]);
    // The pointer leaving resumes it.
    await userEvent.hover(roleNamed("button", "Outside"));
    // Resuming arms the next turn in an effect, which can run after a frame.
    await pendingTimeout();
    vi.advanceTimersByTime(DELAY);
    await pollFrames(currentIndicator, 1);
  });

  it("stops when keyboard focus lands inside a shadow root after mount", async () => {
    defineCodeField();
    renderThemed(<Hero extra={createElement(CODE_FIELD)} />);
    const region = roleNamed("region", "Offers");
    const host = region.querySelector(CODE_FIELD);
    const field = host?.shadowRoot?.querySelector("input");
    if (!(host instanceof HTMLElement) || !(field instanceof HTMLInputElement)) {
      throw new Error("expected the code field's shadow input");
    }
    // Synchronously after mount, so no rotation can have moved the field's slide out of view:
    // the carousel rotates, and a lazy form control autofocuses its own field, as it would once
    // its script loads.
    expect(rotationControl("Stop")).not.toBeNull();
    field.focus();
    // The preconditions: the inner field has keyboard focus, and the host its focus event
    // names does not match `:focus-visible` itself.
    expect(host.shadowRoot?.activeElement).toBe(field);
    expect(field.matches(":focus-visible")).toBe(true);
    expect(host.matches(":focus-visible")).toBe(false);
    await expectStoppedWithPointerOutside();
    expect(host.shadowRoot?.activeElement).toBe(field);
  });

  it("starts stopped when Autoplay mounts while keyboard focus is inside a shadow root", async () => {
    defineCodeField();
    const view = renderThemed(<Hero extra={createElement(CODE_FIELD)} autoplay={false} />);
    const region = roleNamed("region", "Offers");
    const host = region.querySelector(CODE_FIELD);
    const field = host?.shadowRoot?.querySelector("input");
    if (!(host instanceof HTMLElement) || !(field instanceof HTMLInputElement)) {
      throw new Error("expected the code field's shadow input");
    }
    field.focus();
    // The precondition: keyboard focus is inside the carousel, below a shadow root, which a plain
    // `contains` from the carousel does not reach.
    expect(field.matches(":focus-visible")).toBe(true);
    expect(region.contains(field)).toBe(false);
    view.rerender(<Hero extra={createElement(CODE_FIELD)} />);
    await expectStoppedWithPointerOutside();
    expect(host.shadowRoot?.activeElement).toBe(field);
  });

  it("stops when keyboard focus lands in a field a slide portals into a same-origin frame", async () => {
    // Loaded before the carousel renders into it: Firefox replaces a new frame's first
    // `about:blank` document once that loads, which would leave the portal in a dead document.
    const frame = document.createElement("iframe");
    const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
    frame.srcdoc = "<!doctype html><body></body>";
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    await loaded;
    const frameDocument = frame.contentDocument;
    if (frameDocument === null) {
      throw new Error("expected a same-origin frame document");
    }
    renderThemed(<Hero extra={createPortal(<input aria-label="Frame code" />, frameDocument.body)} />);
    const field = frameDocument.querySelector("input");
    if (field === null) {
      throw new Error("expected the portalled field in the frame");
    }
    expect(rotationControl("Stop")).not.toBeNull();
    // Firefox now and then turns down the first focus into a frame's freshly rendered field, so
    // the field is focused until its document reports it. It sits outside every slide, so a page
    // the carousel turns meanwhile cannot take it out of reach.
    await expect
      .poll(() => {
        field.focus();
        return frameDocument.activeElement;
      })
      .toBe(field);
    // The preconditions: the field has keyboard focus in its own document, while the outer
    // document names the frame, which does not match `:focus-visible` itself.
    expect(field.matches(":focus-visible")).toBe(true);
    expect(document.activeElement).toBe(frame);
    expect(frame.matches(":focus-visible")).toBe(false);
    expect(rotationControl("Start")).not.toBeNull();
    await expectStoppedWithPointerOutside();
    expect(frameDocument.activeElement).toBe(field);
  });
});

/** A custom form control whose field lives in an open shadow root. */
const CODE_FIELD = "fuse-test-code-field";

function defineCodeField(): void {
  if (customElements.get(CODE_FIELD) !== undefined) {
    return;
  }
  customElements.define(
    CODE_FIELD,
    class extends HTMLElement {
      connectedCallback(): void {
        if (this.shadowRoot === null) {
          const field = document.createElement("input");
          field.setAttribute("aria-label", "Code");
          this.attachShadow({ mode: "open" }).append(field);
        }
      }
    }
  );
}
