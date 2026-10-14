import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { HOSTS, centreY, firstLineCentreY, hostCss } from "../../../test/first-line";
import {
  computedContrast,
  headingNamed,
  px,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
  stampTheme,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { LEGAL_THEMES, themeSlug } from "../../theme/tokens/themes";
import { Badge } from "../badge/badge";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "../popover/popover";
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

/** A 1px transparent GIF, so an image's box comes from its width and height, not a network load. */
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * The parts of Tailwind's preflight that move blocks in a description: it zeroes every margin and
 * displays media as blocks, both in the base layer, below Fuse's utilities.
 */
const PREFLIGHT_STAND_IN =
  "@layer base { * { margin: 0; } img, svg, video, canvas, audio, iframe, embed, object { display: block; vertical-align: middle; } }";

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
          {/* dist/styles.css ships without preflight, so user-agent margins would space the blocks. */}
          <style>{PREFLIGHT_STAND_IN}</style>
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

  it("lets a consumer rule on a description's block child override its spacing", () => {
    renderThemed(
      <>
        {/* Unlayered, like the Fuse utilities in dist/styles.css: specificity alone decides. */}
        <style>{".consumer-description > ul { margin-top: 0; }"}</style>
        <style>{PREFLIGHT_STAND_IN}</style>
        <Alert.Root>
          <Alert.Title>Before you move</Alert.Title>
          <Alert.Description className="consumer-description">
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
    // A class and a child combinator outrank a spacing rule that is one class deep.
    expect(list.top - paragraph.bottom).toBe(0);
  });

  it("keeps the block step under unlayered margin resets on a preflight-free host", () => {
    // The worst order for each reset: an element reset before the Fuse stylesheet, where it ties
    // on order, and a universal reset after it, where it would win any tie.
    const elementReset = document.createElement("style");
    elementReset.textContent = "p, ul { margin: 0; }";
    document.head.prepend(elementReset);
    const universalReset = document.createElement("style");
    universalReset.textContent = "* { margin: 0; }";
    document.head.append(universalReset);
    onTestFinished(() => {
      elementReset.remove();
      universalReset.remove();
    });
    renderThemed(
      <Alert.Root>
        <Alert.Title>Before you move</Alert.Title>
        <Alert.Description>
          <p>Have these ready:</p>
          <ul>
            <li>Meter number</li>
          </ul>
        </Alert.Description>
      </Alert.Root>
    );
    const paragraph = textNamed("Have these ready:").getBoundingClientRect();
    const list = page.getByRole("list").element().getBoundingClientRect();
    // The documented block step is 8px, twice the title's 4px gap.
    expect(list.top - paragraph.bottom).toBe(8);
  });

  it("lets a consumer's Tailwind spacing class on the description override its spacing", () => {
    // The host's build emits `[&>*+*]:mt-0`, not dist/styles.css. Placed before the Fuse
    // stylesheet, it can only win on specificity: on a tie, the later Fuse rule would win.
    const consumerRule = document.createElement("style");
    consumerRule.textContent = String.raw`.\[\&\>\*\+\*\]\:mt-0 > * + * { margin-top: 0; }`;
    document.head.prepend(consumerRule);
    onTestFinished(() => consumerRule.remove());
    renderThemed(
      <>
        <style>{PREFLIGHT_STAND_IN}</style>
        <Alert.Root>
          <Alert.Title>Before you move</Alert.Title>
          <Alert.Description className="[&>*+*]:mt-0">
            <p>Have these ready:</p>
            <p>Your meter number.</p>
          </Alert.Description>
        </Alert.Root>
      </>
    );
    const first = textNamed("Have these ready:").getBoundingClientRect();
    const second = textNamed("Your meter number.").getBoundingClientRect();
    expect(second.top - first.bottom).toBe(0);
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

  /** Inline-level children that honour a top margin, unlike a plain inline run. */
  const INLINE_BLOCKS = [
    {
      name: "link-styled button",
      inline: (
        <button type="button" style={{ font: "inherit", padding: 0, border: 0, background: "none" }}>
          that
        </button>
      ),
    },
    { name: "Badge", inline: <Badge>active</Badge> },
    { name: "image", inline: <img src={PIXEL} alt="meter" width={16} height={16} /> },
  ] as const;

  /** The rendered height of a description holding `content`. */
  function descriptionHeightOf(content: ReactNode): number {
    const { unmount } = renderThemed(
      <Alert.Root>
        <Alert.Title>Switch scheduled</Alert.Title>
        <Alert.Description>{content}</Alert.Description>
      </Alert.Root>
    );
    const height = descriptionIn(alertNamed("default")).getBoundingClientRect().height;
    unmount();
    return height;
  }

  it("keeps an inline-block child after another inline element on the sentence's line box", () => {
    for (const { name, inline } of INLINE_BLOCKS) {
      // Without an element before it, nothing can space the child; that sentence is the baseline.
      const alone = descriptionHeightOf(<>See this and {inline}.</>);
      const afterEmphasis = descriptionHeightOf(
        <>
          See <strong>this</strong> and {inline}.
        </>
      );
      // Emphasis changes the weight of a word, not the height of the line it sits on.
      expect.soft(afterEmphasis, name).toBe(alone);
    }
  });

  it.each(HOSTS)(
    "centres the icon on the title's first line beside a multi-line description, in a %s host",
    (host) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        for (const variant of VARIANTS) {
          const { unmount } = renderThemed(
            <div style={{ width: "240px" }}>
              <style>{hostCss(host)}</style>
              <Alert.Root variant={variant}>
                <Alert.Title>Switch scheduled</Alert.Title>
                <Alert.Description>
                  The supplier switch completes on the first day of next month, and the final invoice from the
                  current supplier follows within six weeks.
                </Alert.Description>
              </Alert.Root>
            </div>
          );
          const icon = iconIn(alertNamed(variant));
          const line = firstLineCentreY(headingNamed("Switch scheduled", 3));
          expect(Math.abs(centreY(icon) - line), `${variant} at ${density}`).toBeLessThanOrEqual(0.5);
          unmount();
        }
      }
    }
  );

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
    // The content column's gap is 0.25rem, 4px at the default 16px root; an `h3` keeps its
    // user-agent block margins in a preflight-free host unless the title resets them.
    expect(title.getBoundingClientRect().top - content.getBoundingClientRect().top).toBeCloseTo(0, 2);
    expect(description.top - title.getBoundingClientRect().bottom).toBeCloseTo(4, 2);
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

describe("Alert focus ring contrast", () => {
  let restoreDocumentTheme: () => void;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
  });

  afterEach(() => {
    restoreDocumentTheme();
  });

  it("draws the warning action's focus ring at 3:1 against the alert fill in every theme and scheme", async () => {
    renderThemed(
      <>
        <button type="button">Focus start</button>
        <Alert.Root variant="warning" onAction={vi.fn()} actionLabel="Retry">
          <Alert.Title>Meter offline</Alert.Title>
        </Alert.Root>
      </>
    );
    roleNamed("button", "Focus start").focus();
    // A real Tab, so the action matches `:focus-visible` and paints the ring.
    await userEvent.keyboard("{Tab}");
    const action = roleNamed("button", "Retry");
    expect(document.activeElement).toBe(action);
    const root = alertNamed("warning");
    // renderThemed's ThemeScope stamp outranks the document's, so the theme goes on that
    // scope and the scheme on the document.
    const scope = root.closest<HTMLElement>("[data-theme-brand]");
    if (scope === null || scope === document.documentElement) {
      throw new Error("expected the alert inside renderThemed's ThemeScope");
    }

    for (const scheme of ["light", "dark"] as const) {
      for (const theme of LEGAL_THEMES) {
        stampDocumentTheme(theme, scheme);
        stampTheme(scope, theme);
        settleTransitions(root, action);
        const [ring] = ringLayers(action);
        const context = `${themeSlug(theme)} ${scheme}`;
        expect(ring, context).toBeDefined();
        // WCAG 1.4.11: the ring's outer edge sits flush on the warning-soft surface.
        expect
          .soft(computedContrast(ring?.color ?? "", getComputedStyle(root).backgroundColor), context)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });
});
