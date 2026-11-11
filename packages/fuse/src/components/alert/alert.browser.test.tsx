import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { HOSTS, centreY, hostCss } from "../../../test/first-line";
import {
  headingNamed,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../popover/popover";
import { Alert } from "./alert";

const VARIANTS = ["default", "destructive", "warning", "success", "info"] as const;

function alertNamed(name: string): HTMLElement {
  const element = page.getByRole("alert").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected alert ${name}`);
  }
  return element;
}

function descriptionIn(root: HTMLElement): HTMLElement {
  // Item.Media's top alignment keys on the item-description data-slot hook.
  const description = root.querySelector('[data-slot="item-description"]');
  if (!(description instanceof HTMLElement)) {
    throw new Error("expected item-description");
  }
  return description;
}

function iconIn(root: HTMLElement): SVGSVGElement {
  // Variant icons are asserted via the alert-icon data-slot hook.
  const icon = root.querySelector('[data-slot="alert-icon"]');
  if (!(icon instanceof SVGSVGElement)) {
    throw new Error("expected alert-icon");
  }
  return icon;
}

/** WCAG AA for body-size text, the size the sm action label renders at. */
const AA_TEXT_CONTRAST = 4.5;

/** A 1px transparent GIF, so an image's box comes from its width and height, not a network load. */
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function computedSrgb(value: string): Srgb.Srgb {
  return CssColor.toSrgb(getOrThrow(CssColor.parse(value)));
}

/**
 * The action label's contrast against the fill a reader sees: the button's background
 * composited over the alert surface beneath it, as the browser paints a translucent fill,
 * whether Chromium serializes it as a transparent `rgba()` or a `color-mix(in oklab, …)` tint's
 * `oklab()`.
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
  it("finds Root by alert role for every variant and keeps its heading and body inside it", () => {
    for (const variant of VARIANTS) {
      const { unmount } = renderThemed(
        <Alert.Root variant={variant}>
          <Alert.Title>{variant} title</Alert.Title>
          <Alert.Description>{variant} body</Alert.Description>
        </Alert.Root>
      );
      const root = alertNamed(variant);
      expect(root.contains(headingNamed(`${variant} title`, 3)), variant).toBe(true);
      expect(root.contains(textNamed(`${variant} body`)), variant).toBe(true);
      unmount();
    }
  });

  it("takes a consumer's status role in place of alert and keeps its heading, icon and action", () => {
    renderThemed(
      <Alert.Root variant="info" role="status" onAction={() => undefined} actionLabel="Read more">
        <Alert.Title>Invoice by email</Alert.Title>
        <Alert.Description>The invoice goes to your email address.</Alert.Description>
      </Alert.Root>
    );
    expect(page.getByRole("alert").query()).toBeNull();
    const root = page.getByRole("status").element();
    if (!(root instanceof HTMLElement)) {
      throw new Error("expected status");
    }
    expect(root.contains(headingNamed("Invoice by email", 3))).toBe(true);
    expect(root.contains(textNamed("The invoice goes to your email address."))).toBe(true);
    expect(root.contains(roleNamed("button", "Read more"))).toBe(true);
    expect(iconIn(root).getAttribute("aria-hidden")).toBe("true");
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

  /** Block children a description holds after a paragraph, each found by its accessible role. */
  const BLOCKS_AFTER_PARAGRAPH = [
    {
      name: "list",
      block: (
        <ul>
          <li>Meter number</li>
        </ul>
      ),
      find: () => page.getByRole("list").element(),
    },
    {
      name: "disclosure",
      block: (
        <details>
          <summary>More information</summary>
          The meter number is on the meter.
        </details>
      ),
      find: () => page.getByRole("group").element(),
    },
    {
      name: "heading",
      block: <h4>Meter number</h4>,
      find: () => headingNamed("Meter number", 4),
    },
    {
      name: "section",
      block: <section aria-label="Meter">The meter number is on the meter.</section>,
      find: () => roleNamed("region", "Meter"),
    },
    {
      name: "image",
      block: <img src={PIXEL} alt="Meter photo" width={40} height={20} />,
      find: () => roleNamed("img", "Meter photo"),
    },
  ] as const;

  it("spaces each block child below a paragraph in the description under a preflight host", () => {
    for (const { name, block, find } of BLOCKS_AFTER_PARAGRAPH) {
      const { unmount } = renderThemed(
        <>
          {/* Preflight zeroes every margin in the base layer; the step must outlast that reset. */}
          <style>{hostCss("preflight")}</style>
          <Alert.Root>
            <Alert.Title>Before you move</Alert.Title>
            <Alert.Description>
              <p>Have these ready:</p>
              {block}
            </Alert.Description>
          </Alert.Root>
        </>
      );
      const paragraph = textNamed("Have these ready:").getBoundingClientRect();
      expect.soft(find().getBoundingClientRect().top - paragraph.bottom, name).toBeGreaterThan(0);
      unmount();
    }
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

  it("keeps its height when an inline popover trigger in the description opens", async () => {
    renderThemed(
      <Alert.Root variant="warning">
        <Alert.Title>Ongoing activity on the person</Alert.Title>
        <Alert.Description>
          There are orders sold for this person{" "}
          <PopoverRoot>
            <PopoverTrigger>in the last month</PopoverTrigger>
            <PopoverContent>Orders this month</PopoverContent>
          </PopoverRoot>
          .
        </Alert.Description>
      </Alert.Root>
    );
    const root = alertNamed("warning");
    const closedHeight = root.getBoundingClientRect().height;
    await userEvent.click(roleNamed("button", "in the last month"));
    await expect.element(page.getByText("Orders this month")).toBeVisible();
    // Opening a popover changes nothing in the sentence a reader sees, so the alert keeps its box.
    expect(root.getBoundingClientRect().height).toBe(closedHeight);
  });

  it.each(HOSTS)("keeps the action button centred on the row beside a description, in a %s host", (host) => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderThemed(
        <div style={{ width: "320px" }}>
          <style>{hostCss(host)}</style>
          <Alert.Root onAction={() => undefined} actionLabel="Retry">
            <Alert.Title>Sync delayed</Alert.Title>
            <Alert.Description>
              Facility data is more than an hour old and may not match the meter.
            </Alert.Description>
          </Alert.Root>
        </div>
      );
      const offset = centreY(roleNamed("button", "Retry")) - centreY(alertNamed("default"));
      expect(Math.abs(offset), density).toBeLessThanOrEqual(0.5);
      unmount();
    }
  });

  it("keeps the title flush with the content and 4px above the description without preflight", () => {
    renderThemed(
      <Alert.Root>
        <Alert.Title>Switch scheduled</Alert.Title>
        <Alert.Description>The switch completes next month.</Alert.Description>
      </Alert.Root>
    );
    const title = headingNamed("Switch scheduled", 3);
    const content = title.parentElement;
    if (content === null) {
      throw new Error("expected the title inside the alert content");
    }
    const description = descriptionIn(alertNamed("default")).getBoundingClientRect();
    // Only the content column's gap separates the title from the description; an `h3` keeps its
    // user-agent block margins in a preflight-free host unless the title resets them.
    expect(title.getBoundingClientRect().top - content.getBoundingClientRect().top).toBeCloseTo(0, 2);
    expect(description.top - title.getBoundingClientRect().bottom).toBeCloseTo(
      px(getComputedStyle(content).rowGap),
      2
    );
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

describe("Alert", () => {
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
});
