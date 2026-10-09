import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { cornerRadius } from "../../test/inner-corner-specimens";
import { withLocale } from "../../test/locale-matrix";
import { fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import { px, renderThemed, roleNamed, stampDensity } from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Card } from "../components/card/card";
import { DropdownMenu } from "../components/dropdown-menu";
import { Empty } from "../components/empty/empty";
import { Popover } from "../components/popover";
import { PopoverInfoButton } from "../components/popover-info-button/popover-info-button";
import { Select } from "../components/select";
import { Sidebar } from "../components/sidebar";
import { DENSITIES } from "../theme/density";
import type { Density } from "../theme/density";
import { ThemeScope } from "../theme/theme-scope";

/**
 * The surface tiers in px, written out by hand rather than read from the library: the small
 * tier pads 4px at both densities, the medium tier 12px dense and 16px comfortable, and the
 * large tier 16px dense and 24px comfortable. Empty doubles the large tier from `md` up.
 */
const SURFACE = {
  sm: { dense: 4, comfortable: 4 },
  md: { dense: 12, comfortable: 16 },
  lg: { dense: 16, comfortable: 24 },
  emptyWide: { dense: 32, comfortable: 48 },
} as const satisfies Record<string, Record<Density, number>>;

/**
 * A menu row in px: the sm control height and the xs control inset, 32px and 8px dense and
 * 36px and 12px comfortable.
 */
const ROW = {
  dense: { height: 32, inset: 8 },
  comfortable: { height: 36, inset: 12 },
} as const satisfies Record<Density, { readonly height: number; readonly inset: number }>;

/** An element's four paddings in px. */
function paddings(element: HTMLElement): readonly number[] {
  const style = getComputedStyle(element);
  return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(px);
}

/** The one element in the document with a slot, which must contain `part`. */
function slotShell(slot: string, part: HTMLElement): HTMLElement {
  // DOM audit: popups and sections have no role of their own, so a shell is found by its slot.
  const shell = document.querySelector(`[data-slot="${slot}"]`);
  if (!(shell instanceof HTMLElement) || !shell.contains(part)) {
    throw new Error(`expected ${slot} around ${part.textContent}`);
  }
  return shell;
}

