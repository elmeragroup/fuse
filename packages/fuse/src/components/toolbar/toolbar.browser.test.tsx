import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { CASES, cornerRadius, edgeInset } from "../../../test/inner-corner-specimens";
import type { Variant } from "../../../test/inner-corner-specimens";
import {
  px,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDensity,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { ThemeScope } from "../../theme/theme-scope";
import { Button } from "../button/button";
import { Popover } from "../popover";
import { ToggleGroup } from "../toggle-group";
import { Tooltip } from "../tooltip";
import { Toolbar } from "./index";

function focusedName(): string | null {
  const focused = document.activeElement;
  return focused instanceof HTMLElement ? (focused.getAttribute("aria-label") ?? focused.textContent) : null;
}

async function press(key: string, expected: string): Promise<void> {
  await userEvent.keyboard(key);
  await vi.waitFor(() => {
    expect(focusedName(), `${key} focuses ${expected}`).toBe(expected);
  });
}

describe("Toolbar", () => {
  it("is one Tab stop whose arrow keys move through its items, skipping separators and wrapping at the ends", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Toolbar.Root aria-label="Format">
          <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Bold</Toolbar.Button>
          <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Italic</Toolbar.Button>
          <Toolbar.Separator />
          <Toolbar.Link href="#help">Help</Toolbar.Link>
          <Toolbar.Input aria-label="Find" />
        </Toolbar.Root>
        <button type="button">After</button>
      </>
    );
    const toolbar = roleNamed("toolbar", "Format");
    expect(toolbar.getAttribute("aria-orientation")).toBe("horizontal");

    roleNamed("button", "Before").focus();
    await press("{Tab}", "Bold");
    await press("{ArrowRight}", "Italic");
    await press("{ArrowRight}", "Help");
    await press("{ArrowRight}", "Find");
    await press("{ArrowRight}", "Bold");
    await press("{ArrowLeft}", "Find");
    await press("{ArrowLeft}", "Help");

    // Tab leaves the toolbar, and Shift+Tab comes back to the item it left.
    await press("{Tab}", "After");
    await press("{Shift>}{Tab}{/Shift}", "Help");
  });

  it("stops at the ends instead of wrapping when loopFocus is false", async () => {
    renderThemed(
      <Toolbar.Root aria-label="History" loopFocus={false}>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Undo</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Redo</Toolbar.Button>
      </Toolbar.Root>
    );
    roleNamed("button", "Undo").focus();
    await press("{ArrowLeft}", "Undo");
    await press("{ArrowRight}", "Redo");
    await press("{ArrowRight}", "Redo");
  });

  it("keeps a disabled item in the arrow-key order without letting it activate", async () => {
    const onArchive = vi.fn();
    renderThemed(
      <Toolbar.Root aria-label="Message">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Reply</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />} disabled onClick={onArchive}>
          Archive
        </Toolbar.Button>
        <Toolbar.Group aria-label="Move" disabled>
          <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Spam</Toolbar.Button>
        </Toolbar.Group>
      </Toolbar.Root>
    );
    roleNamed("button", "Reply").focus();
    await press("{ArrowRight}", "Archive");
    const archive = roleNamed("button", "Archive");
    expect(archive.getAttribute("aria-disabled")).toBe("true");
    await userEvent.keyboard("{Enter}");
    await userEvent.click(archive, { force: true });
    expect(onArchive).not.toHaveBeenCalled();

    // A disabled group disables its items the same way.
    await press("{ArrowRight}", "Spam");
    expect(roleNamed("button", "Spam").getAttribute("aria-disabled")).toBe("true");
  });

  it("stacks a vertical toolbar, moves with the up and down arrows, and turns its separators horizontal", async () => {
    renderThemed(
      <Toolbar.Root aria-label="Tools" orientation="vertical">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Pen</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Eraser</Toolbar.Button>
      </Toolbar.Root>
    );
    const toolbar = roleNamed("toolbar", "Tools");
    expect(toolbar.getAttribute("aria-orientation")).toBe("vertical");
    const pen = roleNamed("button", "Pen").getBoundingClientRect();
    const eraser = roleNamed("button", "Eraser").getBoundingClientRect();
    expect(eraser.top).toBeGreaterThan(pen.bottom);

    const separator = page.getByRole("separator").element();
    expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
    const line = separator.getBoundingClientRect();
    expect(line.height).toBe(1);
    expect(line.width).toBeGreaterThan(1);

    roleNamed("button", "Pen").focus();
    await press("{ArrowDown}", "Eraser");
    await press("{ArrowUp}", "Pen");
  });

  it("draws a horizontal toolbar's separator as a vertical hairline, 4px short of the items at each end", () => {
    renderThemed(
      <Toolbar.Root aria-label="Clipboard">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Cut</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Paste</Toolbar.Button>
      </Toolbar.Root>
    );
    const separator = page.getByRole("separator").element();
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    const line = separator.getBoundingClientRect();
    const item = roleNamed("button", "Cut").getBoundingClientRect();
    expect(line.width).toBe(1);
    expect(line.top - item.top).toBeCloseTo(4, 1);
    expect(item.bottom - line.bottom).toBeCloseTo(4, 1);
  });

  it("composes a ToggleGroup, a Popover trigger and a Tooltip trigger into one arrow-key order", async () => {
    renderThemed(
      <Tooltip.Provider>
        <Toolbar.Root aria-label="Editor">
          <ToggleGroup.Root aria-label="Alignment" defaultValue={["left"]}>
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup.Root>
          <Toolbar.Separator />
          <Popover.Root>
            <Toolbar.Button render={<Popover.Trigger render={<Button variant="ghost" size="sm" />} />}>
              Insert
            </Toolbar.Button>
            <Popover.Content>
              <Popover.Title>Insert a block</Popover.Title>
              <Button variant="outline" size="sm">
                Image
              </Button>
              <Button variant="outline" size="sm">
                Table
              </Button>
            </Popover.Content>
          </Popover.Root>
          <Tooltip.Root>
            <Tooltip.Trigger render={<Toolbar.Button render={<Button variant="ghost" size="sm" />} />}>
              Clear
            </Tooltip.Trigger>
            <Tooltip.Content>Clear formatting</Tooltip.Content>
          </Tooltip.Root>
        </Toolbar.Root>
      </Tooltip.Provider>
    );

    roleNamed("button", "Left").focus();
    await press("{ArrowRight}", "Right");
    await userEvent.keyboard(" ");
    await expect.element(page.getByRole("button", { name: "Right", pressed: true })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Left", pressed: false })).toBeInTheDocument();

    await press("{ArrowRight}", "Insert");
    await userEvent.keyboard("{Enter}");
    const popup = page.getByRole("dialog", { name: "Insert a block" });
    await expect.element(popup).toBeInTheDocument();
    // The arrow keys inside the popup are the popup's: the toolbar keeps its place.
    roleNamed("button", "Image").focus();
    await press("{ArrowRight}", "Image");
    await userEvent.keyboard("{Escape}");
    await expect.element(popup).not.toBeInTheDocument();
    expect(focusedName()).toBe("Insert");

    await press("{ArrowRight}", "Clear");
    await expect.element(page.getByRole("tooltip", { name: "Clear formatting" })).toBeVisible();
    await press("{ArrowRight}", "Left");
  });
});

