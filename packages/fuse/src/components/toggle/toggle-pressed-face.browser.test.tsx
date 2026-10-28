import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the faces below read them per scheme.
import "../../../dist/themes.css";
import { cssVarColor, fkasExternal, renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { ToggleGroup } from "../toggle-group";
import { Toggle } from "./toggle";

type Variant = "default" | "outline";

/** A pressed and an unpressed toggle in each place `toggleVariants` paints one. */
const LAYOUTS = {
  standalone: (variant: Variant): ReactNode => (
    <>
      <Toggle variant={variant} defaultPressed>
        Pressed
      </Toggle>
      <Toggle variant={variant}>Unpressed</Toggle>
    </>
  ),
  joined: (variant: Variant): ReactNode => (
    <ToggleGroup.Root aria-label="Joined" variant={variant} spacing={0} defaultValue={["pressed"]}>
      <ToggleGroup.Item value="pressed">Pressed</ToggleGroup.Item>
      <ToggleGroup.Item value="unpressed">Unpressed</ToggleGroup.Item>
    </ToggleGroup.Root>
  ),
  spaced: (variant: Variant): ReactNode => (
    <ToggleGroup.Root aria-label="Spaced" variant={variant} defaultValue={["pressed"]}>
      <ToggleGroup.Item value="pressed">Pressed</ToggleGroup.Item>
      <ToggleGroup.Item value="unpressed">Unpressed</ToggleGroup.Item>
    </ToggleGroup.Root>
  ),
};

const CASES = (["standalone", "joined", "spaced"] as const).flatMap((layout) =>
  (["default", "outline"] as const).flatMap((variant) =>
    (["light", "dark"] as const).map((scheme) => [layout, variant, scheme] as const)
  )
);

/** A toggle's fill and text colour once its colour transition has finished. */
async function faceOf(name: string): Promise<{ fill: string; text: string }> {
  const toggle = roleNamed("button", name);
  await Promise.all(toggle.getAnimations().map((animation) => animation.finished));
  const style = getComputedStyle(toggle);
  return { fill: style.backgroundColor, text: style.color };
}

describe("Toggle pressed face", () => {
  it.each(CASES)(
    "fills a pressed %s %s toggle with primary, apart from the hover tint, in %s",
    async (layout, variant, scheme) => {
      // Unit under test: the pressed and hover faces `toggleVariants` gives Toggle and
      // ToggleGroup.Item. Oracle: the scope's own `--primary`, `--primary-foreground`,
      // `--muted` and `--foreground`, on the fkas private page, whose tint the muted hover
      // barely clears.
      const toggles = <ThemeScope theme={fkasExternal}>{LAYOUTS[layout](variant)}</ThemeScope>;
      renderThemed(scheme === "dark" ? <div data-theme="dark">{toggles}</div> : toggles);
      const host = roleNamed("button", "Pressed");
      const pressed = {
        fill: cssVarColor(host, "--primary"),
        text: cssVarColor(host, "--primary-foreground"),
      };
      const hovered = { fill: cssVarColor(host, "--muted"), text: cssVarColor(host, "--foreground") };
      // Oracle sanity: the hover tint differs from the pressed fill, so a pressed face that
      // kept the tint fails.
      expect(hovered.fill).not.toBe(pressed.fill);

      expect(await faceOf("Pressed")).toEqual(pressed);
      expect((await faceOf("Unpressed")).fill).toBe("rgba(0, 0, 0, 0)");

      await userEvent.hover(page.getByRole("button", { name: "Unpressed", exact: true }));
      expect(await faceOf("Unpressed")).toEqual(hovered);
      expect(await faceOf("Pressed")).toEqual(pressed);

      await userEvent.hover(page.getByRole("button", { name: "Pressed", exact: true }));
      expect(await faceOf("Pressed")).toEqual(pressed);
      expect((await faceOf("Unpressed")).fill).toBe("rgba(0, 0, 0, 0)");
    }
  );
});
