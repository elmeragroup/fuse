import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { withLocale } from "../../../test/locale-matrix";
import { renderThemed as render, roleNamed } from "../../../test/themed-browser-render";

function descriptionIds(name: string): string[] {
  return (roleNamed("button", name).getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
}

function describedText(name: string): string {
  return descriptionIds(name)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

describe("Tooltip description identity", () => {
  it("keeps custom ids and existing description tokens connected through rerender, close and reopen", async () => {
    const field = (id: string, open: boolean) =>
      withLocale(
        "en-US",
        <>
          <p id="caller-help">Caller guidance</p>
          <Tooltip.Root open={open}>
            <Tooltip.Trigger aria-describedby="caller-help">Help</Tooltip.Trigger>
            <Tooltip.Content id={id}>Account guidance</Tooltip.Content>
          </Tooltip.Root>
        </>
      );
    const { rerender } = render(field("account-help", true));
    await expect.poll(() => describedText("Help")).toBe("Caller guidance Account guidance");
    await expect
      .element(page.getByRole("button", { name: "Help" }))
      .toHaveAccessibleDescription("Caller guidance Account guidance");
    expect(descriptionIds("Help")).toEqual(["caller-help", "account-help"]);
    expect(roleNamed("tooltip", "Account guidance").id).toBe("account-help");
    rerender(field("renamed-help", true));
    await expect.poll(() => descriptionIds("Help")).toEqual(["caller-help", "renamed-help"]);
    expect(document.getElementById("account-help")).toBeNull();
    rerender(field("renamed-help", false));
    await expect.poll(() => page.getByRole("tooltip").query()).toBeNull();
    expect(descriptionIds("Help")).toEqual(["caller-help"]);
    await expect
      .element(page.getByRole("button", { name: "Help" }))
      .toHaveAccessibleDescription("Caller guidance");
    rerender(field("renamed-help", true));
    await expect.poll(() => describedText("Help")).toBe("Caller guidance Account guidance");
    expect(descriptionIds("Help")).toEqual(["caller-help", "renamed-help"]);
  });

  it("follows the actual custom render element id across commits", async () => {
    const field = (id: string) =>
      withLocale(
        "en-US",
        <Tooltip.Root open>
          <Tooltip.Trigger>Rendered help</Tooltip.Trigger>
          <Tooltip.Content render={<div id={id} />}>Rendered guidance</Tooltip.Content>
        </Tooltip.Root>
      );
    const { rerender } = render(field("rendered-help"));
    await expect
      .element(page.getByRole("button", { name: "Rendered help" }))
      .toHaveAccessibleDescription("Rendered guidance");
    expect(descriptionIds("Rendered help")).toEqual(["rendered-help"]);
    rerender(field("updated-rendered-help"));
    await expect.poll(() => descriptionIds("Rendered help")).toEqual(["updated-rendered-help"]);
    await expect
      .element(page.getByRole("button", { name: "Rendered help" }))
      .toHaveAccessibleDescription("Rendered guidance");
  });

  it("keeps generated and custom tooltip identities separate across multiple instances", async () => {
    render(
      withLocale(
        "en-US",
        <>
          <Tooltip.Root open>
            <Tooltip.Trigger>Generated</Tooltip.Trigger>
            <Tooltip.Content>Generated guidance</Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root open>
            <Tooltip.Trigger>Custom</Tooltip.Trigger>
            <Tooltip.Content id="custom-help">Custom guidance</Tooltip.Content>
          </Tooltip.Root>
        </>
      )
    );
    await expect.poll(() => describedText("Generated")).toBe("Generated guidance");
    await expect.poll(() => describedText("Custom")).toBe("Custom guidance");
    expect(descriptionIds("Generated")).not.toContain("custom-help");
    expect(descriptionIds("Custom")).toEqual(["custom-help"]);
    expect(roleNamed("tooltip", "Generated guidance").id).not.toBe("custom-help");
  });
});