describe("Toolbar corners", () => {
  let restoreDocumentTheme: () => void = () => undefined;

  beforeEach(() => {
    restoreDocumentTheme = snapshotDocumentTheme();
    document.documentElement.style.fontSize = "16px";
  });

  afterEach(() => {
    restoreDocumentTheme();
    document.documentElement.style.removeProperty("font-size");
  });

  /**
   * The item corner in px, worked out by hand: the toolbar's `rounded-lg`, `--radius` itself (6px
   * internal, 12px fkas, 16px tkas, 8px guen), less its 1px border and 4px padding.
   */
  const EXPECTED = { internal: 1, fkas: 7, tkas: 11, guen: 3 } as const satisfies Record<Variant, number>;

  for (const density of DENSITIES) {
    it.each(CASES)(
      `rounds an inner item concentric with the bar, ${density} (%s)`,
      (variant, theme, documentTheme) => {
        stampDocumentTheme(documentTheme, "light");
        stampDensity(density);
        render(
          <ThemeScope theme={theme}>
            <Toolbar.Root aria-label="Shape">
              <Toolbar.Button render={<Button variant="ghost" size="sm" className="rounded-inner" />}>
                Corner
              </Toolbar.Button>
            </Toolbar.Root>
          </ThemeScope>
        );
        const toolbar = roleNamed("toolbar", "Shape");
        const item = roleNamed("button", "Corner");
        // Unit under test: the corner the toolbar publishes to an item that rounds with
        // `rounded-inner`. Oracle: the concentric rule max(0, outer − inset) on the bar's measured
        // corner and the measured inset between them, and the hand-computed corner above.
        expect(px(getComputedStyle(toolbar).paddingInlineStart)).toBe(4);
        expect(cornerRadius(item)).toBeCloseTo(
          Math.max(0, cornerRadius(toolbar) - edgeInset(item, toolbar, "start")),
          1
        );
        expect(cornerRadius(item)).toBeCloseTo(EXPECTED[variant], 1);
      }
    );
  }
});
