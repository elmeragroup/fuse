import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import {
  renderThemed,
  cssVarColor,
  fkasBranded,
  fkasPrivate,
  roleNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { ToggleGroup } from "../toggle-group";
import { Toggle } from "./toggle";

function toggleNamed(name: string, pressed?: boolean): HTMLElement {
  const element = page.getByRole("button", { name, exact: true, pressed }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML toggle named ${name}`);
  }
  return element;
}

describe("Toggle", () => {
  it("supports controlled pressed and uncontrolled defaultPressed", async () => {
    const onPressedChange = vi.fn();
    renderThemed(
      <>
        <Toggle pressed={false} onPressedChange={onPressedChange}>
          Held
        </Toggle>
        <Toggle defaultPressed>Open</Toggle>
      </>
    );

    await expect.element(page.getByRole("button", { name: "Held", pressed: false })).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Open", pressed: true })).toBeInTheDocument();
    const open = toggleNamed("Open", true);
    expect(open.getAttribute("aria-pressed")).toBe("true");
    expect(open.hasAttribute("data-pressed")).toBe(true);
    expect(open.getAttribute("data-slot")).toBe("toggle");

    await userEvent.click(page.getByRole("button", { name: "Held", exact: true }));
    expect(onPressedChange).toHaveBeenNthCalledWith(1, true, expect.anything());
    await expect.element(page.getByRole("button", { name: "Held", pressed: false })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Open", exact: true }));
    await expect.element(page.getByRole("button", { name: "Open", pressed: false })).toBeInTheDocument();
  });
});

describe("Toggle focus ring", () => {
  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Toggle>Bold</Toggle>
      </>
    );
    await assertFocusRingAtBothDensities(roleNamed("button", "Before"), roleNamed("button", "Bold"));
  });
});

describe("pressed face", () => {
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

  /**
   * The role pair each theme identity fills a pressed toggle with, and the pair the other identity
   * uses. Neutral themes keep the quiet muted face on their neutral page; branded themes fill
   * with primary, since muted barely clears their tinted brand pages.
   */
  const PRESSED_ROLES = {
    neutral: {
      theme: fkasPrivate,
      fill: "--muted",
      text: "--foreground",
      otherFill: "--primary",
    },
    branded: {
      theme: fkasBranded,
      fill: "--primary",
      text: "--primary-foreground",
      otherFill: "--muted",
    },
  } as const;

  const CASES = (["neutral", "branded"] as const).flatMap((identity) =>
    (["standalone", "joined", "spaced"] as const).flatMap((layout) =>
      (["default", "outline"] as const).flatMap((variant) =>
        (["light", "dark"] as const).map((scheme) => [identity, layout, variant, scheme] as const)
      )
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
      "fills a pressed %s %s %s toggle with its variant's pressed pair, in %s",
      async (identity, layout, variant, scheme) => {
        // Unit under test: the pressed and hover faces `toggleVariants` gives Toggle and
        // ToggleGroup.Item. Oracle: the scope's own role values, on the fkas private page: its
        // `--muted` and `--foreground` for a neutral pressed toggle, its `--primary` and
        // `--primary-foreground` for a branded one, and `--muted` and `--foreground` on hover.
        const roles = PRESSED_ROLES[identity];
        const toggles = <ThemeScope theme={roles.theme}>{LAYOUTS[layout](variant)}</ThemeScope>;
        renderThemed(scheme === "dark" ? <div data-theme="dark">{toggles}</div> : toggles);
        const host = roleNamed("button", "Pressed");
        const pressed = { fill: cssVarColor(host, roles.fill), text: cssVarColor(host, roles.text) };
        const hovered = { fill: cssVarColor(host, "--muted"), text: cssVarColor(host, "--foreground") };
        // Oracle sanity: the other variant's pressed fill differs in this scope, so a recipe that
        // painted the wrong variant's pair fails.
        expect(cssVarColor(host, roles.otherFill)).not.toBe(pressed.fill);

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

    it("follows a host override of the pressed pair", async () => {
      // Unit under test: the `toggle-pressed` utilities. Oracle: literal colours the host sets on
      // a neutral scope, which no theme declares.
      renderThemed(
        <div
          style={{ "--toggle-pressed": "rgb(1, 2, 3)", "--toggle-pressed-foreground": "rgb(250, 251, 252)" }}>
          <Toggle defaultPressed>Pressed</Toggle>
        </div>
      );
      expect(await faceOf("Pressed")).toEqual({ fill: "rgb(1, 2, 3)", text: "rgb(250, 251, 252)" });
    });
  });
});
