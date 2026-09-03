import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { Item } from "./item";

describe("Item", () => {
  it("keeps data-slot, data-variant, and data-size on a link render", () => {
    renderThemed(
      <Item.Root variant="outline" size="sm" render={<a href="#order" />}>
        <Item.Title>Order</Item.Title>
      </Item.Root>
    );
    const link = page.getByRole("link", { name: "Order", exact: true }).element();
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("data-slot")).toBe("item");
    expect(link.getAttribute("data-variant")).toBe("outline");
    expect(link.getAttribute("data-size")).toBe("sm");
  });

  it("keeps state attributes on a button render", () => {
    renderThemed(
      <Item.Root render={<button type="button" />}>
        <Item.Title>Activate</Item.Title>
      </Item.Root>
    );
    const button = page.getByRole("button", { name: "Activate", exact: true }).element();
    expect(button.getAttribute("data-slot")).toBe("item");
    expect(button.getAttribute("data-variant")).toBe("default");
    expect(button.getAttribute("data-size")).toBe("default");
  });

  it("defaults group children to listitem and lets an explicit role win", () => {
    renderThemed(
      <>
        <Item.Root>
          <Item.Title>Loose</Item.Title>
        </Item.Root>
        <Item.Group>
          <Item.Root>
            <Item.Title>Member</Item.Title>
          </Item.Root>
          <Item.Root role="presentation">
            <Item.Title>Override</Item.Title>
          </Item.Root>
          <Item.Separator />
        </Item.Group>
      </>
    );
    const loose = page.getByText("Loose", { exact: true }).element().closest("[data-slot=item]");
    expect(loose?.getAttribute("role")).toBeNull();
    expect(page.getByRole("list").element().getAttribute("data-slot")).toBe("item-group");
    const member = page.getByText("Member", { exact: true }).element().closest("[data-slot=item]");
    expect(member?.getAttribute("role")).toBe("listitem");
    expect(member?.getAttribute("data-slot")).toBe("item");
    const override = page.getByText("Override", { exact: true }).element().closest("[data-slot=item]");
    expect(override?.getAttribute("role")).toBe("presentation");
  });

  it("emits media variant and footer mode without dark classes", () => {
    renderThemed(
      <Item.Root>
        <Item.Media variant="image" />
        <Item.Footer mode="hidden">Hidden</Item.Footer>
        <Item.Footer mode="visible">Visible</Item.Footer>
      </Item.Root>
    );
    const media = document.querySelector("[data-slot=item-media]");
    expect(media?.getAttribute("data-variant")).toBe("image");
    expect(media?.className).not.toContain("dark:");
    const hidden = page.getByText("Hidden", { exact: true }).element().closest("[data-slot=item-footer]");
    const visible = page.getByText("Visible", { exact: true }).element().closest("[data-slot=item-footer]");
    expect(hidden?.getAttribute("data-mode")).toBe("hidden");
    expect(hidden?.className.split(/\s+/)).toContain("pointer-events-none");
    expect(hidden?.className).toContain("0fr");
    expect(visible?.getAttribute("data-mode")).toBe("visible");
    expect(visible?.className).toContain("starting:");
  });

  it("makes a link-rendered item keyboard-activatable with the shared focus ring", async () => {
    renderThemed(
      <>
        <a href="#before">Before</a>
        <Item.Root render={<a href="#order" />}>
          <Item.Title>Order</Item.Title>
        </Item.Root>
      </>
    );
    const previous = page.getByRole("link", { name: "Before", exact: true }).element();
    const link = page.getByRole("link", { name: "Order", exact: true }).element();
    if (!(previous instanceof HTMLElement) || !(link instanceof HTMLElement)) {
      throw new Error("expected links");
    }
    const initialHash = window.location.hash;
    const setHash = (hash: string) => {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    };

    try {
      // The ring helper's mouse arm clicks the link, which already navigates to #order.
      // Clearing the hash afterwards is what makes the Enter press below the only thing
      // that can set it — otherwise the navigation assertion is true before the key press.
      await assertFocusRingOnKeyboardAbsentOnMouse(previous, link);
      setHash("");
      expect(window.location.hash, "the Enter press must be the only navigation under test").toBe("");

      link.focus();
      await userEvent.keyboard("{Enter}");
      await vi.waitFor(() => {
        expect(window.location.hash, "Enter on a link-rendered item must navigate").toBe("#order");
      });
    } finally {
      setHash(initialHash);
    }
  });

  it("activates a button-rendered item from Enter and from Space", async () => {
    const onActivate = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Item.Root render={<button type="button" onClick={onActivate} />}>
          <Item.Title>Activate</Item.Title>
        </Item.Root>
      </>
    );

    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    if (!(previous instanceof HTMLElement)) {
      throw new Error("expected the preceding button");
    }
    previous.focus();
    await userEvent.keyboard("{Tab}");
    const item = page.getByRole("button", { name: "Activate", exact: true }).element();
    expect(document.activeElement, "the item must be reachable by Tab").toBe(item);

    await userEvent.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledTimes(1);

    await userEvent.keyboard(" ");
    expect(onActivate).toHaveBeenCalledTimes(2);
  });
});
