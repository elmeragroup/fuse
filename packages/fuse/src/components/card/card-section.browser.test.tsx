import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { RADIUS_LG } from "../../../test/inner-corner-specimens";
import { cssVarColor, fkasExternal, px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Dialog } from "../dialog";
import { Card } from "./card";

/** An element's four paddings in px, top, right, bottom, left. */
function paddings(element: HTMLElement): readonly number[] {
  const style = getComputedStyle(element);
  return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px);
}

/** An element's four border radii in px, top-left, top-right, bottom-right, bottom-left. */
function corners(element: HTMLElement): readonly number[] {
  const style = getComputedStyle(element);
  return [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].map(px);
}

function ThreeSections({ hiddenEnds = false }: { readonly hiddenEnds?: boolean }) {
  return (
    <Card.Root role="group" aria-label="Order">
      {hiddenEnds ? <Card.Section hidden>Hidden first</Card.Section> : null}
      <Card.Section role="group" aria-label="First">
        First
      </Card.Section>
      <Card.Section role="group" aria-label="Middle">
        Middle
      </Card.Section>
      <Card.Section role="group" aria-label="Last">
        Last
      </Card.Section>
      {hiddenEnds ? <Card.Section hidden>Hidden last</Card.Section> : null}
    </Card.Root>
  );
}

