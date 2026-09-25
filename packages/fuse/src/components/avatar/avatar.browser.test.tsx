import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { Avatar } from "./index";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const BROKEN = "data:image/png;base64,not-a-png";

function slot(name: string): HTMLElement {
  // DOM audit: parts emit data-slot="avatar" | "avatar-image" | "avatar-fallback".
  const element = document.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected an element with data-slot="${name}"`);
  }
  return element;
}

describe("Avatar", () => {
  it("shows fallback initials when the image fails to load", async () => {
    renderThemed(
      <Avatar.Root>
        <Avatar.Image src={BROKEN} alt="Ada Lovelace" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );

    await vi.waitFor(() => {
      expect(page.getByText("AL", { exact: true }).query()).not.toBeNull();
    });
    expect(page.getByText("AL", { exact: true }).element().textContent).toBe("AL");
    expect(page.getByRole("img", { name: "Ada Lovelace" }).query()).toBeNull();
  });

  it("shows the img role and hides fallback once the image loads", async () => {
    let loaded = false;
    renderThemed(
      <Avatar.Root>
        <Avatar.Image
          src={PIXEL}
          alt="Ada Lovelace"
          onLoadingStatusChange={(status) => {
            if (status === "loaded") {
              loaded = true;
            }
          }}
        />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );

    await vi.waitFor(() => {
      expect(loaded).toBe(true);
      expect(page.getByRole("img", { name: "Ada Lovelace" }).query()).not.toBeNull();
    });
    expect(page.getByRole("img", { name: "Ada Lovelace" }).element().getAttribute("alt")).toBe(
      "Ada Lovelace"
    );
    expect(page.getByText("AL", { exact: true }).query()).toBeNull();
  });

  it("renders getByRole img with the given alt", async () => {
    renderThemed(
      <Avatar.Root>
        <Avatar.Image src={PIXEL} alt="Portrait of Ada Lovelace" />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );

    await vi.waitFor(() => {
      expect(page.getByRole("img", { name: "Portrait of Ada Lovelace" }).query()).not.toBeNull();
    });
    expect(page.getByRole("img", { name: "Portrait of Ada Lovelace" }).element().tagName).toBe("IMG");
  });

  it("emits data-slot values on every rendered part", () => {
    renderThemed(
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    expect(slot("avatar").getAttribute("data-slot")).toBe("avatar");
    expect(slot("avatar-fallback").getAttribute("data-slot")).toBe("avatar-fallback");
  });

  it("paints the root from the muted token and sizes it as a control box", () => {
    renderThemed(
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const fallback = page.getByText("AL", { exact: true }).element();
    if (!(fallback instanceof HTMLElement)) {
      throw new Error("expected the fallback");
    }
    const avatar = fallback.parentElement;
    if (!(avatar instanceof HTMLElement)) {
      throw new Error("expected the avatar root");
    }
    expect(getComputedStyle(avatar).backgroundColor).toBe(cssVarColor(avatar, "--muted"));
    expect(getComputedStyle(avatar).width).toBe("32px");
  });

  it("lets className size-10 beat the default size-8", () => {
    renderThemed(
      <Avatar.Root className="size-10">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const fallback = page.getByText("AL", { exact: true }).element();
    if (!(fallback instanceof HTMLElement)) {
      throw new Error("expected the fallback");
    }
    const avatar = fallback.parentElement;
    if (!(avatar instanceof HTMLElement)) {
      throw new Error("expected the avatar root");
    }
    expect(getComputedStyle(avatar).width).toBe("40px");
  });

  it("stacks group avatars with a background-coloured separating ring", () => {
    renderThemed(
      <Avatar.Group>
        <Avatar.Root>
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
        <Avatar.Root>
          <Avatar.Fallback>GH</Avatar.Fallback>
        </Avatar.Root>
      </Avatar.Group>
    );

    // DOM audit: the group and root parts emit data-slot; the stack overlap and ring are the
    // group's observable contract, and both avatars share the same part markup.
    const group = document.querySelector('[data-slot="avatar-group"]');
    if (!(group instanceof HTMLElement)) {
      throw new Error("expected the avatar group");
    }
    const avatars = [...group.querySelectorAll('[data-slot="avatar"]')];
    const [first, second] = avatars;
    if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) {
      throw new Error("expected two avatar roots");
    }
    expect(getComputedStyle(group).display).toBe("flex");
    expect(second.getBoundingClientRect().left).toBeLessThan(first.getBoundingClientRect().right);
    expect(getComputedStyle(first).boxShadow).toContain("2px");
    expect(getComputedStyle(first).boxShadow).toContain(cssVarColor(first, "--background"));
  });

  it("lets an explicit child ring utility override the group's ring", () => {
    const { rerender } = renderThemed(
      <Avatar.Group>
        <Avatar.Root className="ring-0">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Avatar.Group>
    );
    expect(getComputedStyle(slot("avatar")).boxShadow).not.toContain("2px");

    rerender(
      <Avatar.Group>
        <Avatar.Root className="ring-1 ring-foreground">
          <Avatar.Fallback>AL</Avatar.Fallback>
        </Avatar.Root>
      </Avatar.Group>
    );
    const ringed = slot("avatar");
    expect(getComputedStyle(ringed).boxShadow).toContain("1px");
  });
});
