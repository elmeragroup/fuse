import type { ReactElement } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import {
  CASES,
  cornerRadius,
  edgeInset,
  FIELD_CORNER,
  RADIUS_LG,
  RADIUS_MD,
  RADIUS_XL,
} from "../../test/inner-corner-specimens";
import type { PartEdge, Variant } from "../../test/inner-corner-specimens";
import { withLocale } from "../../test/locale-matrix";
import { setupSidebarBrowser } from "../../test/sidebar-browser-fixtures";
import { fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
  textNamed,
} from "../../test/themed-browser-render";
import { Accordion } from "../components/accordion";
import { Card } from "../components/card/card";
import { Combobox } from "../components/combobox";
import { Dialog } from "../components/dialog";
import { Frame } from "../components/frame/frame";
import { NavigationMenu } from "../components/navigation-menu";
import { Sidebar } from "../components/sidebar";
import { Table } from "../components/table/table";
import { Tabs } from "../components/tabs";
import {
  DatePicker,
  DatePickerPresetGroup,
  DatePickerPresetItem,
} from "../react-aria/date-picker/date-picker";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";
import { DENSITIES } from "../theme/density";
import type { Density } from "../theme/density";
import { ThemeScope } from "../theme/theme-scope";

/**
 * An inner part, the shell it sits in, the inline edge where the two meet and, when the shell
 * draws no corner itself, the element whose corner it shares.
 */
type Pair = {
  readonly part: HTMLElement;
  readonly shell: HTMLElement;
  readonly edge: PartEdge;
  readonly corner?: HTMLElement;
};

const PAIR_NAMES = [
  "chip",
  "frame panel",
  "panel block",
  "sidebar row",
  "sidebar label",
  "sidebar action",
  "preset",
  "card block",
  "dialog block",
] as const;

type PairName = (typeof PAIR_NAMES)[number];

/** The pairs every theme renders in one tree of fields and surfaces. */
const BOX_PAIRS = ["chip", "frame panel", "panel block", "card block"] as const satisfies readonly PairName[];

/** The pairs of a floating Sidebar. */
const SIDEBAR_PAIRS = [
  "sidebar row",
  "sidebar label",
  "sidebar action",
] as const satisfies readonly PairName[];

/** Clamp a hand-computed corner at 0, as the concentric rule does. */
function floor(value: number): number {
  return Math.max(0, value);
}

/**
 * The surface metrics in px, written out by hand rather than read from the library: the small
 * tier pads 4px at both densities, the medium tier 12px dense and 16px comfortable, and the
 * large tier 16px dense and 24px comfortable.
 */
const SURFACE_PAD = {
  sm: { dense: 4, comfortable: 4 },
  md: { dense: 12, comfortable: 16 },
  lg: { dense: 16, comfortable: 24 },
} as const satisfies Record<"sm" | "md" | "lg", Record<Density, number>>;

/**
 * Inner corners in px, worked out by hand from each shell's rung and the inset its markup
 * declares at a density, floored at 0. A chip sits 7px inside the field corner, a Frame panel
 * 4px (the small tier) inside the Frame's `rounded-xl`, a block its border and the large tier
 * inside a panel, a floating Sidebar row 4px inside its `rounded-lg` surface with the menu action
 * 4px inside the row, a preset its 1px border and 4px inside the popover's `rounded-md`, a block
 * the border and the large tier inside a Card, and the large tier inside a Dialog's `rounded-xl`.
 * The field parts and tabs `radius-roles.browser.test.tsx` pins are not repeated here.
 */
const EXPECTED = {
  chip: (v) => floor(FIELD_CORNER[v] - 7),
  "frame panel": (v) => floor(RADIUS_XL[v] - 4),
  "panel block": (v, d) => floor(floor(RADIUS_XL[v] - 4) - 1 - SURFACE_PAD.lg[d]),
  "sidebar row": (v) => floor(RADIUS_LG[v] - 4),
  "sidebar label": (v) => floor(RADIUS_LG[v] - 4),
  "sidebar action": (v) => floor(floor(RADIUS_LG[v] - 4) - 4),
  preset: (v) => floor(RADIUS_MD[v] - 1 - 4),
  "card block": (v, d) => floor(RADIUS_LG[v] - 1 - SURFACE_PAD.lg[d]),
  "dialog block": (v, d) => floor(RADIUS_XL[v] - SURFACE_PAD.lg[d]),
} as const satisfies Record<PairName, (variant: Variant, density: Density) => number>;