describe("surface metrics follow document density", () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    document.documentElement.style.removeProperty("font-size");
  });

  for (const density of DENSITIES) {
    describe(density, () => {
      it("pads a DropdownMenu with the small tier and sizes its rows as controls", async () => {
        stampDensity(density);
        renderThemed(
          <DropdownMenu.Root defaultOpen>
            <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Profile</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        );
        const row = await vi.waitFor(() => roleNamed("menuitem", "Profile"));
        const tier = SURFACE.sm[density];
        expect(paddings(slotShell("dropdown-menu-content", row))).toEqual([tier, tier, tier, tier]);
        // The layout height, which the popup's opening zoom does not scale.
        expect(row.offsetHeight, "row height").toBe(ROW[density].height);
        const style = getComputedStyle(row);
        expect(px(style.paddingLeft), "row start").toBe(ROW[density].inset);
        expect(px(style.paddingRight), "row end").toBe(ROW[density].inset);
      });

      it("pads a Select group with the small tier and leaves room for the check after the row inset", async () => {
        stampDensity(density);
        renderThemed(
          <Select.Root defaultOpen>
            <Select.Trigger aria-label="Fruit">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Content alignItemWithTrigger={false}>
              <Select.Group>
                <Select.Item value="apple">Apple</Select.Item>
              </Select.Group>
            </Select.Content>
          </Select.Root>
        );
        const row = await vi.waitFor(() => roleNamed("option", "Apple"));
        const tier = SURFACE.sm[density];
        expect(paddings(slotShell("select-group", row))).toEqual([tier, tier, tier, tier]);
        // The layout height, which the popup's opening zoom does not scale.
        expect(row.offsetHeight, "row height").toBe(ROW[density].height);
        const style = getComputedStyle(row);
        expect(px(style.paddingLeft), "row start").toBe(ROW[density].inset);
        // The trailing check is 16px wide and sits 8px from the label.
        expect(px(style.paddingRight), "row end").toBe(ROW[density].inset + 24);
      });

      it("pads a Popover with the medium tier", async () => {
        stampDensity(density);
        renderThemed(
          <Popover.Root defaultOpen>
            <Popover.Trigger>Details</Popover.Trigger>
            <Popover.Content>
              <Popover.Title>Tariff</Popover.Title>
            </Popover.Content>
          </Popover.Root>
        );
        const popup = await vi.waitFor(() => roleNamed("dialog", "Tariff"));
        const tier = SURFACE.md[density];
        expect(paddings(popup)).toEqual([tier, tier, tier, tier]);
      });

      it("pads a PopoverInfoButton popup with the medium tier and rounds a block inside it by that tier", async () => {
        stampDensity(density);
        renderThemed(
          withLocale(
            "en-US",
            <ThemeScope theme={tkasCompany} style={{ "--radius": "32px" }}>
              <PopoverInfoButton label="About the tariff">
                <div role="group" aria-label="Info block" className="rounded-inner" />
              </PopoverInfoButton>
            </ThemeScope>
          )
        );
        await userEvent.click(roleNamed("button", "About the tariff"));
        const block = await vi.waitFor(() => roleNamed("group", "Info block"));
        const tier = SURFACE.md[density];
        expect(paddings(slotShell("popover-content", block))).toEqual([tier, tier, tier, tier]);
        // tkas at 32px: `rounded-md` is 30px, less the medium tier: 18px dense, 14px comfortable.
        expect(cornerRadius(block)).toBe({ dense: 18, comfortable: 14 }[density]);
      });

      it("pads an unrounded infodropdown Accordion item with the medium tier and publishes no corner", () => {
        stampDensity(density);
        renderThemed(
          <ThemeScope theme={fkasPrivate} style={{ "--radius": "32px" }}>
            <Accordion.Root variant="infodropdown" defaultValue={["one"]}>
              <Accordion.Item value="one">
                <Accordion.Header>
                  <Accordion.Trigger>Details</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <div role="group" aria-label="Item block" className="rounded-inner" />
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </ThemeScope>
        );
        const block = roleNamed("group", "Item block");
        const item = block.closest('[data-slot="accordion-item"]');
        if (!(item instanceof HTMLElement)) {
          throw new Error("expected the accordion item around the block");
        }
        const tier = SURFACE.md[density];
        expect(paddings(item)).toEqual([tier, tier, tier, tier]);
        // The item is no shell, so the block rounds with the scope's 32px --radius.
        expect(cornerRadius(block)).toBe(32);
      });

      it("sizes a Sidebar menu skeleton as the default menu row", () => {
        stampDensity(density);
        renderThemed(<Sidebar.MenuSkeleton role="group" aria-label="Loading row" />);
        const skeleton = roleNamed("group", "Loading row");
        expect(skeleton.offsetHeight, "height").toBe(ROW[density].height);
        const style = getComputedStyle(skeleton);
        expect(px(style.paddingLeft), "start").toBe(ROW[density].inset);
        expect(px(style.paddingRight), "end").toBe(ROW[density].inset);
      });

      it("pads Card sections with the large tier and gaps them by it", () => {
        stampDensity(density);
        renderThemed(
          <Card.Root role="group" aria-label="Plan">
            <Card.Header>
              <div role="group" aria-label="Header block" className="h-4" />
            </Card.Header>
            <Card.Content>
              <div role="group" aria-label="Content block" className="h-4" />
            </Card.Content>
            <Card.Footer>
              <div role="group" aria-label="Footer block" className="h-4" />
            </Card.Footer>
          </Card.Root>
        );
        const tier = SURFACE.lg[density];
        const card = roleNamed("group", "Plan").getBoundingClientRect();
        const header = roleNamed("group", "Header block").getBoundingClientRect();
        const content = roleNamed("group", "Content block").getBoundingClientRect();
        const footer = roleNamed("group", "Footer block").getBoundingClientRect();
        // The card's 1px border sits outside each section's padding.
        expect(header.top - card.top - 1, "header top").toBe(tier);
        expect(header.left - card.left - 1, "header start").toBe(tier);
        expect(content.top - header.bottom, "header to content").toBe(tier);
        expect(footer.top - content.bottom, "content to footer").toBe(tier);
        expect(card.bottom - 1 - footer.bottom, "footer bottom").toBe(tier);
      });

      it("pads a horizontal Card and gaps its sections with the large tier", () => {
        stampDensity(density);
        renderThemed(
          <div style={{ width: "960px" }}>
            <Card.Root direction="horizontal" role="group" aria-label="Wide plan">
              <Card.Header direction="horizontal" role="group" aria-label="Wide header" />
              <Card.Content direction="horizontal" role="group" aria-label="Wide content" />
            </Card.Root>
          </div>
        );
        const tier = SURFACE.lg[density];
        const card = roleNamed("group", "Wide plan").getBoundingClientRect();
        const header = roleNamed("group", "Wide header").getBoundingClientRect();
        const content = roleNamed("group", "Wide content").getBoundingClientRect();
        expect(header.left - card.left - 1, "start").toBe(tier);
        expect(header.top, "one row").toBe(content.top);
        expect(content.left - header.right, "gap").toBe(tier);
      });

      it("pads Empty with the large tier, doubled from md up", async () => {
        stampDensity(density);
        await page.viewport(640, 800);
        const { unmount } = renderThemed(<Empty.Root role="group" aria-label="Narrow" />);
        const narrow = SURFACE.lg[density];
        expect(paddings(roleNamed("group", "Narrow"))).toEqual([narrow, narrow, narrow, narrow]);
        unmount();

        await page.viewport(1024, 800);
        renderThemed(<Empty.Root role="group" aria-label="Wide" />);
        const wide = SURFACE.emptyWide[density];
        expect(paddings(roleNamed("group", "Wide"))).toEqual([wide, wide, wide, wide]);
      });
    });
  }
});
