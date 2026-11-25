import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import standaloneCss from "../../dist/styles.css?raw";
import "../../dist/themes.css";
import { carouselSlides } from "../../test/carousel-fixtures";
import { ResizableAssignmentTable } from "../../test/data-table-fixtures";
import { centerY } from "../../test/first-line";
import { withLocale } from "../../test/locale-matrix";
import { bySlot, setupSidebarBrowser } from "../../test/sidebar-browser-fixtures";
import { consumerCss, STANDALONE_ENTRY } from "../../test/tailwind-consumer-build";
import { atHostRoots, expectTargetBoxes, expectTargets, hitAreaOf } from "../../test/target-size";
import { renderThemed, roleNamed, stampDensity } from "../../test/themed-browser-render";
import { wrappedSegment } from "../../test/wrapped-date-segment";
import { Button } from "../components/button/button";
import { Carousel } from "../components/carousel/index";
import { Combobox } from "../components/combobox";
import { DateInput } from "../components/date-field";
import { DateField } from "../components/date-field/date-field";
import { DropdownMenu } from "../components/dropdown-menu";
import { NumberField } from "../components/number-field/number-field";
import { PhoneNumberField } from "../components/phone-number-field/phone-number-field";
import { RadioGroup, RadioIconButton } from "../components/radio-group/radio-group";
import { Sidebar } from "../components/sidebar";
import { Toggle } from "../components/toggle/toggle";
import "../temporal-polyfill";
import { DENSITIES } from "../theme/density";
import type { Density } from "../theme/density";

/**
 * The standalone `styles.css`, in a sheet of its own, so a case can take it out and stand a
 * Tailwind-source build in its place. It goes first in the head, ahead of `themes.css`, as a host
 * links them.
 */
const standaloneSheet = document.createElement("style");
standaloneSheet.textContent = standaloneCss;

beforeAll(() => {
  document.head.prepend(standaloneSheet);
});

afterAll(() => {
  standaloneSheet.remove();
});

/** Layout rounds lengths to 1/64px, so two edges that meet may measure a hair apart. */
const LAYOUT_EPSILON = 0.02;

/**
 * A stylesheet a host draws the Sidebar with, and the host roots a case runs at under it: the
 * standalone sheet, or a Tailwind-source build of `fuse.css` under the host's own `--spacing`.
 */
type SidebarStylesheet =
  | { readonly name: string; readonly roots: readonly number[]; readonly source: "standalone" }
  | {
      readonly name: string;
      readonly roots: readonly number[];
      readonly source: "tailwind";
      readonly spacing: string;
    };

/**
 * The Sidebar's stylesheets. A host's `--spacing` in px leaves the rail rows' lengths at that step
 * whatever the root, so the Tailwind-source builds run at the 16px root alone.
 */
const SIDEBAR_STYLESHEETS: readonly SidebarStylesheet[] = [
  { name: "the standalone sheet", roots: [16, 14, 12], source: "standalone" },
  ...["2px", "2.5px", "3.5px"].map((spacing): SidebarStylesheet => ({
    name: `Tailwind source at a ${spacing} spacing step`,
    roots: [16],
    source: "tailwind",
    spacing,
  })),
];

/** Every class the document's elements spell, the candidates a Tailwind host's source scan finds. */
function documentCandidates(): string[] {
  return [...new Set([...document.querySelectorAll("[class]")].flatMap((element) => [...element.classList]))];
}

/**
 * Run a check under a stylesheet at each of its host roots and at both densities. A
 * Tailwind-source build compiles `fuse.css` with the rendered document's classes and the host's
 * `@theme` spacing step, and replaces the standalone sheet until the check ends.
 *
 * @param stylesheet - The stylesheet.
 * @param check - The check, given the root and the density stamped on the document.
 */
async function inStylesheet(
  stylesheet: SidebarStylesheet,
  check: (root: number, density: Density) => void
): Promise<void> {
  const atRootsAndDensities = () => {
    atHostRoots(stylesheet.roots, (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        check(root, density);
      }
    });
  };
  if (stylesheet.source === "standalone") {
    atRootsAndDensities();
    return;
  }
  const build = document.createElement("style");
  build.textContent = await consumerCss(
    `${STANDALONE_ENTRY}\n@theme { --spacing: ${stylesheet.spacing}; }`,
    documentCandidates()
  );
  standaloneSheet.remove();
  document.head.append(build);
  try {
    // The host's build alone styles the page: a standalone sheet left attached would hide a
    // utility the build fails to emit.
    expect(standaloneSheet.isConnected, "standalone sheet").toBe(false);
    // The case reads the host's build at the host's step.
    expect(getComputedStyle(document.documentElement).getPropertyValue("--spacing").trim()).toBe(
      stylesheet.spacing
    );
    atRootsAndDensities();
  } finally {
    build.remove();
    document.head.prepend(standaloneSheet);
  }
}

