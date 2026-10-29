import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// The corner radius role token lives in themes.css only.
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { px, renderThemed } from "../../../test/themed-browser-render";
import { ToggleGroup } from "./index";

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

  it("emits data-spacing and --gap from spacing, including 0, rounds only a segmented group's outer corners, and keeps --gap when the consumer passes style", () => {
    renderThemed(
      <>
        <ToggleGroup.Root aria-label="Segmented" spacing={0} variant="outline">
          <ToggleGroup.Item value="one">One</ToggleGroup.Item>
          <ToggleGroup.Item value="two">Two</ToggleGroup.Item>
        </ToggleGroup.Root>
        <ToggleGroup.Root aria-label="Full width" spacing={3} style={{ width: "100%" }}>
          <ToggleGroup.Item value="one">One</ToggleGroup.Item>
        </ToggleGroup.Root>
      </>
    );

    const segmented = groupNamed("Segmented");
    expect(segmented.getAttribute("data-spacing")).toBe("0");
    expect(segmented.style.getPropertyValue("--gap")).toBe("0");
    // Segmented items join: only the outer corners of the first and last item stay round.
    const [first, last] = segmented.querySelectorAll("button");
    if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
      throw new Error("expected two segmented items");
    }
    expect(px(getComputedStyle(first).borderTopLeftRadius)).toBeGreaterThan(0);
    expect(px(getComputedStyle(first).borderTopRightRadius)).toBe(0);
    expect(px(getComputedStyle(last).borderTopLeftRadius)).toBe(0);
    expect(px(getComputedStyle(last).borderTopRightRadius)).toBeGreaterThan(0);

    const fullWidth = groupNamed("Full width");
    expect(fullWidth.style.width).toBe("100%");
    expect(fullWidth.style.getPropertyValue("--gap")).toBe("3");
  });

  it("uses recipe defaults on a standalone Item", () => {
    renderThemed(<ToggleGroup.Item value="alone">Standalone</ToggleGroup.Item>);

    const item = buttonNamed("Standalone");
    expect(item.getAttribute("data-slot")).toBe("toggle-group-item");
    expect(item.getAttribute("data-size")).toBe("default");
    expect(item.getAttribute("data-variant")).toBe("default");
    expect(px(getComputedStyle(item).height)).toBe(36);
    expect(getComputedStyle(item).backgroundColor).toBe("rgba(0, 0, 0, 0)");
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
