import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
import "../../dist/themes.css";
import { settleTransitions } from "../../test/assert-invalid-ring";
import { emulateForcedColors } from "../../test/forced-colors";
import { withLocale } from "../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../test/themed-browser-render";
import { Button } from "../components/button/button";
import { InputGroup } from "../components/input-group";
import { Input } from "../components/input/input";
import { DateField } from "../react-aria/date-field/date-field";
import { UiProviders } from "../react-aria/ui-providers/ui-providers";

/**
 * Forced-colors mode drops `box-shadow`, so the focus ring must also draw an outline there.
 * The expected values are Tailwind's documented `outline-hidden` contract: under
 * `forced-colors: active` a 2px solid outline, which the system recolours (WCAG 2.4.7).
 */

function outlineOf(element: HTMLElement) {
  settleTransitions(element);
  const style = getComputedStyle(element);
  return { style: style.outlineStyle, width: style.outlineWidth };
}

function renderHosts(): void {
  renderThemed(
    withLocale(
      "en-US",
      <UiProviders locale="en-US" navigate={() => undefined}>
        <p>Away</p>
        <button type="button">Before button</button>
        <Button>Save</Button>
        <button type="button">Before input</button>
        <Input aria-label="Invalid input" aria-invalid />
        <button type="button">Before group</button>
        <InputGroup.Root aria-label="Search group">
          <InputGroup.Input aria-label="Search" />
        </InputGroup.Root>
        <button type="button">Before date field</button>
        <DateField label="Due date" />
      </UiProviders>
    )
  );
}

function inputGroupRoot(): HTMLElement {
  const root = roleNamed("textbox", "Search").closest<HTMLElement>('[data-slot="input-group"]');
  if (root === null) {
    throw new Error("expected the input group root around the input");
  }
  return root;
}

async function tabInto(before: string): Promise<void> {
  roleNamed("button", before).focus();
  await userEvent.keyboard("{Tab}");
}

describe("the focus ring in forced-colors mode", () => {
  beforeEach(async () => {
    await emulateForcedColors("active");
  });

  afterEach(async () => {
    await emulateForcedColors("none");
  });

  it("draws a 2px solid outline on every keyboard-focused ring host and none at rest", async () => {
    renderHosts();

    const none = () => undefined;
    for (const [label, before, host, embedded] of [
      // Self target.
      ["button", "Before button", () => roleNamed("button", "Save"), none],
      // Self target with the invalid face.
      ["invalid input", "Before input", () => roleNamed("textbox", "Invalid input"), none],
      // Within target: the group root draws the outline, and its owned control draws none.
      ["input group", "Before group", inputGroupRoot, () => roleNamed("textbox", "Search")],
      // State target: React Aria reports focus through a render prop.
      ["date field group", "Before date field", () => roleNamed("group", "Due date"), none],
    ] as const) {
      await tabInto(before);
      expect(outlineOf(host()), `${label} while focused`).toEqual({ style: "solid", width: "2px" });
      const control = embedded();
      if (control !== undefined) {
        expect(outlineOf(control).style, `${label} control while focused`).toBe("none");
      }
      await userEvent.click(page.getByText("Away", { exact: true }));
      expect(outlineOf(host()).style, `${label} at rest`).toBe("none");
    }
  });

  it("keeps the outline off a keyboard-focused button when forced colors are off", async () => {
    await emulateForcedColors("none");
    renderHosts();

    await tabInto("Before button");
    expect(outlineOf(roleNamed("button", "Save")).style).toBe("none");
  });
});