describe("Card.Section", () => {
  // The card's `rounded-lg` is the theme's --radius in both variants (RADIUS_LG, written out by
  // hand), and a section sits inside its 1px border, so its outer corners are one pixel less.
  it.each([
    ["an internal", false, RADIUS_LG.internal - 1],
    ["an external", true, RADIUS_LG.fkas - 1],
  ] as const)(
    "rounds the first and last sections with the card's inner corner in %s theme, and leaves the middle square",
    (_label, external, corner) => {
      renderThemed(
        external ? (
          <ThemeScope theme={fkasExternal}>
            <ThreeSections />
          </ThemeScope>
        ) : (
          <ThreeSections />
        )
      );
      expect(corners(roleNamed("group", "First")), "first").toEqual([corner, corner, 0, 0]);
      expect(corners(roleNamed("group", "Middle")), "middle").toEqual([0, 0, 0, 0]);
      expect(corners(roleNamed("group", "Last")), "last").toEqual([0, 0, corner, corner]);
    }
  );

  it("skips hidden sections when it picks the first and last", () => {
    renderThemed(<ThreeSections hiddenEnds />);
    const corner = RADIUS_LG.internal - 1;
    expect(corners(roleNamed("group", "First")), "first visible").toEqual([corner, corner, 0, 0]);
    expect(px(getComputedStyle(roleNamed("group", "First")).borderTopWidth), "no divider above").toBe(0);
    expect(corners(roleNamed("group", "Last")), "last visible").toEqual([0, 0, corner, corner]);
    // DOM audit: hidden sections have no accessible role, so they are found by their slot.
    const hidden = [...document.querySelectorAll('[data-slot="card-section"][hidden]')];
    expect(hidden, "two hidden sections").toHaveLength(2);
    for (const section of hidden) {
      expect(getComputedStyle(section).display).toBe("none");
    }
    // The first visible section opens the card, inside its 1px border.
    const card = roleNamed("group", "Order").getBoundingClientRect();
    expect(roleNamed("group", "First").getBoundingClientRect().top).toBe(card.top + 1);
  });

  it("is square outside a card", () => {
    renderThemed(
      <Card.Section role="group" aria-label="Loose">
        Loose
      </Card.Section>
    );
    expect(corners(roleNamed("group", "Loose"))).toEqual([0, 0, 0, 0]);
  });

  // The divider aliases --border in internal themes and the page tint, --background, in external
  // ones (tokens/defaults.ts and tokens/external-palettes.ts).
  it.each([
    ["internal", false, "--border"],
    ["external", true, "--background"],
  ] as const)("draws a 1px divider between sections only in an %s theme", (_label, external, role) => {
    renderThemed(
      external ? (
        <ThemeScope theme={fkasExternal}>
          <ThreeSections />
        </ThemeScope>
      ) : (
        <ThreeSections />
      )
    );
    const first = getComputedStyle(roleNamed("group", "First"));
    const middle = roleNamed("group", "Middle");
    const last = roleNamed("group", "Last");
    expect(px(first.borderTopWidth), "none above the first").toBe(0);
    expect(px(getComputedStyle(last).borderBottomWidth), "none below the last").toBe(0);
    for (const section of [middle, last]) {
      const style = getComputedStyle(section);
      expect(px(style.borderTopWidth), section.textContent).toBe(1);
      expect(style.borderTopStyle).toBe("solid");
      expect(style.borderTopColor).toBe(cssVarColor(section, role));
      expect([style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].map(px)).toEqual([
        0, 0, 0,
      ]);
    }
    // Sections run edge to edge inside the card's 1px border.
    const card = roleNamed("group", "Order").getBoundingClientRect();
    const rect = middle.getBoundingClientRect();
    expect(rect.left - card.left).toBe(1);
    expect(card.right - rect.right).toBe(1);
  });

  it("centres the media column beside an unpadded Card.Content column on a two-line section", () => {
    renderThemed(
      <div style={{ width: 320 }}>
        <Card.Root>
          <Card.Section role="group" aria-label="Address">
            <Card.SectionMedia>
              <svg role="img" aria-label="Home" viewBox="0 0 20 20" />
            </Card.SectionMedia>
            <Card.Content role="group" aria-label="Lines">
              <p style={{ margin: 0 }}>12 Example Street</p>
              <p style={{ margin: 0 }}>1234 Sampletown</p>
            </Card.Content>
          </Card.Section>
        </Card.Root>
      </div>
    );
    const svg = page.getByRole("img", { name: "Home", exact: true }).element();
    if (!(svg instanceof SVGElement)) {
      throw new Error("expected the Home icon");
    }
    const icon = svg.getBoundingClientRect();
    const content = roleNamed("group", "Lines");
    const lines = content.getBoundingClientRect();
    // The svg takes size-5, 20px, beside the content in the second column.
    expect(icon.width).toBe(20);
    expect(icon.right).toBeLessThan(lines.left);
    expect(Math.abs(icon.top + icon.height / 2 - (lines.top + lines.height / 2))).toBeLessThanOrEqual(0.5);
    expect(lines.height).toBeGreaterThan(icon.height);
    // The section alone pads: the content column adds no tier of its own, so its box ends on the
    // section's padding edge.
    const section = roleNamed("group", "Address");
    const [top, right, bottom] = paddings(section);
    expect(right, "the section pads").toBeGreaterThan(0);
    expect(paddings(content), "content padding").toEqual([0, 0, 0, 0]);
    const box = section.getBoundingClientRect();
    expect(lines.top).toBe(box.top + top);
    expect(lines.right).toBe(box.right - right);
    expect(lines.bottom).toBe(box.bottom - bottom);
  });

  it("forms the body under a Card.Header: a divider runs under the header and only the last section rounds", () => {
    renderThemed(
      <Card.Root role="group" aria-label="Order">
        <Card.Header role="group" aria-label="Header">
          <Card.Title>Your order</Card.Title>
        </Card.Header>
        <Card.Section role="group" aria-label="First">
          First
        </Card.Section>
        <Card.Section role="group" aria-label="Last">
          Last
        </Card.Section>
      </Card.Root>
    );
    const corner = RADIUS_LG.internal - 1;
    const header = roleNamed("group", "Header");
    const first = roleNamed("group", "First");
    expect(px(getComputedStyle(first).borderTopWidth), "divider under the header").toBe(1);
    expect(getComputedStyle(first).borderTopColor).toBe(cssVarColor(first, "--border"));
    expect(corners(first), "first under a header").toEqual([0, 0, 0, 0]);
    expect(corners(roleNamed("group", "Last")), "last").toEqual([0, 0, corner, corner]);
    // The header keeps its tier on every side, and the first section starts right below it.
    const pad = paddings(header)[0];
    expect(pad).toBeGreaterThan(0);
    expect(paddings(header)).toEqual([pad, pad, pad, pad]);
    expect(first.getBoundingClientRect().top).toBe(header.getBoundingClientRect().bottom);
  });

  it("stays a static, unfilled surface under the pointer", async () => {
    renderThemed(
      <Card.Root>
        <Card.Section role="group" aria-label="Static">
          Moving out on 1 November.
        </Card.Section>
      </Card.Root>
    );
    const section = roleNamed("group", "Static");
    expect(section.tagName).toBe("DIV");
    await userEvent.hover(section);
    settleTransitions(section);
    expect(getComputedStyle(section).cursor).toBe("auto");
    expect(getComputedStyle(section).backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("hides a hidden Card.SectionMedia without preflight", () => {
    renderThemed(
      <Card.Root>
        <Card.Section>
          <Card.SectionMedia hidden>
            <svg aria-hidden viewBox="0 0 20 20" />
          </Card.SectionMedia>
          <Card.Content>Text</Card.Content>
        </Card.Section>
      </Card.Root>
    );
    // DOM audit: hidden media has no accessible role, so it is found by its slot.
    const media = document.querySelector('[data-slot="card-section-media"]');
    if (!(media instanceof HTMLElement)) {
      throw new Error("expected the section media");
    }
    expect(getComputedStyle(media).display).toBe("none");
  });

  it("renders Card.SectionButton as a full-width, start-aligned native button with a pointer and a hover fill", async () => {
    renderThemed(
      <Card.Root role="group" aria-label="Choice">
        <Card.Section>Summary</Card.Section>
        <Card.SectionButton>No thanks, continue without</Card.SectionButton>
      </Card.Root>
    );
    const button = roleNamed("button", "No thanks, continue without");
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    const card = roleNamed("group", "Choice").getBoundingClientRect();
    expect(button.getBoundingClientRect().width).toBe(card.width - 2);
    const style = getComputedStyle(button);
    expect(style.textAlign).toBe("start");
    expect(style.cursor).toBe("pointer");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    // The section inherits the card's type, not the native button's control font.
    expect(style.fontSize).toBe(getComputedStyle(roleNamed("group", "Choice")).fontSize);
    expect(style.fontFamily).toBe(getComputedStyle(roleNamed("group", "Choice")).fontFamily);
    await userEvent.hover(button);
    settleTransitions(button);
    expect(getComputedStyle(button).backgroundColor).toBe(cssVarColor(button, "--muted"));
  });

  it("does not submit the form it sits in", async () => {
    let submits = 0;
    renderThemed(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submits += 1;
        }}>
        <Card.Root>
          <Card.SectionButton>Change plan</Card.SectionButton>
        </Card.Root>
      </form>
    );
    await userEvent.click(roleNamed("button", "Change plan"));
    expect(submits).toBe(0);
  });

  it("lets a consumer's type classes win over the inherited font", () => {
    renderThemed(
      <Card.Root>
        <Card.SectionButton className="text-lg font-semibold">Change plan</Card.SectionButton>
      </Card.Root>
    );
    // Tailwind's text-lg is 1.125rem on the 16px root, and font-semibold is 600.
    const style = getComputedStyle(roleNamed("button", "Change plan"));
    expect(style.fontSize).toBe("18px");
    expect(style.fontWeight).toBe("600");
  });

  it("keeps a disabled button section unfilled on hover, with the not-allowed cursor", async () => {
    renderThemed(
      <Card.Root>
        <Card.SectionButton disabled>Unavailable</Card.SectionButton>
      </Card.Root>
    );
    const button = roleNamed("button", "Unavailable");
    await userEvent.hover(button);
    settleTransitions(button);
    const style = getComputedStyle(button);
    expect(style.cursor).toBe("not-allowed");
    expect(style.opacity).toBe("0.5");
    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  });

  it("draws a keyboard focus ring inside a middle button section, so the sections around it cannot cover it", async () => {
    renderThemed(
      <Card.Root>
        <Card.Section>Above</Card.Section>
        <Card.SectionButton>Change plan</Card.SectionButton>
        <Card.Section role="group" aria-label="Below">
          Below
        </Card.Section>
      </Card.Root>
    );
    await userEvent.keyboard("{Tab}");
    const button = roleNamed("button", "Change plan");
    expect(document.activeElement).toBe(button);
    // One inset 2px ring in --ring: drawn inside the section's own border box on all four sides,
    // which the next section, painted after it, does not reach.
    settleTransitions(button);
    expect(ringLayers(button)).toEqual([
      { spread: "2px", color: cssVarColor(button, "--ring"), inset: true },
    ]);
    expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      roleNamed("group", "Below").getBoundingClientRect().top
    );
  });

  it("renders a link section as a native link with no button type", () => {
    renderThemed(
      <Card.Root>
        <Card.SectionButton render={<a href="#terms" />}>Read the terms</Card.SectionButton>
      </Card.Root>
    );
    const link = roleNamed("link", "Read the terms");
    expect(link.getAttribute("href")).toBe("#terms");
    expect(link.hasAttribute("type")).toBe(false);
    expect(getComputedStyle(link).cursor).toBe("pointer");
    expect(getComputedStyle(link).display).toBe("block");
    expect(getComputedStyle(link).textDecorationLine).toBe("none");
  });

  it("composes into a trigger as Button does, and still rounds as the card's last section", async () => {
    renderThemed(
      <Card.Root>
        <Card.Section>Spot price</Card.Section>
        <Dialog.Root>
          <Dialog.Trigger render={<Card.SectionButton />}>Change plan</Dialog.Trigger>
          <Dialog.Content showCloseButton={false}>
            <Dialog.Title>Plans</Dialog.Title>
          </Dialog.Content>
        </Dialog.Root>
      </Card.Root>
    );
    const trigger = roleNamed("button", "Change plan");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(getComputedStyle(trigger).cursor).toBe("pointer");
    const corner = RADIUS_LG.internal - 1;
    expect(corners(trigger)).toEqual([0, 0, corner, corner]);
    expect(px(getComputedStyle(trigger).borderTopWidth), "divider above").toBe(1);
    await userEvent.click(trigger);
    await expect.element(page.getByRole("dialog", { name: "Plans" })).toBeVisible();
  });
});