function expectedFor(name: PairName, variant: Variant, density: Density): number {
  return EXPECTED[name](variant, density);
}

/** The one element with a slot that contains `part`. DOM audit: shells have no role. */
function slotAround(part: HTMLElement, slot: string): HTMLElement {
  const shell = part.closest(`[data-slot="${slot}"]`);
  if (!(shell instanceof HTMLElement)) {
    throw new Error(`expected ${slot} around ${part.textContent}`);
  }
  return shell;
}

/** The one element in the document with a slot, which must contain `part`. */
function slotShell(slot: string, part: HTMLElement): HTMLElement {
  const shell = document.querySelector(`[data-slot="${slot}"]`);
  if (!(shell instanceof HTMLElement) || !shell.contains(part)) {
    throw new Error(`expected ${slot} around ${part.textContent}`);
  }
  return shell;
}

function FieldParts(): ReactElement {
  return (
    <Combobox.Root items={["Apple"]} multiple defaultValue={["Apple"]}>
      <Combobox.Chips aria-label="Selected fruit">
        <Combobox.Chip removeLabel="Remove Apple">Apple</Combobox.Chip>
        <Combobox.ChipsInput aria-label="Fruit" />
      </Combobox.Chips>
    </Combobox.Root>
  );
}

function SurfaceParts(): ReactElement {
  return (
    <>
      <Tabs.Root defaultValue="one">
        <Tabs.List aria-label="Sections">
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>
      <Frame.Root role="group" aria-label="Frame">
        <Frame.Panel role="group" aria-label="Panel">
          <div role="group" aria-label="Panel block" className="rounded-inner" />
        </Frame.Panel>
      </Frame.Root>
      <Card.Root role="group" aria-label="Card">
        <Card.Content>
          <div role="group" aria-label="Card block" className="rounded-inner" />
        </Card.Content>
      </Card.Root>
      <DatePickerPresetGroup aria-label="Presets">
        <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
      </DatePickerPresetGroup>
    </>
  );
}

const FIND = {
  chip: () => {
    const part = slotAround(textNamed("Apple"), "combobox-chip");
    return { part, shell: slotAround(part, "combobox-chips"), edge: "start" };
  },
  "frame panel": () => ({
    part: roleNamed("group", "Panel"),
    shell: roleNamed("group", "Frame"),
    edge: "start",
  }),
  "panel block": () => ({
    part: roleNamed("group", "Panel block"),
    shell: roleNamed("group", "Panel"),
    edge: "start",
  }),
  "card block": () => ({
    part: roleNamed("group", "Card block"),
    shell: roleNamed("group", "Card"),
    edge: "start",
  }),
} as const satisfies Record<(typeof BOX_PAIRS)[number], () => Pair>;

/**
 * Unit under test: an inner part's `rounded-inner` corner, as its shell publishes it. Oracle:
 * the concentric rule max(0, outer − inset), applied to the shell's measured corner and the
 * inset measured between their boxes, plus the hand-computed corner for the theme.
 */
function expectConcentric(
  name: PairName,
  { part, shell, edge, corner = shell }: Pair,
  expected: number
): void {
  expect(shell.contains(part), `${name} inside its shell`).toBe(true);
  const measured = cornerRadius(part);
  const outer = cornerRadius(corner);
  expect(measured, `${name} against its shell`).toBeCloseTo(floor(outer - edgeInset(part, shell, edge)), 1);
  expect(measured, `${name} by hand`).toBeCloseTo(expected, 1);
}

function FloatingSidebar({
  variant,
  collapsible = "offcanvas",
}: {
  readonly variant: "floating" | "sidebar";
  readonly collapsible?: "offcanvas" | "none";
}): ReactElement {
  return withLocale(
    "en-US",
    <Sidebar.Provider>
      <Sidebar.Root variant={variant} collapsible={collapsible}>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
            {/* The page has no preflight, so the list drops the user agent's 40px indent here. */}
            <Sidebar.Menu className="p-0">
              <Sidebar.MenuItem>
                <Sidebar.MenuButton>Overview</Sidebar.MenuButton>
                <Sidebar.MenuAction aria-label="More" />
              </Sidebar.MenuItem>
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
      </Sidebar.Root>
    </Sidebar.Provider>
  );
}

