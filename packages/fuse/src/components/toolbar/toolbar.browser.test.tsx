import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { QueryableRole } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { Popover } from "../popover";
import { ToggleGroup } from "../toggle-group";
import { Tooltip } from "../tooltip";
import { Toolbar } from "./index";

async function press(key: string, role: QueryableRole, name: string): Promise<void> {
  await userEvent.keyboard(key);
  await vi.waitFor(() => {
    expect(document.activeElement, `${key} focuses the ${role} ${name}`).toBe(roleNamed(role, name));
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
    await press("{Tab}", "button", "Bold");
    await press("{ArrowRight}", "button", "Italic");
    await press("{ArrowRight}", "link", "Help");
    await press("{ArrowRight}", "textbox", "Find");
    await press("{ArrowRight}", "button", "Bold");
    await press("{ArrowLeft}", "textbox", "Find");
    await press("{ArrowLeft}", "link", "Help");

    // Tab leaves the toolbar, and Shift+Tab comes back to the item it left.
    await press("{Tab}", "button", "After");
    await press("{Shift>}{Tab}{/Shift}", "link", "Help");
  });

  it("stops at the ends instead of wrapping when loopFocus is false", async () => {
    renderThemed(
      <Toolbar.Root aria-label="History" loopFocus={false}>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Undo</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Redo</Toolbar.Button>
      </Toolbar.Root>
    );
    roleNamed("button", "Undo").focus();
    await press("{ArrowLeft}", "button", "Undo");
    await press("{ArrowRight}", "button", "Redo");
    await press("{ArrowRight}", "button", "Redo");
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
    await press("{ArrowRight}", "button", "Archive");
    const archive = roleNamed("button", "Archive");
    expect(archive.getAttribute("aria-disabled")).toBe("true");
    await userEvent.keyboard("{Enter}");
    await userEvent.click(archive, { force: true });
    expect(onArchive).not.toHaveBeenCalled();

    // A disabled group disables its items the same way.
    await press("{ArrowRight}", "button", "Spam");
    expect(roleNamed("button", "Spam").getAttribute("aria-disabled")).toBe("true");
  });

  it("disables the buttons of a disabled root, keeping them in the arrow-key order, but never its links", async () => {
    const onSave = vi.fn();
    renderThemed(
      <Toolbar.Root aria-label="Document" disabled>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />} onClick={onSave}>
          Save
        </Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Share</Toolbar.Button>
        <Toolbar.Link href="#history">History</Toolbar.Link>
      </Toolbar.Root>
    );
    const save = roleNamed("button", "Save");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("button", "Share").getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("link", "History").hasAttribute("aria-disabled")).toBe(false);

    save.focus();
    await press("{ArrowRight}", "button", "Share");
    await userEvent.click(save, { force: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("stacks a vertical toolbar and its groups, moves with the up and down arrows, and turns its separators horizontal", async () => {
    renderThemed(
      <Toolbar.Root aria-label="Tools" orientation="vertical">
        <Toolbar.Group aria-label="Draw">
          <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Pen" />} />
          <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Eraser" />} />
        </Toolbar.Group>
        <Toolbar.Separator />
        <Toolbar.Button render={<Button variant="ghost" size="icon-sm" aria-label="Fill" />} />
      </Toolbar.Root>
    );
    const toolbar = roleNamed("toolbar", "Tools");
    expect(toolbar.getAttribute("aria-orientation")).toBe("vertical");
    // Pen and Eraser sit in the group, so this checks the group stacks, not only the root.
    const pen = roleNamed("button", "Pen").getBoundingClientRect();
    const eraser = roleNamed("button", "Eraser").getBoundingClientRect();
    const fill = roleNamed("button", "Fill").getBoundingClientRect();
    expect(eraser.top).toBeGreaterThan(pen.bottom);

    const separator = page.getByRole("separator").element();
    expect(separator.getAttribute("aria-orientation")).toBe("horizontal");
    const line = separator.getBoundingClientRect();
    expect(line.top).toBeGreaterThan(eraser.bottom);
    expect(fill.top).toBeGreaterThan(line.bottom);
    expect(line.height).toBe(1);
    // Every item is an icon-sm square, so each one's edges line up with the bar's content box.
    // Both ends are checked: without `w-auto` the line still starts 4px in but overflows the right.
    expect(line.left - pen.left).toBeCloseTo(4, 1);
    expect(pen.right - line.right).toBeCloseTo(4, 1);

    roleNamed("button", "Pen").focus();
    await press("{ArrowDown}", "button", "Eraser");
    await press("{ArrowDown}", "button", "Fill");
    await press("{ArrowUp}", "button", "Eraser");
    await press("{ArrowUp}", "button", "Pen");
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
    await press("{ArrowRight}", "button", "Right");
    await userEvent.keyboard(" ");
    await expect.element(page.getByRole("button", { name: "Right", pressed: true })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Left", pressed: false })).toBeInTheDocument();

    await press("{ArrowRight}", "button", "Insert");
    await userEvent.keyboard("{Enter}");
    const popup = page.getByRole("dialog", { name: "Insert a block" });
    await expect.element(popup).toBeInTheDocument();
    // The arrow keys inside the popup are the popup's: the toolbar keeps its place.
    roleNamed("button", "Image").focus();
    await press("{ArrowRight}", "button", "Image");
    await userEvent.keyboard("{Escape}");
    await expect.element(popup).not.toBeInTheDocument();
    expect(document.activeElement).toBe(roleNamed("button", "Insert"));

    await press("{ArrowRight}", "button", "Clear");
    await expect.element(page.getByRole("tooltip", { name: "Clear formatting" })).toBeVisible();
    await press("{ArrowRight}", "button", "Left");
  });
});
