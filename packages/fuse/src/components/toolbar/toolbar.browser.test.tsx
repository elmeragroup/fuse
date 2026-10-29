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
  it("keeps a rendered Button that a disabled item, group or root disables in the arrow-key order without letting it activate, but never a link", async () => {
    const onArchive = vi.fn();
    const onSave = vi.fn();
    renderThemed(
      <>
        <Toolbar.Root aria-label="Message">
          <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Reply</Toolbar.Button>
          <Toolbar.Button render={<Button variant="ghost" size="sm" />} disabled onClick={onArchive}>
            Archive
          </Toolbar.Button>
          <Toolbar.Group aria-label="Move" disabled>
            <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Spam</Toolbar.Button>
          </Toolbar.Group>
        </Toolbar.Root>
        <Toolbar.Root aria-label="Document" disabled>
          <Toolbar.Button render={<Button variant="ghost" size="sm" />} onClick={onSave}>
            Save
          </Toolbar.Button>
          <Toolbar.Link href="#history">History</Toolbar.Link>
        </Toolbar.Root>
      </>
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

    // So does a disabled root, for its buttons only.
    const save = roleNamed("button", "Save");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("link", "History").hasAttribute("aria-disabled")).toBe(false);
    save.focus();
    await press("{ArrowRight}", "link", "History");
    await userEvent.click(save, { force: true });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("stacks a vertical toolbar and its groups and turns its separators horizontal", () => {
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