/**
 * Assert each control's box is at least `size` tall. Height alone, because a Carousel dot's width
 * tweens to a new root size.
 *
 * @param targets - The controls.
 * @param size - The smallest height in px.
 * @param label - The assertion label.
 */
function expectHeightsAtLeast(targets: readonly Element[], size: number, label: string): void {
  for (const target of targets) {
    const height = target.getBoundingClientRect().height;
    expect(height, `${label} ${target.getAttribute("aria-label") ?? ""} height`).toBeGreaterThanOrEqual(
      size - 0.01
    );
  }
}

/**
 * Unit under test: the WCAG 2.5.8 24px target floor that the control sizes set, on the smallest
 * targets Fuse draws: an icon-only inline Button, a NumberField's steppers inside the field box,
 * a Combobox chip's remove button and the resize handles of a DataTable's first column and the
 * column beside it, both at their narrowest, a date field's segments with their narrowest text, as
 * flex items of the box and wrapped in a span, and a Carousel's indicators, its dots and indicators
 * with their own small content, and a Sidebar's group action and the menu actions of its default,
 * `sm` and `lg` rows, at both densities and at the 16px root and a 14px host root. The Sidebar
 * adds a 12px host root, and Tailwind-source builds of `fuse.css` at a 2px, 2.5px and 3.5px
 * `--spacing`.
 * Oracle: the criterion's 24px square around each target's center, which `test/target-size.ts`
 * measures. More oracles for the Sidebar: at a 24px root, the 16px drawing's 24px targets scaled
 * by 24/16; a press on a truncated label's edge beside the action belongs to the label's menu
 * button; each action's press area lies between its own row's top and bottom edges, the menu
 * button's or the group label's; a badge's middle is its row's middle; an `lg` row and a group
 * label draw as tall outside a `Sidebar.MenuItem` or `Sidebar.Group`, wrapped, or rendered through
 * a `DropdownMenu.Trigger` as straight inside one, as the docs demos render them; and in the collapsed
 * icon rail a press anywhere on a row belongs to its menu button, under the next group's label.
 */
