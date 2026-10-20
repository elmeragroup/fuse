import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { RADIUS_LG } from "../../../test/inner-corner-specimens";
import { cssVarColor, fkasExternal, px, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Card } from "./card";

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
      expect(getComputedStyle(section).display, section.textContent ?? "").toBe("none");
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

  it("centres the media column on a two-line section", () => {
    renderThemed(
      <div style={{ width: 320 }}>
        <Card.Root>
          <Card.Section role="group" aria-label="Address">
            <Card.SectionMedia>
              <svg role="img" aria-label="Home" viewBox="0 0 20 20" />
            </Card.SectionMedia>
            <div role="group" aria-label="Lines">
              <p style={{ margin: 0 }}>12 Example Street</p>
              <p style={{ margin: 0 }}>1234 Sampletown</p>
            </div>
          </Card.Section>
        </Card.Root>
      </div>
    );
    const svg = page.getByRole("img", { name: "Home", exact: true }).element();
    if (!(svg instanceof SVGElement)) {
      throw new Error("expected the Home icon");
    }
    const icon = svg.getBoundingClientRect();
    const lines = roleNamed("group", "Lines").getBoundingClientRect();
    // The svg takes size-5, 20px, beside the content in the second column.
    expect(icon.width).toBe(20);
    expect(icon.right).toBeLessThan(lines.left);
    expect(Math.abs(icon.top + icon.height / 2 - (lines.top + lines.height / 2))).toBeLessThanOrEqual(0.5);
    expect(lines.height).toBeGreaterThan(icon.height);
  });

  it("renders a button section as a full-width, start-aligned native button with a pointer and a hover fill", async () => {
    renderThemed(
      <Card.Root role="group" aria-label="Choice">
        <Card.Section>Summary</Card.Section>
        <Card.Section render={<button type="button" />}>No thanks, continue without</Card.Section>
      </Card.Root>
    );
    const button = roleNamed("button", "No thanks, continue without");
    expect(button.tagName).toBe("BUTTON");
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

  it("keeps a disabled button section unfilled on hover, with the not-allowed cursor", async () => {
    renderThemed(
      <Card.Root>
        <Card.Section render={<button type="button" disabled />}>Unavailable</Card.Section>
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
        <Card.Section render={<button type="button" />}>Change plan</Card.Section>
        <Card.Section role="group" aria-label="Below">
          Below
        </Card.Section>
      </Card.Root>
    );
    await userEvent.keyboard("{Tab}");
    const button = roleNamed("button", "Change plan");
    expect(document.activeElement).toBe(button);
    // An inset 2px ring in --ring: a box shadow drawn inside the section's own border box on all
    // four sides, which the next section, painted after it, does not reach.
    const shadow = getComputedStyle(button).boxShadow;
    const ring = cssVarColor(button, "--ring");
    expect(shadow).toContain(`${ring} 0px 0px 0px 2px inset`);
    expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      roleNamed("group", "Below").getBoundingClientRect().top
    );
  });

  it("renders a link section as a native link", () => {
    renderThemed(
      <Card.Root>
        <Card.Section render={<a href="#terms" />}>Read the terms</Card.Section>
      </Card.Root>
    );
    const link = roleNamed("link", "Read the terms");
    expect(link.getAttribute("href")).toBe("#terms");
    expect(getComputedStyle(link).cursor).toBe("pointer");
    expect(getComputedStyle(link).display).toBe("block");
    expect(getComputedStyle(link).textDecorationLine).toBe("none");
  });
});
