import { useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { render } from "../../test/browser-render";
import {
  CASES,
  cornerRadius,
  expectShellOnThemeElementWins,
  RADIUS,
} from "../../test/inner-corner-specimens";
import type { Variant } from "../../test/inner-corner-specimens";
import { withLocale } from "../../test/locale-matrix";
import { panelControlledBy } from "../../test/panel-transition";
import { fkasPrivate, tkasCompany } from "../../test/theme-fixtures";
import {
  px,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../test/themed-browser-render";
import { Combobox } from "../components/combobox";
import { DropdownMenu } from "../components/dropdown-menu";
import { NavigationMenu } from "../components/navigation-menu";
import { Select } from "../components/select";
import { DENSITIES } from "../theme/density";
import { useTheme } from "../theme/theme-provider";
import { ThemeScope } from "../theme/theme-scope";

const FAMILY_NAMES = [
  "dropdown",
  "submenu",
  "combobox",
  "combobox search",
  "combobox empty",
  "select group",
  "select ungrouped",
  "navigation",
  "navigation nested",
  "navigation nested popup",
] as const;

type Family = (typeof FAMILY_NAMES)[number];

/**
 * Row corners in px, worked out by hand. Each row rounds with its shell's corner less the inset
 * between them, floored at 0. The DropdownMenu popups and the Combobox popup round with
 * `rounded-md` (`--radius` less one 2px external step) and pad 4px, the Combobox through its
 * List whether or not a search group sits above it. An empty List drops its padding, so a block
 * in it rounds like the popup. The NavigationMenu popup rounds with `rounded-md` and its content
 * pads 4px, the small surface tier, at both densities, as the dropdowns do. A NavigationMenu
 * panel nested in another sits behind both contents' 4px, 8px in all. A NavigationMenu popup
 * mounted inside another's Content is a shell of its own and insets its rows 4px. The Select
 * popup rounds with `rounded-lg` (`--radius`) and pads nothing, and a Select group pads 4px.
 * `--radius` is 6px internal, and external 12px for fkas, 16px for tkas and 8px for guen, so
 * `rounded-md` is 6px internal, 10px for fkas, 14px for tkas and 6px for guen.
 */
const EXPECTED = {
  internal: {
    dropdown: 2,
    submenu: 2,
    combobox: 2,
    "combobox search": 2,
    "combobox empty": 6,
    "select group": 2,
    "select ungrouped": 6,
    navigation: 2,
    "navigation nested": 0,
    "navigation nested popup": 2,
  },
  fkas: {
    dropdown: 6,
    submenu: 6,
    combobox: 6,
    "combobox search": 6,
    "combobox empty": 10,
    "select group": 8,
    "select ungrouped": 12,
    navigation: 6,
    "navigation nested": 2,
    "navigation nested popup": 6,
  },
  tkas: {
    dropdown: 10,
    submenu: 10,
    combobox: 10,
    "combobox search": 10,
    "combobox empty": 14,
    "select group": 12,
    "select ungrouped": 16,
    navigation: 10,
    "navigation nested": 6,
    "navigation nested popup": 10,
  },
  guen: {
    dropdown: 2,
    submenu: 2,
    combobox: 2,
    "combobox search": 2,
    "combobox empty": 6,
    "select group": 4,
    "select ungrouped": 8,
    navigation: 2,
    "navigation nested": 0,
    "navigation nested popup": 2,
  },
} as const satisfies Record<Variant, Record<Family, number>>;

/**
 * A free-standing vertical NavigationMenu row's outer `rounded-sm` corner in px: `--radius` less
 * two 2px external steps, so 6px internal, 8px for fkas, 12px for tkas and 4px for guen.
 */
const OUTER_ROW = { internal: 6, fkas: 8, tkas: 12, guen: 4 } as const satisfies Record<Variant, number>;

/**
 * A row two 4px panels deep, in px: `rounded-md` less 8px. It is a row in an inline
 * NavigationMenu panel inside a DropdownMenu, behind the dropdown's 4px and the panel's 4px, or
 * a row in an inline panel inside a popup's Content, behind both contents' 4px.
 */
const TWO_PANELS_DEEP_ROW = { internal: 0, fkas: 2, tkas: 6, guen: 0 } as const satisfies Record<
  Variant,
  number
>;

/**
 * An open NavigationMenu popup whose Content holds a mount point, so a nested overlay's popup
 * renders inside the outer panel's corner state.
 */
function OpenNavigationPanel({
  children,
}: {
  readonly children: (container: HTMLElement) => ReactNode;
}): ReactElement {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <NavigationMenu.Root aria-label="Site" defaultValue="tools">
      <NavigationMenu.List>
        <NavigationMenu.Item value="tools">
          <NavigationMenu.Trigger>Tools</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <div ref={setContainer} />
            {container === null ? null : children(container)}
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}

/** One open menu family: the row under test and the rounded shell its corner nests in. */
type Specimen = { readonly row: HTMLElement; readonly shell: HTMLElement };

/**
 * The one element in the document with a slot, which must contain the row. DOM audit: popups
 * have no accessible name, so a shell is found by its slot.
 */
function slotShell(slot: string, row: HTMLElement): HTMLElement {
  const shell = document.querySelector(`[data-slot="${slot}"]`);
  if (!(shell instanceof HTMLElement) || !shell.contains(row)) {
    throw new Error(`expected ${slot} around ${row.textContent}`);
  }
  return shell;
}

/** The popup a NavigationMenu trigger controls, which must contain the row. */
function navigationPopup(trigger: string, row: HTMLElement): HTMLElement {
  const popup = panelControlledBy(roleNamed("button", trigger));
  if (popup === null || !popup.contains(row)) {
    throw new Error(`expected the ${trigger} popup around ${row.textContent}`);
  }
  return popup;
}

/** True when `element` sits inside a NavigationMenu Content. */
function closestContent(element: HTMLElement): boolean {
  // DOM audit: the content panel has no role, so it is found by its slot.
  return element.parentElement?.closest('[data-slot="navigation-menu-content"]') != null;
}

/**
 * A ThemeScope inside an outer Content, so a nested Root's popup mounts there. It takes the
 * theme the enclosing scope resolved, so the case still measures the theme under test.
 */
function NestedPopupScope({ children }: { readonly children: ReactNode }): ReactElement {
  return <ThemeScope theme={useTheme()}>{children}</ThemeScope>;
}

const FAMILIES = {
  dropdown: {
    tree: (
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    ),
    find: () => {
      const row = roleNamed("menuitem", "Profile");
      return { row, shell: slotShell("dropdown-menu-content", row) };
    },
  },
  submenu: {
    tree: (
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>File</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Sub defaultOpen>
            <DropdownMenu.SubTrigger>Share</DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item>Email link</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    ),
    find: () => {
      const row = roleNamed("menuitem", "Email link");
      return { row, shell: slotShell("dropdown-menu-sub-content", row) };
    },
  },
  combobox: {
    tree: withLocale(
      "en-US",
      <Combobox.Root items={["Apple"]} open>
        <Combobox.Input aria-label="Fruit" />
        <Combobox.Content>
          <Combobox.List>
            <Combobox.Item value="Apple">Apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    ),
    find: () => {
      const row = roleNamed("option", "Apple");
      return { row, shell: slotShell("combobox-content", row) };
    },
  },
  "combobox search": {
    tree: withLocale(
      "en-US",
      <Combobox.Root items={["Apple"]} open>
        <Combobox.Trigger>Fruit</Combobox.Trigger>
        <Combobox.Content>
          <Combobox.Input showTrigger={false} aria-label="Filter fruit" />
          <Combobox.List>
            <Combobox.Item value="Apple">Apple</Combobox.Item>
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    ),
    find: () => {
      const row = roleNamed("option", "Apple");
      return { row, shell: slotShell("combobox-content", row) };
    },
  },
  "combobox empty": {
    tree: withLocale(
      "en-US",
      <Combobox.Root items={[]} open>
        <Combobox.Input aria-label="Fruit" />
        <Combobox.Content>
          <Combobox.List>
            <div role="group" aria-label="No fruit" className="rounded-inner" />
          </Combobox.List>
        </Combobox.Content>
      </Combobox.Root>
    ),
    find: () => {
      const row = roleNamed("group", "No fruit");
      return { row, shell: slotShell("combobox-content", row) };
    },
  },
  "navigation nested popup": {
    tree: (
      <NavigationMenu.Root aria-label="Site" defaultValue="audiences">
        <NavigationMenu.List>
          <NavigationMenu.Item value="audiences">
            <NavigationMenu.Trigger>Audiences</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              {/* The nested Root's popup portals into this scope, inside the outer Content. */}
              <NestedPopupScope>
                <NavigationMenu.Root orientation="vertical" side="right" defaultValue="homes">
                  <NavigationMenu.List>
                    <NavigationMenu.Item value="homes">
                      <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                      <NavigationMenu.Content>
                        <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>
                </NavigationMenu.Root>
              </NestedPopupScope>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ),
    find: () => {
      const row = roleNamed("link", "Spot price");
      const shell = navigationPopup("Homes", row);
      if (!closestContent(shell)) {
        throw new Error("expected the nested popup inside the outer Content");
      }
      return { row, shell };
    },
  },
  "select group": {
    tree: (
      <Select.Root defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content alignItemWithTrigger={false}>
          <Select.Group>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Group>
          <Select.Item value="pear">Pear</Select.Item>
        </Select.Content>
      </Select.Root>
    ),
    find: () => {
      const row = roleNamed("option", "Apple");
      return { row, shell: slotShell("select-content", row) };
    },
  },
  "select ungrouped": {
    tree: (
      <Select.Root defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder="Pick" />
        </Select.Trigger>
        <Select.Content alignItemWithTrigger={false}>
          <Select.Group>
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Group>
          <Select.Item value="pear">Pear</Select.Item>
        </Select.Content>
      </Select.Root>
    ),
    find: () => {
      const row = roleNamed("option", "Pear");
      return { row, shell: slotShell("select-content", row) };
    },
  },
  navigation: {
    tree: (
      <NavigationMenu.Root aria-label="Site" defaultValue="products">
        <NavigationMenu.List>
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#electricity">Electricity</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ),
    find: () => {
      const row = roleNamed("link", "Electricity");
      return { row, shell: navigationPopup("Products", row) };
    },
  },
  "navigation nested": {
    tree: (
      <NavigationMenu.Root aria-label="Site" defaultValue="audiences">
        <NavigationMenu.List>
          <NavigationMenu.Item value="audiences">
            <NavigationMenu.Trigger>Audiences</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Root orientation="vertical" inline defaultValue="homes">
                <NavigationMenu.List>
                  <NavigationMenu.Item value="homes">
                    <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                    <NavigationMenu.Content>
                      <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                    </NavigationMenu.Content>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
                <NavigationMenu.Viewport />
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ),
    find: () => {
      const row = roleNamed("link", "Spot price");
      return { row, shell: navigationPopup("Audiences", row) };
    },
  },
} as const satisfies Record<Family, { readonly tree: ReactElement; readonly find: () => Specimen }>;

/**
 * The inset from the shell's outer edge to the row along the inline axis that reaches its
 * top-left corner: the padding and border of the shell and of every element between them.
 */
function insetOf({ row, shell }: Specimen): number {
  let inset = 0;
  let element = row.parentElement;
  while (element !== null) {
    const style = getComputedStyle(element);
    inset += px(style.paddingLeft) + px(style.borderLeftWidth);
    if (element === shell) {
      return inset;
    }
    element = element.parentElement;
  }
  throw new Error(`expected ${row.textContent} inside its shell`);
}

async function openFamily(family: Family): Promise<Specimen> {
  const { find } = FAMILIES[family];
  return vi.waitFor(find);
}

describe("concentric inner corners", () => {
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
    for (const [variant, theme, documentTheme] of CASES) {
      describe(`${variant}, ${density}`, () => {
        it.each(FAMILY_NAMES)("rounds a %s row inside its shell", async (family) => {
          stampDocumentTheme(documentTheme, "light");
          stampDensity(density);
          render(<ThemeScope theme={theme}>{FAMILIES[family].tree}</ThemeScope>);
          const specimen = await openFamily(family);
          const measured = cornerRadius(specimen.row);

          // Unit under test: the row's `rounded-inner` corner. Oracle: the concentric rule
          // max(0, outer − inset), applied to the shell's measured corner and the padding and
          // border measured between the shell and the row.
          const outer = cornerRadius(specimen.shell);
          expect(measured, `${family} against its shell`).toBeCloseTo(
            Math.max(0, outer - insetOf(specimen)),
            1
          );
          // Independent oracle: the hand-computed corner for this theme.
          expect(measured, `${family} by hand`).toBeCloseTo(EXPECTED[variant][family], 1);
        });
      });
    }
  }

  it.each(CASES)(
    "keeps the outer rounded-sm corner on free-standing NavigationMenu rows (%s)",
    async (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <NavigationMenu.Root aria-label="Sections" orientation="vertical">
            <NavigationMenu.List>
              <NavigationMenu.Item value="plans">
                <NavigationMenu.Trigger>Plans</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#fixed">Fixed</NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
              <NavigationMenu.Item>
                <NavigationMenu.Link href="#help">Help</NavigationMenu.Link>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <NavigationMenu.Root aria-label="Audiences" orientation="vertical" inline defaultValue="homes">
            <NavigationMenu.List>
              <NavigationMenu.Item value="homes">
                <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                  <div role="group" aria-label="Panel note" className="rounded-inner" />
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
            <NavigationMenu.Viewport />
          </NavigationMenu.Root>
        </ThemeScope>
      );
      expect(cornerRadius(roleNamed("button", "Plans")), "trigger").toBe(OUTER_ROW[variant]);
      expect(cornerRadius(roleNamed("link", "Help")), "link").toBe(OUTER_ROW[variant]);
      // An inline Root's panel on the page is no popup shell, so its rows stay outer too.
      const inlineLink = await vi.waitFor(() => roleNamed("link", "Spot price"));
      expect(cornerRadius(inlineLink), "inline panel link").toBe(OUTER_ROW[variant]);
      // No popup relays a corner to that panel, so a custom inner part rounds with --radius.
      expect(cornerRadius(roleNamed("group", "Panel note")), "inline panel block").toBe(RADIUS[variant]);
    }
  );

  it("rounds a rounded-inner part outside any shell with the theme's --radius", () => {
    stampDocumentTheme(fkasPrivate, "light");
    for (const [theme, expected] of [
      [fkasPrivate, 6],
      [tkasCompany, 16],
    ] as const) {
      const { unmount } = render(
        <ThemeScope theme={theme}>
          <div role="group" aria-label="Free part" className="rounded-inner" />
        </ThemeScope>
      );
      expect(cornerRadius(roleNamed("group", "Free part")), theme.brand).toBe(expected);
      unmount();
    }
  });

  it("rounds a part in a nested theme scope under a shell with the scope's own --radius", async () => {
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={fkasPrivate}>
        <DropdownMenu.Root defaultOpen>
          <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Profile</DropdownMenu.Item>
            <ThemeScope theme={tkasCompany}>
              <DropdownMenu.Item>Switch brand</DropdownMenu.Item>
            </ThemeScope>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </ThemeScope>
    );
    // The internal shell gives its own rows 2px. The tkas scope inside it drops that value,
    // so its row rounds with tkas's --radius, 16px.
    expect(cornerRadius(await vi.waitFor(() => roleNamed("menuitem", "Profile")))).toBe(2);
    expect(cornerRadius(roleNamed("menuitem", "Switch brand"))).toBe(16);
  });

  it.each(CASES)(
    "keeps the panel geometry through a same-theme ThemeScope between popup panels (%s)",
    async (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <NavigationMenu.Root aria-label="Site" defaultValue="audiences">
            <NavigationMenu.List>
              <NavigationMenu.Item value="audiences">
                <NavigationMenu.Trigger>Audiences</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <ThemeScope theme={theme}>
                    <div role="group" aria-label="Scope note" className="rounded-inner" />
                    <NavigationMenu.Root orientation="vertical" inline defaultValue="homes">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="homes">
                          <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                          <NavigationMenu.Content>
                            <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </ThemeScope>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
        </ThemeScope>
      );
      // Two 4px panels inset the row 8px inside the popup's rounded-md.
      expect(cornerRadius(await vi.waitFor(() => roleNamed("link", "Spot price")))).toBe(
        TWO_PANELS_DEEP_ROW[variant]
      );
      // The scope adds no shell, so a block directly in it rounds with its --radius.
      expect(cornerRadius(roleNamed("group", "Scope note"))).toBe(RADIUS[variant]);
    }
  );

  it.each(CASES)(
    "starts a DropdownMenu's own relay inside a NavigationMenu panel (%s)",
    async (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <OpenNavigationPanel>
            {() => (
              <ThemeScope theme={theme}>
                <DropdownMenu.Root defaultOpen>
                  <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <NavigationMenu.Root orientation="vertical" inline defaultValue="homes">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="homes">
                          <NavigationMenu.Trigger>Homes</NavigationMenu.Trigger>
                          <NavigationMenu.Content>
                            <NavigationMenu.Link href="#spot">Spot price</NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </ThemeScope>
            )}
          </OpenNavigationPanel>
        </ThemeScope>
      );
      const row = await vi.waitFor(() => roleNamed("link", "Spot price"));
      expect(
        slotShell("dropdown-menu-content", row).parentElement?.closest(
          '[data-slot="navigation-menu-content"]'
        )
      ).not.toBeNull();
      expect(cornerRadius(row)).toBe(TWO_PANELS_DEEP_ROW[variant]);
    }
  );

  it.each(CASES)(
    "keeps no outer corner on a Combobox popup mounted in a NavigationMenu panel (%s)",
    async (variant, theme, documentTheme) => {
      stampDocumentTheme(documentTheme, "light");
      render(
        <ThemeScope theme={theme}>
          <OpenNavigationPanel>
            {(container) =>
              withLocale(
                "en-US",
                <Combobox.Root items={["Apple"]} open>
                  <Combobox.Input aria-label="Fruit" />
                  <Combobox.Content container={container}>
                    <div role="group" aria-label="Popup note" className="rounded-inner" />
                    <Combobox.List>
                      <Combobox.Item value="Apple">Apple</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Content>
                </Combobox.Root>
              )
            }
          </OpenNavigationPanel>
        </ThemeScope>
      );
      const option = await vi.waitFor(() => roleNamed("option", "Apple"));
      // The popup publishes no corner of its own, so a block directly in it takes --radius.
      expect(cornerRadius(roleNamed("group", "Popup note")), "block").toBe(RADIUS[variant]);
      expect(cornerRadius(option), "option").toBe(EXPECTED[variant].combobox);
    }
  );

  it("insets a row behind three nested inline panels by every panel's padding", async () => {
    stampDocumentTheme(fkasPrivate, "light");
    render(
      <ThemeScope theme={tkasCompany} style={{ "--radius": "26px" }}>
        <NavigationMenu.Root aria-label="Site" defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>Level one</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Root orientation="vertical" inline defaultValue="two">
                  <NavigationMenu.List>
                    <NavigationMenu.Item value="two">
                      <NavigationMenu.Trigger>Level two</NavigationMenu.Trigger>
                      <NavigationMenu.Content>
                        <NavigationMenu.Root orientation="vertical" inline defaultValue="three">
                          <NavigationMenu.List>
                            <NavigationMenu.Item value="three">
                              <NavigationMenu.Trigger>Level three</NavigationMenu.Trigger>
                              <NavigationMenu.Content>
                                <NavigationMenu.Link href="#deep">Deep link</NavigationMenu.Link>
                              </NavigationMenu.Content>
                            </NavigationMenu.Item>
                          </NavigationMenu.List>
                          <NavigationMenu.Viewport />
                        </NavigationMenu.Root>
                      </NavigationMenu.Content>
                    </NavigationMenu.Item>
                  </NavigationMenu.List>
                  <NavigationMenu.Viewport />
                </NavigationMenu.Root>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </ThemeScope>
    );
    const row = await vi.waitFor(() => roleNamed("link", "Deep link"));
    // tkas at 26px: rounded-md is 24px, and three 4px panels inset the row 12px.
    expect(cornerRadius(navigationPopup("Level one", row))).toBe(24);
    expect(cornerRadius(row)).toBe(12);
  });

  it("lets a consumer's rounded-* class replace either NavigationMenu row corner", async () => {
    stampDocumentTheme(tkasCompany, "light");
    render(
      <ThemeScope theme={tkasCompany}>
        <NavigationMenu.Root aria-label="Site" defaultValue="products">
          <NavigationMenu.List>
            <NavigationMenu.Item value="products">
              <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#electricity" className="rounded-none">
                  Electricity
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
        <NavigationMenu.Root aria-label="Sections" orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#help" className="rounded-none">
                Help
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      </ThemeScope>
    );
    // Without the override, tkas rounds these 10px in the popup and 12px on the page.
    expect(cornerRadius(await vi.waitFor(() => roleNamed("link", "Electricity")))).toBe(0);
    expect(cornerRadius(roleNamed("link", "Help"))).toBe(0);
  });

  it("keeps a shell's --inner-corner on an element that also carries theme attributes", () => {
    stampDocumentTheme(fkasPrivate, "light");
    expectShellOnThemeElementWins();
  });
});