function sidebarPairs() {
  const row = roleNamed("button", "Overview");
  const shell = slotAround(row, "sidebar-inner");
  return {
    "sidebar row": { part: row, shell, edge: "start" },
    "sidebar label": {
      part: slotAround(textNamed("Workspace"), "sidebar-group-label"),
      shell,
      edge: "start",
    },
    // The menu item is the row's box: the action sits in it, beside the button whose corner
    // the item shares.
    "sidebar action": {
      part: roleNamed("button", "More"),
      shell: slotAround(row, "sidebar-menu-item"),
      edge: "end",
      corner: row,
    },
  } satisfies Record<(typeof SIDEBAR_PAIRS)[number], Pair>;
}

describe("concentric inner corners on fields and surfaces", () => {
  // The Sidebar renders its desktop surface only at a desktop viewport.
  setupSidebarBrowser();

  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  for (const density of DENSITIES) {
    describe(density, () => {
      it.each(CASES)(
        "rounds field and surface parts inside their shells (%s)",
        (variant, theme, documentTheme) => {
          stampDocumentTheme(documentTheme, "light");
          stampDensity(density);
          render(
            withLocale(
              "en-US",
              <UiProviders locale="en-US" navigate={() => undefined}>
                <ThemeScope theme={theme}>
                  <FieldParts />
                  <SurfaceParts />
                </ThemeScope>
              </UiProviders>
            )
          );
          for (const name of BOX_PAIRS) {
            expectConcentric(name, FIND[name](), expectedFor(name, variant, density));
          }
        }
      );

      it.each(CASES)(
        "rounds floating Sidebar rows inside the surface (%s)",
        (variant, theme, documentTheme) => {
          stampDocumentTheme(documentTheme, "light");
          stampDensity(density);
          render(
            <ThemeScope theme={theme}>
              <FloatingSidebar variant="floating" />
            </ThemeScope>
          );
          const pairs = sidebarPairs();
          for (const name of SIDEBAR_PAIRS) {
            expectConcentric(name, pairs[name], expectedFor(name, variant, density));
          }
        }
      );

      it.each(CASES)(
        "rounds a preset inside the picker popover (%s)",
        async (variant, theme, documentTheme) => {
          stampDocumentTheme(documentTheme, "light");
          stampDensity(density);
          render(
            withLocale(
              "en-US",
              <UiProviders locale="en-US" navigate={() => undefined}>
                <ThemeScope theme={theme}>
                  <DatePicker
                    label="Due"
                    defaultOpen
                    presetGroup={
                      <DatePickerPresetGroup aria-label="Presets">
                        <DatePickerPresetItem value="today">Today</DatePickerPresetItem>
                      </DatePickerPresetGroup>
                    }
                  />
                </ThemeScope>
              </UiProviders>
            )
          );
          const preset = await vi.waitFor(() => roleNamed("radio", "Today").closest("label"));
          if (!(preset instanceof HTMLElement)) {
            throw new Error("expected the preset label");
          }
          // DOM audit: React Aria's popover has no role of its own; it carries the placement.
          const popover = preset.closest("[data-placement]");
          if (!(popover instanceof HTMLElement)) {
            throw new Error("expected the picker popover around the preset");
          }
          await waitForAnimations(popover);
          expectConcentric(
            "preset",
            { part: preset, shell: popover, edge: "start" },
            expectedFor("preset", variant, density)
          );
        }
      );

      it.each(CASES)("rounds a custom block inside a Dialog (%s)", async (variant, theme, documentTheme) => {
        stampDocumentTheme(documentTheme, "light");
        stampDensity(density);
        render(
          withLocale(
            "en-US",
            <ThemeScope theme={theme}>
              <Dialog.Root defaultOpen>
                <Dialog.Content>
                  <Dialog.Title>Terms</Dialog.Title>
                  <div role="group" aria-label="Dialog block" className="rounded-inner" />
                </Dialog.Content>
              </Dialog.Root>
            </ThemeScope>
          )
        );
        const block = await vi.waitFor(() => roleNamed("group", "Dialog block"));
        const dialog = slotShell("dialog-content", block);
        await waitForAnimations(dialog);
        expectConcentric(
          "dialog block",
          { part: block, shell: dialog, edge: "start" },
          expectedFor("dialog block", variant, density)
        );
      });
    });
  }

  it.each(CASES)(
    "keeps the outer rounded-md corner on a non-floating Sidebar's rows (%s)",
    (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <FloatingSidebar variant="sidebar" />
        </ThemeScope>
      );
      const { "sidebar row": row, "sidebar label": label, "sidebar action": action } = sidebarPairs();
      for (const [name, pair] of [
        ["row", row],
        ["label", label],
        ["action", action],
      ] as const) {
        expect(cornerRadius(pair.part), name).toBe(RADIUS_MD[variant]);
      }
    }
  );

  it("keeps the outer rounded-md corner on a floating Sidebar that renders no rounded surface", () => {
    // `collapsible="none"` renders the Sidebar without its rounded inner surface.
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={fkasPrivate}>
        <FloatingSidebar variant="floating" collapsible="none" />
      </ThemeScope>
    );
    expect(document.querySelector('[data-slot="sidebar-inner"]')).toBeNull();
    for (const [name, element] of [
      ["row", roleNamed("button", "Overview")],
      ["label", slotAround(textNamed("Workspace"), "sidebar-group-label")],
      ["action", roleNamed("button", "More")],
    ] as const) {
      expect(cornerRadius(element), name).toBe(RADIUS_MD.internal);
    }
  });

  it.each([
    ["in a NavigationMenu popup", "navigation"],
    ["in a Card", "card"],
    ["in a Card in a NavigationMenu popup", "navigation card"],
  ] as const)("keeps a standalone Frame panel's own rounded-xl %s", async (_label, place) => {
    stampDocumentTheme(fkasPrivate, "light");
    const panel = <Frame.Panel role="group" aria-label="Lone panel" />;
    const inCard = (
      <Card.Root>
        <Card.Content>{panel}</Card.Content>
      </Card.Root>
    );
    render(
      <ThemeScope theme={tkasCompany}>
        {place === "card" ? (
          inCard
        ) : (
          <NavigationMenu.Root aria-label="Site" defaultValue="tools">
            <NavigationMenu.List>
              <NavigationMenu.Item value="tools">
                <NavigationMenu.Trigger>Tools</NavigationMenu.Trigger>
                <NavigationMenu.Content>{place === "navigation" ? panel : inCard}</NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
        )}
      </ThemeScope>
    );
    const element = await vi.waitFor(() => roleNamed("group", "Lone panel"));
    // tkas rounds `rounded-xl` at 20px, and the inset highlight sits 1px inside it.
    expect(cornerRadius(element)).toBe(20);
    expect(px(getComputedStyle(element, "::before").borderTopLeftRadius)).toBe(19);
  });

  it.each([
    // An internal theme at a 32px radius, dense: every rung is 32px. A rounded item pads 12px,
    // the medium tier, and a bordered card item 13px. An unrounded infodropdown item is no
    // shell, so a block in it rounds with --radius.
    ["default", "none", 20],
    ["default", "lg", 20],
    ["default", "xl", 20],
    ["card", "none", 19],
    ["card", "lg", 19],
    ["card", "xl", 19],
    ["infodropdown", "none", 32],
    ["infodropdown", "lg", 20],
    ["infodropdown", "xl", 20],
  ] as const)("rounds a block in a %s Accordion item with radius %s", (variant, radius, expected) => {
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={fkasPrivate} style={{ "--radius": "32px" }}>
        <Accordion.Root variant={variant} radius={radius} defaultValue={["one"]}>
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
    expect(cornerRadius(roleNamed("group", "Item block"))).toBe(expected);
  });

  it.each([
    ["direct", true],
    ["standalone", false],
  ] as const)("lets a consumer's rounded-none replace a %s Frame panel's corners", (_label, direct) => {
    stampDocumentTheme(fkasPrivate, "light");
    const panel = (
      <Frame.Panel role="group" aria-label="Flat panel" className="rounded-none before:rounded-none" />
    );
    render(<ThemeScope theme={tkasCompany}>{direct ? <Frame.Root>{panel}</Frame.Root> : panel}</ThemeScope>);
    const element = roleNamed("group", "Flat panel");
    expect(cornerRadius(element)).toBe(0);
    expect(px(getComputedStyle(element, "::before").borderTopLeftRadius)).toBe(0);
  });

  it.each(CASES)(
    "keeps a Table body's rounded-xl corners away from the Frame's padding edge (%s)",
    (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      const table = (label: string) => (
        <Table.Root aria-label={label}>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Cell</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      );
      render(
        <ThemeScope theme={theme}>
          <Frame.Root>
            <Frame.Panel>{table("In a panel")}</Frame.Panel>
            <div>
              <Frame.Panel>{table("In a nested panel")}</Frame.Panel>
            </div>
            {table("In the frame")}
          </Frame.Root>
        </ThemeScope>
      );
      const corner = (label: string) => {
        const body = roleNamed("table", label).querySelector("tbody");
        const cell = roleNamed("table", label).querySelector("td");
        if (!(body instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
          throw new Error(`expected a body and a cell in ${label}`);
        }
        return { body: cornerRadius(body), cell: cornerRadius(cell) };
      };
      // A table in a panel sits 25px inside the Frame, so it keeps `rounded-xl`. Only a table
      // directly in the Frame takes the Frame's corner less its 4px padding.
      for (const label of ["In a panel", "In a nested panel"]) {
        expect(corner(label), label).toEqual({ body: RADIUS_XL[variant], cell: RADIUS_XL[variant] });
      }
      const relayed = floor(RADIUS_XL[variant] - 4);
      expect(corner("In the frame"), "In the frame").toEqual({ body: relayed, cell: relayed });
    }
  );

  it.each(CASES)(
    "draws a Frame panel's highlight 1px inside its corner (%s)",
    (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <Frame.Root>
            <Frame.Panel role="group" aria-label="Lit panel" />
          </Frame.Root>
        </ThemeScope>
      );
      // The panel takes the Frame's `rounded-xl` less its 4px padding, and the highlight 1px less.
      const highlight = getComputedStyle(roleNamed("group", "Lit panel"), "::before").borderTopLeftRadius;
      expect(px(highlight)).toBe(floor(RADIUS_XL[variant] - 4 - 1));
    }
  );

  it.each(CASES)("rounds stacked Frame panels as one card (%s)", (variant, theme, documentTheme) => {
    stampDocumentTheme(documentTheme, "light");
    render(
      <ThemeScope theme={theme}>
        <Frame.Root stackedPanels>
          <Frame.Panel role="group" aria-label="Upper panel" />
          <Frame.Panel role="group" aria-label="Lower panel" />
        </Frame.Root>
      </ThemeScope>
    );
    // The stack keeps the panel corner, `rounded-xl` less the Frame's 4px, on its outer ends.
    const corner = floor(RADIUS_XL[variant] - 4);
    const upper = getComputedStyle(roleNamed("group", "Upper panel"));
    const lower = getComputedStyle(roleNamed("group", "Lower panel"));
    expect(px(upper.borderTopLeftRadius), "upper top").toBe(corner);
    expect(px(upper.borderBottomLeftRadius), "upper bottom").toBe(0);
    expect(px(lower.borderTopLeftRadius), "lower top").toBe(0);
    expect(px(lower.borderBottomLeftRadius), "lower bottom").toBe(corner);
  });

  it("fits a tab's focus ring and target inside the list at both densities", async () => {
    stampDocumentTheme(fkasPrivate, "light");
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = render(
        <>
          <button type="button">Before</button>
          <Tabs.Root defaultValue="one">
            <Tabs.List aria-label="Sections">
              <Tabs.Trigger value="one">One</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </>
      );
      await userEvent.click(roleNamed("button", "Before"));
      await userEvent.keyboard("{Tab}");
      const tab = roleNamed("tab", "One");
      const list = roleNamed("tablist", "Sections");
      expect(tab.matches(":focus-visible"), density).toBe(true);
      // The shared ring is 2px wide on a 2px offset, so it reaches 4px past the trigger.
      for (const edge of ["start", "end"] as const) {
        expect(edgeInset(tab, list, edge), `${density} ${edge}`).toBeGreaterThanOrEqual(4);
      }
      expect(tab.getBoundingClientRect().height, `${density} target`).toBeGreaterThanOrEqual(24);
      unmount();
    }
  });

  it.each(CASES)(
    "keeps the outer rounded-md corner on a line Tabs trigger (%s)",
    (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <Tabs.Root defaultValue="one">
            <Tabs.List variant="line" aria-label="Sections">
              <Tabs.Trigger value="one">One</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        </ThemeScope>
      );
      expect(cornerRadius(roleNamed("tab", "One"))).toBe(RADIUS_MD[variant]);
    }
  );
});

async function waitForAnimations(element: HTMLElement): Promise<void> {
  await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished));
}
