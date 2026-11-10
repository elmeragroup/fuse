import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Avatar } from "./index";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const BROKEN = "data:image/png;base64,not-a-png";

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
});
