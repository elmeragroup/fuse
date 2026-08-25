import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Avatar } from "./avatar";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const BROKEN = "data:image/png;base64,not-a-png";

function slot(name: string): HTMLElement {
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
    expect(slot("avatar").getAttribute("data-slot")).toBe("avatar");
    expect(slot("avatar-fallback").textContent).toBe("AL");
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
    expect(slot("avatar-image").getAttribute("alt")).toBe("Ada Lovelace");
    expect(page.getByText("AL", { exact: true }).query()).toBeNull();
    expect(document.querySelector('[data-slot="avatar-fallback"]')).toBeNull();
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
    expect(page.getByRole("img", { name: "Portrait of Ada Lovelace" }).element()).toBe(slot("avatar-image"));
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

  it("uses bg-muted on the root and never a raw gray palette class", () => {
    renderThemed(
      <Avatar.Root>
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const classes = slot("avatar").className.split(/\s+/);
    expect(classes).toContain("bg-muted");
    expect(classes).toContain("text-muted-foreground");
    expect(classes.some((token) => token.startsWith("bg-gray-"))).toBe(false);
    expect(classes.some((token) => token.startsWith("text-gray-"))).toBe(false);
  });

  it("lets className size-10 beat the default size-8", () => {
    renderThemed(
      <Avatar.Root className="size-10">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    );
    const classes = slot("avatar").className.split(/\s+/);
    expect(classes).toContain("size-10");
    expect(classes).not.toContain("size-8");
  });
});
