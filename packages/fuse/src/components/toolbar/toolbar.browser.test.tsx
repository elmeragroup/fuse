import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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
  it("hydrates a disabled button without a mismatch and leaves it focusable but aria-disabled", async () => {
    const element = (
      <Toolbar.Root aria-label="Message">
        <Toolbar.Button disabled>Archive</Toolbar.Button>
        <Toolbar.Button render={<Button variant="ghost" size="sm" />} disabled>
          Delete
        </Toolbar.Button>
      </Toolbar.Root>
    );
    const host = document.createElement("div");
    host.innerHTML = renderToString(element);
    document.body.append(host);
    const recover = vi.fn();
    // React 19 reports an attribute mismatch through console.error, not onRecoverableError.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      // A rendered Button passes `disabled` on to the native button, so the server markup
      // disables it, and only a client layout effect clears the property again.
      const serverDelete = [...host.querySelectorAll("button")].find((b) => b.textContent === "Delete");
      expect(serverDelete?.hasAttribute("disabled")).toBe(true);
      root = hydrateRoot(host, element, { onRecoverableError: recover });
      // The layout effect that clears `disabled` runs in the hydration commit.
      await vi.waitFor(() => {
        expect(roleNamed("button", "Delete")).toHaveProperty("disabled", false);
      });
      expect(recover).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      for (const name of ["Archive", "Delete"]) {
        const button = roleNamed("button", name);
        expect(button, name).toHaveProperty("disabled", false);
        expect(button.getAttribute("aria-disabled"), name).toBe("true");
      }
    } finally {
      root?.unmount();
      host.remove();
      consoleError.mockRestore();
    }
  });

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

  it("orients a horizontal toolbar's separator vertically", () => {
    renderThemed(
      <Toolbar.Root aria-label="Clipboard">
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Cut</Toolbar.Button>
        <Toolbar.Separator />
        <Toolbar.Button render={<Button variant="ghost" size="sm" />}>Paste</Toolbar.Button>
      </Toolbar.Root>
    );
    const separator = page.getByRole("separator").element();
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
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