describe("the 24px target floor", () => {
  it("holds for the smallest targets at both densities and both host roots", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 32,
            padding: 32,
          }}>
          <Button size="icon-inline" aria-label="Edit">
            ✎
          </Button>
          <NumberField aria-label="Amount" />
          <Combobox.Root multiple defaultValue={["Apple", "Banana"]}>
            <Combobox.Chips aria-label="Selected fruit">
              <Combobox.Chip>Apple</Combobox.Chip>
              <Combobox.Chip>Banana</Combobox.Chip>
              <Combobox.ChipsInput aria-label="Fruit" />
            </Combobox.Chips>
          </Combobox.Root>
          <ResizableAssignmentTable />
        </div>
      )
    );
    const targets = [
      roleNamed("button", "Edit"),
      roleNamed("button", "Increase Amount"),
      roleNamed("button", "Decrease Amount"),
      roleNamed("button", "Remove Apple"),
      roleNamed("button", "Remove Banana"),
      roleNamed("separator", "Resize Queue column"),
      roleNamed("separator", "Resize Channel column"),
    ];
    // Home takes each column to the narrowest width its handle allows.
    for (const handle of targets.slice(-2)) {
      handle.focus();
      await userEvent.keyboard("{Home}");
    }
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectTargets(targets, `${density} ${String(root)}px`);
      }
    });
  });

  it("holds for each date segment, empty, filled and wrapped, at both densities and both host roots", () => {
    const filled = Temporal.PlainDateTime.from("2030-01-01T01:01");
    renderThemed(
      withLocale(
        "en-US",
        <>
          <DateField label="Empty" granularity="minute" />
          <DateField label="Filled" granularity="minute" defaultValue={filled} />
          <DateInput.Root aria-label="Wrapped" granularity="minute" defaultValue={filled}>
            {wrappedSegment}
          </DateInput.Root>
        </>
      )
    );
    // The six spinbuttons of an en-US date and time to the minute; the literals between them are
    // hidden and are not targets. `roleNamed` fails on a missing one before anything is measured.
    const fields = ["Empty", "Filled", "Wrapped"].map(
      (field) =>
        [
          field,
          ["month", "day", "year", "hour", "minute", "AM/PM"].map((unit) =>
            roleNamed("spinbutton", `${unit}, ${field}`)
          ),
        ] as const
    );
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        for (const [field, segments] of fields) {
          expectTargets(segments, `${field} ${density} ${String(root)}px`);
        }
      }
    });
  });

  it("holds for a Carousel's indicators at both densities and both host roots", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: 32, width: 240 }}>
          <Carousel.Root aria-label="Offers">
            <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
            <Carousel.Indicators />
          </Carousel.Root>
          <Carousel.Root aria-label="Thumbnails">
            <Carousel.Viewport>{carouselSlides(3, 1)}</Carousel.Viewport>
            <Carousel.Indicators>
              {[1, 2, 3].map((place) => (
                <Carousel.Indicator key={place} index={place - 1} aria-label={`Thumbnail ${String(place)}`}>
                  <span style={{ display: "block", width: 8, height: 8 }} />
                </Carousel.Indicator>
              ))}
            </Carousel.Indicators>
          </Carousel.Root>
        </div>
      )
    );
    // The dots render once the carousel has measured its pages.
    await expect.poll(() => page.getByRole("button", { name: "Slide 3 of 3" }).query()).not.toBeNull();
    const dots = ["Slide 1 of 3", "Slide 2 of 3", "Slide 3 of 3"].map((name) => roleNamed("button", name));
    const thumbnails = [1, 2, 3].map((place) => roleNamed("button", `Thumbnail ${String(place)}`));
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectTargets(dots, `${density} ${String(root)}px dots`);
        expectTargets(thumbnails, `${density} ${String(root)}px thumbnails`);
      }
    });
    // The floor only raises a target: at a 24px root the indicators keep the 16px drawing's 24px
    // height scaled by 24/16, 36px.
    atHostRoots([24], () => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectHeightsAtLeast([...dots, ...thumbnails], 36, `${density} 24px`);
      }
    });
  });

  describe("on a Sidebar's menu rows", () => {
    setupSidebarBrowser();

    // An action's hit area paints over the action in the row above. The order puts an sm row under
    // the group's label and its action, an sm row under an sm row, a default row under an sm row, a
    // default row under a default row, an sm row under a default row and an lg row under an sm row.
    // The rows with a badge come last, so they change none of those pairs.
    const rows = [
      ["sm 1", "sm", "action"],
      ["sm 2", "sm", "action"],
      ["default 1", "default", "action"],
      ["default 2", "default", "action"],
      ["sm 3", "sm", "action"],
      ["lg", "lg", "action"],
      ["sm badge", "sm", "badge"],
      ["default badge", "default", "badge"],
    ] as const;
    const actionRows = rows.filter(([, , end]) => end === "action");
    const badgeRows = rows.filter(([, , end]) => end === "badge");
    const labelOf = (row: string) => `${row} orders and returns for the northern sales region`;

    function renderRows() {
      renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider>
            <Sidebar.Root>
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
                  <Sidebar.GroupContent>
                    <Sidebar.Menu>
                      {rows.map(([row, size, end]) => (
                        <Sidebar.MenuItem key={row}>
                          <Sidebar.MenuButton size={size}>
                            <span>{labelOf(row)}</span>
                          </Sidebar.MenuButton>
                          {end === "action" ? (
                            <Sidebar.MenuAction aria-label={`${row} action`}>⋯</Sidebar.MenuAction>
                          ) : (
                            <Sidebar.MenuBadge>12</Sidebar.MenuBadge>
                          )}
                        </Sidebar.MenuItem>
                      ))}
                    </Sidebar.Menu>
                  </Sidebar.GroupContent>
                  {/* The action is absolutely placed on the label, so it may come after the menu.
                      There it paints over the first row, which an earlier sibling would not. */}
                  <Sidebar.GroupAction aria-label="Add project">+</Sidebar.GroupAction>
                </Sidebar.Group>
              </Sidebar.Content>
            </Sidebar.Root>
          </Sidebar.Provider>
        )
      );
      return {
        label: bySlot("sidebar-group-label"),
        groupAction: roleNamed("button", "Add project"),
        actions: actionRows.map(([row, size]) => ({
          size,
          action: roleNamed("button", `${row} action`),
          button: roleNamed("button", labelOf(row)),
        })),
        badges: badgeRows.map(([row]) => {
          const button = roleNamed("button", labelOf(row));
          return { button, badge: bySlot("sidebar-menu-badge", button.parentElement ?? button) };
        }),
      };
    }

    describe.each(SIDEBAR_STYLESHEETS)("from $name", (stylesheet) => {
      it("holds for the group action and the menu actions of default, sm and lg rows at both densities", async () => {
        const { groupAction, actions } = renderRows();
        await inStylesheet(stylesheet, (root, density) => {
          expectTargets(
            [groupAction, ...actions.map(({ action }) => action)],
            `${density} ${String(root)}px`
          );
        });
      });

      it("keeps each action's hit area inside its own row", async () => {
        const { label, groupAction, actions } = renderRows();
        const pairs = [
          [groupAction, label] as const,
          ...actions.map(({ action, button }) => [action, button] as const),
        ];
        await inStylesheet(stylesheet, (root, density) => {
          for (const [action, row] of pairs) {
            const box = row.getBoundingClientRect();
            for (const pseudo of ["::before", "::after"] as const) {
              const area = hitAreaOf(action, pseudo);
              const name = `${density} ${String(root)}px ${action.getAttribute("aria-label") ?? ""} ${pseudo}`;
              expect.soft(area.top, `${name} top`).toBeGreaterThanOrEqual(box.top - LAYOUT_EPSILON);
              expect.soft(area.bottom, `${name} bottom`).toBeLessThanOrEqual(box.bottom + LAYOUT_EPSILON);
            }
          }
        });
      });

      it("centers each badge on its row", async () => {
        const { badges } = renderRows();
        await inStylesheet(stylesheet, (root, density) => {
          for (const { button, badge } of badges) {
            expect(
              Math.abs(centerY(badge) - centerY(button)),
              `${density} ${String(root)}px ${button.textContent} badge middle`
            ).toBeLessThanOrEqual(LAYOUT_EPSILON);
          }
        });
      });

      it("leaves a press on a truncated label beside the action to its menu button", async () => {
        const { actions } = renderRows();
        const html = document.documentElement;
        try {
          for (const dir of ["ltr", "rtl"] as const) {
            html.dir = dir;
            await inStylesheet(stylesheet, (root, density) => {
              for (const { button } of actions) {
                // The label's edge beside the action, the end of an LTR label and the start of an
                // RTL one: the action sits on the right in both directions.
                const label = button.querySelector("span:last-child");
                expect(label, "label span").not.toBeNull();
                const rect = (label ?? button).getBoundingClientRect();
                const hit = document.elementFromPoint(rect.right - 2, rect.top + rect.height / 2);
                expect(
                  hit !== null && button.contains(hit),
                  `${dir} ${density} ${String(root)}px ${button.textContent}`
                ).toBe(true);
              }
            });
          }
        } finally {
          html.removeAttribute("dir");
        }
      });
    });

    it("keeps the sm and lg menu actions' growth at a 24px host root", () => {
      const { actions } = renderRows();
      const fixedRows = actions.filter(({ size }) => size !== "default").map(({ action }) => action);
      // The 16px drawing's 24px action, scaled by 24/16.
      atHostRoots([24], () => {
        for (const density of DENSITIES) {
          stampDensity(density);
          expectHeightsAtLeast(fixedRows, 36, `${density} 24px`);
        }
      });
    });

    // The docs demos' composition is the reference, an `lg` row straight inside its
    // `Sidebar.MenuItem` and a label straight inside its `Sidebar.Group`. A row or label held
    // another way draws the same height. At a 16px root the reference draws what the parts drew
    // before the target floors, the `3rem` of `h-12` and the `2rem` of `h-8`, which two probes hold.
    it("sizes an lg row and a group label by themselves, whatever holds them", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider>
            <Sidebar.Root>
              <Sidebar.Content>
                <Sidebar.Group>
                  <Sidebar.GroupLabel>Reference</Sidebar.GroupLabel>
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.MenuButton size="lg">Reference row</Sidebar.MenuButton>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      {/* The landing's workspace switcher: the trigger's slot replaces the row's. */}
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger render={<Sidebar.MenuButton size="lg" />}>
                          Switcher
                        </DropdownMenu.Trigger>
                      </DropdownMenu.Root>
                    </Sidebar.MenuItem>
                    <Sidebar.MenuItem>
                      <div>
                        <Sidebar.MenuButton size="lg">Wrapped</Sidebar.MenuButton>
                      </div>
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.Group>
                <Sidebar.MenuButton size="lg">Standalone</Sidebar.MenuButton>
                <Sidebar.GroupLabel>Standalone label</Sidebar.GroupLabel>
                <div data-probe="lg row" style={{ height: "3rem" }} />
                <div data-probe="group label" style={{ height: "2rem" }} />
              </Sidebar.Content>
            </Sidebar.Root>
          </Sidebar.Provider>
        )
      );
      const reference = roleNamed("button", "Reference row");
      const rows = ["Switcher", "Wrapped", "Standalone"].map((name) => roleNamed("button", name));
      const [referenceLabel, label] = document.querySelectorAll('[data-slot="sidebar-group-label"]');
      expect(referenceLabel, "reference label").toBeInstanceOf(HTMLElement);
      expect(label, "standalone label").toBeInstanceOf(HTMLElement);
      const heightOf = (element: Element | null | undefined) => element?.getBoundingClientRect().height;
      const lgProbe = document.querySelector('[data-probe="lg row"]');
      const labelProbe = document.querySelector('[data-probe="group label"]');
      for (const stylesheet of SIDEBAR_STYLESHEETS) {
        await inStylesheet(stylesheet, (root, density) => {
          const name = `${stylesheet.name} ${density} ${String(root)}px`;
          for (const row of rows) {
            expect.soft(heightOf(row), `${name} ${row.textContent}`).toBe(heightOf(reference));
          }
          expect.soft(heightOf(label), `${name} group label`).toBe(heightOf(referenceLabel));
          if (stylesheet.source === "standalone" && root === 16) {
            expect.soft(heightOf(reference), `${name} reference row`).toBe(heightOf(lgProbe));
            expect.soft(heightOf(referenceLabel), `${name} reference label`).toBe(heightOf(labelProbe));
          }
        });
      }
    });
  });

  describe.each(SIDEBAR_STYLESHEETS)("on a Sidebar's collapsed icon rail from $name", (stylesheet) => {
    setupSidebarBrowser();

    it("leaves each row's press to its menu button under the next group's hidden label", async () => {
      renderThemed(
        withLocale(
          "en-US",
          <Sidebar.Provider defaultOpen={false}>
            <Sidebar.Root collapsible="icon">
              <Sidebar.Content>
                {["Projects", "Teams"].map((group) => (
                  <Sidebar.Group key={group}>
                    <Sidebar.GroupLabel>{group}</Sidebar.GroupLabel>
                    <Sidebar.GroupContent>
                      <Sidebar.Menu>
                        {[1, 2].map((place) => (
                          <Sidebar.MenuItem key={place}>
                            <Sidebar.MenuButton>
                              <span>{`${group} ${String(place)}`}</span>
                            </Sidebar.MenuButton>
                          </Sidebar.MenuItem>
                        ))}
                      </Sidebar.Menu>
                    </Sidebar.GroupContent>
                  </Sidebar.Group>
                ))}
              </Sidebar.Content>
            </Sidebar.Root>
          </Sidebar.Provider>
        )
      );
      const buttons = ["Projects 1", "Projects 2", "Teams 1", "Teams 2"].map((name) =>
        roleNamed("button", name)
      );
      await inStylesheet(stylesheet, (root, density) => {
        for (const button of buttons) {
          const rect = button.getBoundingClientRect();
          for (const y of [rect.top + 1, rect.top + rect.height / 2, rect.bottom - 1]) {
            const hit = document.elementFromPoint(rect.left + rect.width / 2, y);
            expect
              .soft(
                hit !== null && button.contains(hit),
                `${density} ${String(root)}px ${button.textContent} at ${String(y - rect.top)}px`
              )
              .toBe(true);
          }
        }
      });
    });
  });

  // A rounded square's corners fall outside its shape, so these targets meet the floor by their
  // box alone, the size `controlMetrics.xs` floors at 24px.
  it("holds for the boxes of the xs controls at both densities and both host roots", () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Button size="icon-xs" aria-label="Smallest button" />
          <Toggle size="xs" aria-label="Smallest toggle" />
          <RadioGroup label="Smallest">
            <RadioIconButton value="xxs" size="icon-xxs" aria-label="Smallest radio">
              <svg aria-hidden viewBox="0 0 1 1" />
            </RadioIconButton>
          </RadioGroup>
          <PhoneNumberField label="Phone" />
        </>
      )
    );
    const targets = [
      roleNamed("button", "Smallest button"),
      roleNamed("button", "Smallest toggle"),
      roleNamed("radio", "Smallest radio"),
      roleNamed("button", "+47 Norway"),
    ];
    atHostRoots([16, 14], (root) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        expectTargetBoxes(targets, `${density} ${String(root)}px`);
      }
    });
  });
});
