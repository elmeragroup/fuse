import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { cssVarColor, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Button } from "./button";

describe("the internal RAC Button", () => {
  it("paints the recipe hover from RAC's hover state", async () => {
    renderThemed(
      <Button variant="ghost" className="transition-none">
        Previous month
      </Button>
    );
    const trigger = roleNamed("button", "Previous month");
    expect(trigger.hasAttribute("data-rac")).toBe(true);

    await userEvent.hover(page.getByRole("button", { name: "Previous month" }));
    expect(trigger.hasAttribute("data-hovered")).toBe(true);
    expect(getComputedStyle(trigger).backgroundColor).toBe(cssVarColor(trigger, "--muted"));
  });
});
