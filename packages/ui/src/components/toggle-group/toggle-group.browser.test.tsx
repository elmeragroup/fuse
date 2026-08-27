import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { ToggleGroup } from "./toggle-group";

function groupNamed(name: string): HTMLElement {
  const element = page.getByRole("group", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a group named ${name}`);
  }
  return element;
}

function buttonNamed(name: string, pressed?: boolean): HTMLElement {
  const element = page.getByRole("button", { name, exact: true, pressed }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected a button named ${name}`);
  }
  return element;
}

describe("ToggleGroup", () => {
  it("presses one item at a time when multiple is false and empties on a second click", async () => {
    const onValueChange = vi.fn();
    renderThemed(
      <ToggleGroup.Root aria-label="Align" multiple={false} onValueChange={onValueChange}>
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>
    );

    expect(groupNamed("Align").getAttribute("data-slot")).toBe("toggle-group");
    await expect.element(page.getByRole("button", { name: "Left", pressed: false })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Right", pressed: false })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Left", exact: true }));
    await expect.element(page.getByRole("button", { name: "Left", pressed: true })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Right", pressed: false })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(1, ["left"], expect.anything());

    await userEvent.click(page.getByRole("button", { name: "Right", exact: true }));
    await expect.element(page.getByRole("button", { name: "Left", pressed: false })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Right", pressed: true })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(2, ["right"], expect.anything());

    await userEvent.click(page.getByRole("button", { name: "Right", exact: true }));
    await expect.element(page.getByRole("button", { name: "Right", pressed: false })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(3, [], expect.anything());
  });

  it("toggles items independently when multiple is true and accumulates values", async () => {
    const onValueChange = vi.fn();
    renderThemed(
      <ToggleGroup.Root aria-label="Style" multiple onValueChange={onValueChange}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
    );

    await userEvent.click(page.getByRole("button", { name: "Bold", exact: true }));
    await expect.element(page.getByRole("button", { name: "Bold", pressed: true })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(1, ["bold"], expect.anything());

    await userEvent.click(page.getByRole("button", { name: "Italic", exact: true }));
    await expect.element(page.getByRole("button", { name: "Bold", pressed: true })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Italic", pressed: true })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(2, ["bold", "italic"], expect.anything());

    await userEvent.click(page.getByRole("button", { name: "Bold", exact: true }));
    await expect.element(page.getByRole("button", { name: "Bold", pressed: false })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Italic", pressed: true })).toBeInTheDocument();
    expect(onValueChange).toHaveBeenNthCalledWith(3, ["italic"], expect.anything());
  });

  it("moves focus with horizontal arrows, toggles with Space and Enter, and is a single tab stop", async () => {
    const onValueChange = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <ToggleGroup.Root aria-label="Align" onValueChange={onValueChange}>
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
        <button type="button">After</button>
      </>
    );

    buttonNamed("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("Left", false));

    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(buttonNamed("Right", false));
    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(buttonNamed("Left", false));

    await userEvent.keyboard(" ");
    expect(onValueChange).toHaveBeenNthCalledWith(1, ["left"], expect.anything());
    await expect.element(page.getByRole("button", { name: "Left", pressed: true })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenNthCalledWith(2, [], expect.anything());
    await expect.element(page.getByRole("button", { name: "Left", pressed: false })).toBeInTheDocument();

    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(buttonNamed("After"));
  });

  it("navigates with ArrowUp/ArrowDown when orientation is vertical", async () => {
    renderThemed(
      <ToggleGroup.Root aria-label="Stack" orientation="vertical">
        <ToggleGroup.Item value="one">One</ToggleGroup.Item>
        <ToggleGroup.Item value="two">Two</ToggleGroup.Item>
      </ToggleGroup.Root>
    );

    const root = groupNamed("Stack");
    expect(root.getAttribute("data-orientation")).toBe("vertical");

    buttonNamed("One").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(buttonNamed("One"));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(buttonNamed("Two"));
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(buttonNamed("One"));
  });

  it("resolves size as itemProp ?? contextValue via data-size", () => {
    renderThemed(
      <ToggleGroup.Root aria-label="Sizes" size="sm">
        <ToggleGroup.Item value="unset">Unset</ToggleGroup.Item>
        <ToggleGroup.Item value="override" size="lg">
          Override
        </ToggleGroup.Item>
      </ToggleGroup.Root>
    );

    expect(buttonNamed("Unset").getAttribute("data-size")).toBe("sm");
    expect(buttonNamed("Override").getAttribute("data-size")).toBe("lg");
  });

  it("emits data-spacing=0, --gap: 0, and directional cap-rounding classes", () => {
    renderThemed(
      <ToggleGroup.Root aria-label="Segmented" spacing={0} variant="outline">
        <ToggleGroup.Item value="one">One</ToggleGroup.Item>
        <ToggleGroup.Item value="two">Two</ToggleGroup.Item>
      </ToggleGroup.Root>
    );

    const root = groupNamed("Segmented");
    expect(root.getAttribute("data-spacing")).toBe("0");
    expect(root.style.getPropertyValue("--gap")).toBe("0");

    const first = buttonNamed("One");
    const last = buttonNamed("Two");
    expect(first.className.split(/\s+/)).toContain(
      "group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-md"
    );
    expect(last.className.split(/\s+/)).toContain(
      "group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-md"
    );
    expect(first.className.split(/\s+/)).toContain(
      "group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md"
    );
    expect(last.className.split(/\s+/)).toContain(
      "group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md"
    );
  });

  it("uses recipe defaults on a standalone Item", () => {
    renderThemed(<ToggleGroup.Item value="alone">Standalone</ToggleGroup.Item>);

    const item = buttonNamed("Standalone");
    expect(item.getAttribute("data-slot")).toBe("toggle-group-item");
    expect(item.getAttribute("data-size")).toBe("default");
    expect(item.getAttribute("data-variant")).toBe("default");
    expect(item.className.split(/\s+/)).toContain("h-(--control-h-md)");
    expect(item.className.split(/\s+/)).toContain("bg-transparent");
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <ToggleGroup.Root aria-label="Align">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup.Root>
      </>
    );
    await assertFocusRingAtBothDensities(buttonNamed("Before"), buttonNamed("Left"));
  });
});
