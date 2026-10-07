import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { headingNamed, px, renderThemed, roleNamed, textNamed } from "../../../test/themed-browser-render";
import { Alert } from "./alert";

const VARIANTS = ["default", "destructive", "warning", "success"] as const;

/** Starts of Phosphor's bold paths (`dist/defs/*.es.js`), the icon default weight. */
const ICON_PATH = {
  default: "M108,84a16,16,0,1,1,16,16A16,16,0,0,1,108,84Z",
  warning: "M240.26,186.1",
  destructive: "M236,91.55v72.9",
  success: "M176.49,95.51",
} as const;

function alertNamed(name: string): HTMLElement {
  const element = page.getByRole("alert").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected alert ${name}`);
  }
  return element;
}

function descriptionIn(root: HTMLElement): HTMLElement {
  // DOM audit: Item.Media's top alignment keys on the item-description data-slot hook.
  const description = root.querySelector('[data-slot="item-description"]');
  if (!(description instanceof HTMLElement)) {
    throw new Error("expected item-description");
  }
  return description;
}

function iconIn(root: HTMLElement): SVGSVGElement {
  // DOM audit: variant icons are asserted via the alert-icon data-slot hook.
  const icon = root.querySelector('[data-slot="alert-icon"]');
  if (!(icon instanceof SVGSVGElement)) {
    throw new Error("expected alert-icon");
  }
  return icon;
}

/** WCAG AA for body-size text, the size the sm action label renders at. */
const AA_TEXT_CONTRAST = 4.5;

function computedSrgb(value: string): Srgb.Srgb {
  return CssColor.toSrgb(getOrThrow(CssColor.parse(value)));
}

/**
 * The action label's contrast against the fill a reader sees: the button's background
 * composited over the alert surface beneath it. A transparent `rgba()` fill composites; an
 * `oklab()` translucent fill throws until `CssColor` parses `oklab()` (TODO.md).
 */
function actionContrast(action: HTMLElement, root: HTMLElement): number {
  const surface = computedSrgb(getComputedStyle(root).backgroundColor);
  const fill = Srgb.compositeOver(computedSrgb(getComputedStyle(action).backgroundColor), surface);
  return getOrThrow(Wcag.contrastRatio(computedSrgb(getComputedStyle(action).color), fill));
}

/** Let the action's color transition settle, so computed colors are the hover end state. */
async function settled(element: HTMLElement): Promise<void> {
  await Promise.all(element.getAnimations().map((animation) => animation.finished));
}

describe("Alert", () => {
  it("finds Root by alert role for every variant and keeps children inside it", () => {
    for (const variant of VARIANTS) {
      const { unmount } = renderThemed(
        <Alert.Root variant={variant}>
          <Alert.Title>{variant} title</Alert.Title>
          <Alert.Description>{variant} body</Alert.Description>
        </Alert.Root>
      );
      const root = alertNamed(variant);
      expect(root.getAttribute("data-slot")).toBe("item");
      expect(root.getAttribute("data-variant")).toBe("outline");
      expect(root.getAttribute("data-size")).toBe("sm");
      const title = headingNamed(`${variant} title`, 3);
      expect(root.contains(title)).toBe(true);
      expect(root.textContent).toContain(`${variant} body`);
      // The variant stays on Root: Title and Description emit no variant attribute.
      const description = textNamed(`${variant} body`);
      expect(title.getAttribute("variant"), variant).toBeNull();
      expect(description.getAttribute("variant"), variant).toBeNull();
      expect(description.tagName, variant).toBe("DIV");
      unmount();
    }
  });

  it("shows every line of a long description instead of clamping it", () => {
    const sentence = "The supplier switch completes on the first day of next month.";
    renderThemed(
      <div style={{ width: "240px" }}>
        <Alert.Root>
          <Alert.Title>Switch scheduled</Alert.Title>
          <Alert.Description>
            <p>{sentence}</p>
            <p>{sentence}</p>
            <p>{sentence}</p>
          </Alert.Description>
        </Alert.Root>
      </div>
    );
    const description = descriptionIn(alertNamed("default"));
    const lineHeight = px(getComputedStyle(description).lineHeight);
    // Three paragraphs wrap to well over two lines at 240px; a two-line clamp would cap the box.
    expect(description.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 4);
    expect(description.scrollHeight).toBe(description.clientHeight);
  });

  it("renders a list inside the description element", () => {
    renderThemed(
      <Alert.Root>
        <Alert.Title>Before you continue</Alert.Title>
        <Alert.Description>
          <ul>
            <li>Meter number</li>
            <li>Moving date</li>
          </ul>
        </Alert.Description>
      </Alert.Root>
    );
    const list = page.getByRole("list").element();
    const description = descriptionIn(alertNamed("default"));
    expect(description.tagName).toBe("DIV");
    expect(list.parentElement).toBe(description);
  });

  it("spaces a list below a paragraph in the description under a preflight host", () => {
    renderThemed(
      <>
        {/* dist/styles.css ships without preflight, so user-agent margins would space the blocks.
            A host with Tailwind's preflight zeroes them in the base layer, below utilities. */}
        <style>{"@layer base { p, ul { margin: 0; } }"}</style>
        <Alert.Root>
          <Alert.Title>Before you move</Alert.Title>
          <Alert.Description>
            <p>Have these ready:</p>
            <ul>
              <li>Meter number</li>
            </ul>
          </Alert.Description>
        </Alert.Root>
      </>
    );
    const paragraph = textNamed("Have these ready:").getBoundingClientRect();
    const list = page.getByRole("list").element().getBoundingClientRect();
    expect(list.top - paragraph.bottom).toBeGreaterThan(0);
  });

  it("keeps a link in the description on the surrounding text's line", () => {
    renderThemed(
      <Alert.Root>
        <Alert.Title>Switch scheduled</Alert.Title>
        <Alert.Description>
          Read <a href="#terms">the terms</a> before you sign.
        </Alert.Description>
      </Alert.Root>
    );
    const description = descriptionIn(alertNamed("default"));
    const lineHeight = px(getComputedStyle(description).lineHeight);
    const link = page.getByRole("link", { name: "the terms" }).element().getBoundingClientRect();
    // One short sentence fits one line box; a block or grid row per inline run would stack three.
    expect(description.getBoundingClientRect().height).toBeLessThan(lineHeight * 2);
    expect(Math.abs(link.top - description.getBoundingClientRect().top)).toBeLessThan(lineHeight / 2);
  });

  it("aligns the icon with the top of a multi-line description's content", () => {
    renderThemed(
      <div style={{ width: "240px" }}>
        <Alert.Root>
          <Alert.Title>Switch scheduled</Alert.Title>
          <Alert.Description>
            The supplier switch completes on the first day of next month, and the final invoice from the
            current supplier follows within six weeks.
          </Alert.Description>
        </Alert.Root>
      </div>
    );
    const content = headingNamed("Switch scheduled", 3).parentElement;
    if (content === null) {
      throw new Error("expected the title inside the alert content");
    }
    const icon = iconIn(alertNamed("default")).getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    // Item.Media centres by default; a centred icon would sit near the content's middle.
    expect(contentBox.height).toBeGreaterThan(icon.height * 3);
    expect(Math.abs(icon.top - contentBox.top)).toBeLessThanOrEqual(4);
  });

  it("renders the mapped Phosphor glyph for each variant, hidden from AT", () => {
    for (const variant of VARIANTS) {
      const { unmount } = renderThemed(
        <Alert.Root variant={variant}>
          <Alert.Title>{variant}</Alert.Title>
        </Alert.Root>
      );
      const icon = iconIn(alertNamed(variant));
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("data-slot")).toBe("alert-icon");
      expect(icon.innerHTML).toContain(ICON_PATH[variant]);
      unmount();
    }
  });

  it("finds Title as a level-3 heading and renders level 2 as h2", () => {
    const { unmount } = renderThemed(
      <Alert.Root>
        <Alert.Title>Sync delayed</Alert.Title>
      </Alert.Root>
    );
    const title = headingNamed("Sync delayed", 3);
    expect(title.tagName).toBe("H3");
    expect(title.getAttribute("data-slot")).toBe("item-title");
    expect(title.getAttribute("variant")).toBeNull();
    unmount();

    renderThemed(
      <Alert.Root>
        <Alert.Title level={2}>Facility status</Alert.Title>
      </Alert.Root>
    );
    const h2 = headingNamed("Facility status", 2);
    expect(h2.tagName).toBe("H2");
    expect(h2.getAttribute("data-slot")).toBe("item-title");
  });

  it("fires the action button and omits it when onAction is unset", async () => {
    const onAction = vi.fn();
    const { unmount } = renderThemed(
      <Alert.Root variant="warning" onAction={onAction} actionLabel="Retry">
        <Alert.Title>Sync delayed</Alert.Title>
        <Alert.Description>Facility data is more than an hour old.</Alert.Description>
      </Alert.Root>
    );
    const action = roleNamed("button", "Retry");
    expect(action.getAttribute("type")).toBe("button");
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledOnce();
    unmount();

    renderThemed(
      <Alert.Root>
        <Alert.Title>Saved</Alert.Title>
      </Alert.Root>
    );
    expect(page.getByRole("button").query()).toBeNull();
  });

  it("keeps the default action's label legible while hovered", async () => {
    renderThemed(
      <Alert.Root onAction={vi.fn()} actionLabel="Open report">
        <Alert.Title>Report ready</Alert.Title>
      </Alert.Root>
    );
    const action = roleNamed("button", "Open report");
    const restFill = getComputedStyle(action).backgroundColor;
    await userEvent.hover(action);
    await settled(action);
    expect(getComputedStyle(action).backgroundColor).not.toBe(restFill);
    expect(actionContrast(action, alertNamed("default"))).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });
});
