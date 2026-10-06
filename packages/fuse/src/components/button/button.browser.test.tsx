import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { shadowLayerLengths, shadowLayers } from "../../../test/assert-invalid-ring";
import type { ShadowLengths } from "../../../test/assert-invalid-ring";
import { render } from "../../../test/browser-render";
import { whilePointerPressed } from "../../../test/pointer-press";
import { dispatchPredictedPointer } from "../../../test/predicted-pointer";
import {
  cssVarColor,
  effectiveOpacity,
  fkasExternal,
  fkasPrivate,
  computedOklch,
  px,
  renderThemed,
  roleNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Tooltip } from "../tooltip";
import { Button } from "./button";

const VARIANTS = ["default", "outline", "secondary", "ghost", "destructive", "success", "link"] as const;

/** The paint and position a hover or press could change on a button. */
function pointerPaint(element: Element) {
  const style = getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    borderColor: style.borderColor,
    color: style.color,
    textDecorationLine: style.textDecorationLine,
    transform: style.transform,
    translate: style.translate,
  };
}

/**
 * The `--tw-shadow` layer of an element's computed box-shadow, the last of the layers Tailwind
 * composes behind the ring layers. A layer without exactly four lengths fails the read.
 */
function ownShadow(element: Element): ShadowLengths & { readonly css: string } {
  const boxShadow = getComputedStyle(element).boxShadow;
  const css = shadowLayers(boxShadow).at(-1);
  const lengths = css === undefined ? undefined : shadowLayerLengths(css);
  if (css === undefined || lengths === undefined) {
    throw new Error(`expected a box-shadow layer of four lengths, got ${boxShadow}`);
  }
  return { css, ...lengths };
}

/** Whether an outer shadow reaches past every edge of its element's border box. */
function paintsOutsideBorderBox({ x, y, blur, spread }: ShadowLengths): boolean {
  // The shadow is the border box grown by the spread, moved by the offset and blurred over
  // the blur radius. An outer shadow never paints inside the border box.
  return spread + blur + Math.max(Math.abs(x), Math.abs(y)) > 0;
}

describe("Button", () => {
  it("activates once on click, Enter, and Space", async () => {
    const onClick = vi.fn();
    renderThemed(<Button onClick={onClick}>Save</Button>);

    await userEvent.click(page.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    const button = roleNamed("button", "Save");
    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);

    button.focus();
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("blocks click and keyboard activation when disabled or pending", async () => {
    const onDisabledClick = vi.fn();
    const onPendingClick = vi.fn();
    renderThemed(
      <>
        <Button disabled onClick={onDisabledClick}>
          Disabled
        </Button>
        <Button isPending onClick={onPendingClick}>
          Saving
        </Button>
      </>
    );

    const disabled = roleNamed("button", "Disabled");
    const pending = roleNamed("button", "Saving");

    await expect.element(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
    // A pending button is unavailable to assistive tech and blocked, but not natively
    // disabled: it stays in the focus order (see the pending suite below).
    expect(pending.hasAttribute("disabled")).toBe(false);
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    expect(pending.hasAttribute("data-pending")).toBe(true);
    expect(disabled.hasAttribute("data-pending")).toBe(false);

    disabled.click();
    pending.click();
    disabled.focus();
    await userEvent.keyboard("{Enter}");
    pending.focus();
    await userEvent.keyboard(" ");

    expect(onDisabledClick).not.toHaveBeenCalled();
    expect(onPendingClick).not.toHaveBeenCalled();
  });

  describe("pending", () => {
    it("keeps focus on the button that started the action and announces busy", async () => {
      function Fixture({ pending }: { pending: boolean }) {
        return (
          <Button isPending={pending} className="transition-none" onClick={() => undefined}>
            Save
          </Button>
        );
      }
      const { rerender } = renderThemed(<Fixture pending={false} />);
      const button = roleNamed("button", "Save");
      button.focus();
      expect(document.activeElement).toBe(button);

      rerender(<Fixture pending />);
      // The same element: no native `disabled`, so focus never fell to <body>.
      expect(document.activeElement).toBe(button);
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(button.tabIndex).toBe(0);
      expect(button.getAttribute("aria-busy")).toBe("true");
      expect(button.getAttribute("aria-disabled")).toBe("true");
      // The disabled treatment still paints once.
      expect(effectiveOpacity(button)).toBe(0.5);
      expect(getComputedStyle(button).cursor).toBe("not-allowed");

      // Tab still leaves it, so a user is not trapped on a busy control.
      await userEvent.keyboard("{Tab}");
      expect(document.activeElement).not.toBe(button);

      rerender(<Fixture pending={false} />);
      expect(button.hasAttribute("aria-busy")).toBe(false);
      expect(button.hasAttribute("aria-disabled")).toBe(false);
      expect(button.hasAttribute("data-pending")).toBe(false);
    });

    it("restores the native disabled attribute when a consumer opts out of staying focusable", async () => {
      renderThemed(
        <Button isPending focusableWhenDisabled={false}>
          Saving
        </Button>
      );
      await expect.element(page.getByRole("button", { name: "Saving" })).toBeDisabled();
      expect(roleNamed("button", "Saving").hasAttribute("aria-busy")).toBe(true);
    });

    /** The one decorative indicator slot, or null. Tests read it by slot since it has no role. */
    function indicatorSlot(button: HTMLElement): HTMLElement | null {
      // DOM audit: the pending indicator is decorative (aria-hidden), so it has no role; the
      // mandated slot is the only handle, and also the hook the recipe keys its icon swap on.
      const slots = button.querySelectorAll("[data-slot=button-pending-indicator]");
      expect(slots.length).toBeLessThanOrEqual(1);
      const slot = slots[0];
      return slot instanceof HTMLElement ? slot : null;
    }

    function display(button: HTMLElement, testId: string): string | null {
      const element = button.querySelector(`[data-testid=${testId}]`);
      return element === null ? null : getComputedStyle(element).display;
    }

    it("shows one spinning indicator in the leading icon position and swaps the button's own icons for it", () => {
      renderThemed(
        <>
          <Button isPending>
            <svg data-testid="own-icon" data-icon="inline-start" aria-hidden viewBox="0 0 1 1" />
            Saving
          </Button>
          <Button isPending>
            Next
            <svg data-testid="trailing-icon" data-icon="inline-end" aria-hidden viewBox="0 0 1 1" />
          </Button>
          <Button isPending size="icon" aria-label="Refreshing">
            <svg data-testid="square-icon" aria-hidden viewBox="0 0 1 1" />
          </Button>
          <Button>
            <svg data-testid="resting-icon" data-icon="inline-start" aria-hidden viewBox="0 0 1 1" />
            Save
          </Button>
        </>
      );

      const saving = roleNamed("button", "Saving");
      const slot = indicatorSlot(saving);
      if (slot === null) {
        throw new Error("expected a pending indicator slot");
      }
      // Decorative, leading, spinning, and sized by the recipe's 16px icon rule.
      expect(slot.getAttribute("aria-hidden")).toBe("true");
      expect(slot.getAttribute("data-icon")).toBe("inline-start");
      expect(saving.firstElementChild).toBe(slot);
      const spinner = slot.querySelector("svg");
      expect(spinner).not.toBeNull();
      if (spinner === null) {
        return;
      }
      expect(getComputedStyle(spinner).animationName).toBe("spin");
      expect(getComputedStyle(spinner).width).toBe("16px");
      // The leading edge takes the icon inset, as for any inline-start child.
      const edge = getComputedStyle(saving);
      expect(px(edge.paddingInlineStart)).toBeLessThan(px(edge.paddingInlineEnd));

      // The button's own leading icon makes way for the spinner; the label stays.
      expect(display(saving, "own-icon")).toBe("none");
      expect(saving.textContent).toContain("Saving");

      // A trailing icon stays: its marker keeps the end inset tight whether or not it shows.
      const next = roleNamed("button", "Next");
      expect(display(next, "trailing-icon")).not.toBe("none");
      expect(indicatorSlot(next)).not.toBeNull();

      // A square shows the spinner alone and keeps its square.
      const square = roleNamed("button", "Refreshing");
      expect(display(square, "square-icon")).toBe("none");
      expect(indicatorSlot(square)).not.toBeNull();
      expect(getComputedStyle(square).width).toBe(getComputedStyle(square).height);

      // At rest nothing is hidden and no indicator renders.
      const resting = roleNamed("button", "Save");
      expect(indicatorSlot(resting)).toBeNull();
      expect(display(resting, "resting-icon")).not.toBe("none");
    });

    it("renders a consumer's node in the indicator's place, without animating it", () => {
      renderThemed(
        <Button isPending pendingIndicator={<svg data-testid="brand-spinner" viewBox="0 0 1 1" />}>
          <svg data-testid="logo" data-icon="inline-start" aria-hidden viewBox="0 0 1 1" />
          Continue
        </Button>
      );
      const button = roleNamed("button", "Continue");
      const slot = indicatorSlot(button);
      if (slot === null) {
        throw new Error("expected a pending indicator slot");
      }
      expect(button.firstElementChild).toBe(slot);
      expect(slot.getAttribute("aria-hidden")).toBe("true");
      // The slot holds the consumer's node and nothing else; the default spinner is gone.
      expect(slot.children).toHaveLength(1);
      expect(slot.firstElementChild?.getAttribute("data-testid")).toBe("brand-spinner");
      expect(getComputedStyle(slot.firstElementChild ?? slot).animationName).toBe("none");
      // The icon swap still applies, so the brand spinner takes the logo's place.
      expect(display(button, "logo")).toBe("none");
    });

    it.each([
      ["null", null],
      ["false", false],
    ] as const)(
      "renders no indicator and hides nothing when pendingIndicator is %s, while the state stays",
      (_label, value) => {
        renderThemed(
          <Button isPending pendingIndicator={value}>
            <svg data-testid="logo" data-icon="inline-start" aria-hidden viewBox="0 0 1 1" />
            Continue
          </Button>
        );
        const button = roleNamed("button", "Continue");
        expect(indicatorSlot(button)).toBeNull();
        expect(button.hasAttribute("data-pending-indicator")).toBe(false);
        expect(display(button, "logo")).not.toBe("none");
        // The accessibility half is untouched by the opt-out.
        expect(button.getAttribute("aria-busy")).toBe("true");
        expect(button.getAttribute("aria-disabled")).toBe("true");
        expect(button.hasAttribute("data-pending")).toBe(true);
        expect(button.hasAttribute("disabled")).toBe(false);
      }
    );
  });

  it("keeps a focusable disabled button hoverable, so a tooltip on it still opens", async () => {
    renderThemed(
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button disabled focusableWhenDisabled />}>Why</Tooltip.Trigger>
          <Tooltip.Content>Needs a signed contract</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );
    const button = roleNamed("button", "Why");

    // Base UI keeps a focusable disabled button out of `:disabled` and marks it with
    // `data-disabled`, so the dim follows that attribute while pointer events stay on.
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(effectiveOpacity(button)).toBe(0.5);
    expect(getComputedStyle(button).pointerEvents).toBe("auto");

    await userEvent.hover(button);
    await vi.waitFor(() => {
      expect(page.getByRole("tooltip", { name: "Needs a signed contract" }).query()).not.toBeNull();
    });
  });

  it("changes an enabled button's paint on hover and moves it down 1px on press, for every variant", async () => {
    renderThemed(
      <>
        <p>Away</p>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} className="transition-none">
            {`Enabled ${variant}`}
          </Button>
        ))}
      </>
    );

    for (const variant of VARIANTS) {
      const name = `Enabled ${variant}`;
      const button = roleNamed("button", name);
      await userEvent.hover(page.getByText("Away"));
      const resting = pointerPaint(button);

      await userEvent.hover(page.getByRole("button", { name }));
      expect(pointerPaint(button), `${variant} while hovered`).not.toEqual(resting);
      const pressed = await whilePointerPressed(() => getComputedStyle(button).translate);
      expect(pressed, `${variant} while pressed`).toBe("0px 1px");
    }
  });

  it("shows the pointer cursor on an enabled button and not-allowed on every disabled form", () => {
    renderThemed(
      <>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {`Enabled ${variant}`}
          </Button>
        ))}
        <Button nativeButton={false} render={<a href="#go" />}>
          Anchor
        </Button>
        <Button disabled>Disabled</Button>
        <Button disabled focusableWhenDisabled>
          Focusable disabled
        </Button>
        <Button isPending>Pending</Button>
        <Button isVisuallyDisabled>Visually disabled</Button>
        <Button nativeButton={false} render={<a href="#go" />} disabled>
          Disabled anchor
        </Button>
      </>
    );

    for (const variant of VARIANTS) {
      expect(getComputedStyle(roleNamed("button", `Enabled ${variant}`)).cursor, variant).toBe("pointer");
    }
    expect(getComputedStyle(roleNamed("button", "Anchor")).cursor).toBe("pointer");
    for (const name of [
      "Disabled",
      "Focusable disabled",
      "Pending",
      "Visually disabled",
      "Disabled anchor",
    ]) {
      expect(getComputedStyle(roleNamed("button", name)).cursor, name).toBe("not-allowed");
    }
  });

  it("lets a consumer hover class replace the recipe hover", async () => {
    renderThemed(<Button className="transition-none hover:bg-muted">Custom hover</Button>);
    const button = roleNamed("button", "Custom hover");

    await userEvent.hover(page.getByRole("button", { name: "Custom hover" }));
    expect(getComputedStyle(button).backgroundColor).toBe(cssVarColor(button, "--muted"));
  });

  it("paints a hovered secondary button with the secondary-hover role", async () => {
    renderThemed(
      <Button variant="secondary" className="transition-none">
        Secondary
      </Button>
    );
    const button = roleNamed("button", "Secondary");
    expect(getComputedStyle(button).backgroundColor).toBe(cssVarColor(button, "--secondary"));

    await userEvent.hover(button);
    expect(getComputedStyle(button).backgroundColor).toBe(cssVarColor(button, "--secondary-hover"));
    // Internal secondary moves 5% toward foreground, so the hover is visibly a different fill.
    expect(cssVarColor(button, "--secondary-hover")).not.toBe(cssVarColor(button, "--secondary"));
  });

  it("mixes the secondary hover from a host override of --secondary on a theme scope", async () => {
    render(
      <ThemeScope theme={fkasPrivate} style={{ "--secondary": "oklch(0.6 0.2 30)" }}>
        <Button variant="secondary" className="transition-none">
          Custom
        </Button>
      </ThemeScope>
    );
    const button = roleNamed("button", "Custom");
    await userEvent.hover(button);

    // The expected values mix the override 5% of the way toward the internal light
    // foreground, oklch(0.15 0.0041 49.31). L 0.6 * 0.95 + 0.15 * 0.05 = 0.5775.
    // C 0.2 * 0.95 + 0.0041 * 0.05 = 0.190205. H 30 + (49.31 - 30) * 0.05 = 30.9655.
    // The theme's own hover would be a near-white gray.
    const hovered = computedOklch(getComputedStyle(button).backgroundColor);
    expect(hovered.l).toBeCloseTo(0.5775, 4);
    expect(hovered.c).toBeCloseTo(0.190205, 4);
    expect(hovered.h).toBeCloseTo(30.9655, 2);
  });

  it("stays activatable when visually disabled and suppresses mousedown focus", async () => {
    const onClick = vi.fn();
    const onMouseDown = vi.fn();
    renderThemed(
      <>
        <button type="button">Other</button>
        <Button isVisuallyDisabled onClick={onClick} onMouseDown={onMouseDown}>
          Looks off
        </Button>
      </>
    );

    const other = page.getByRole("button", { name: "Other" }).element();
    const button = roleNamed("button", "Looks off");

    // `aria-disabled` reads as disabled to assistive tech (and to Playwright's enabled
    // check) while the native `disabled` attribute stays off, so the button still works.
    await expect
      .element(page.getByRole("button", { name: "Looks off" }))
      .toHaveAttribute("aria-disabled", "true");
    expect(getComputedStyle(button).opacity).toBe("0.5");
    expect(button.hasAttribute("disabled")).toBe(false);

    other.focus();
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(other);
    expect(onMouseDown).toHaveBeenCalledTimes(1);

    // Playwright's actionability check reads `aria-disabled` as disabled, like assistive
    // tech does; the native click still works, so the test forces through the check.
    await userEvent.click(page.getByRole("button", { name: "Looks off" }), { force: true });
    expect(onClick).toHaveBeenCalledTimes(1);

    button.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  // WAI-ARIA: an element that is not natively disabled announces unavailability through
  // aria-disabled. An explicit consumer value still wins, as the isVisuallyDisabled JSDoc
  // promises, while a wrapper that forwards `aria-disabled={undefined}` must not erase
  // Base UI's value.
  it.each([
    [
      "isVisuallyDisabled",
      <Button key="1" isVisuallyDisabled>
        Probe
      </Button>,
      "true",
    ],
    [
      "isVisuallyDisabled with an explicit false",
      <Button key="2" isVisuallyDisabled aria-disabled="false">
        Probe
      </Button>,
      "false",
    ],
    [
      "a plain aria-disabled",
      <Button key="3" aria-disabled="true">
        Probe
      </Button>,
      "true",
    ],
    [
      "focusable disabled",
      <Button key="4" disabled focusableWhenDisabled>
        Probe
      </Button>,
      "true",
    ],
    [
      "focusable pending",
      <Button key="5" isPending focusableWhenDisabled>
        Probe
      </Button>,
      "true",
    ],
    [
      "non-native disabled",
      <Button key="6" render={<a href="/docs" />} nativeButton={false} disabled>
        Probe
      </Button>,
      "true",
    ],
    [
      "focusable disabled with an explicit false",
      <Button key="7" disabled focusableWhenDisabled aria-disabled="false">
        Probe
      </Button>,
      "false",
    ],
    [
      "focusable disabled forwarded as undefined",
      <Button key="8" disabled focusableWhenDisabled aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
    [
      "focusable pending forwarded as undefined",
      <Button key="9" isPending focusableWhenDisabled aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
    [
      "non-native disabled forwarded as undefined",
      <Button key="10" render={<a href="/docs" />} nativeButton={false} disabled aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
  ] as const)("resolves aria-disabled for a %s button", (_label, button, expected) => {
    renderThemed(button);
    expect(roleNamed("button", "Probe").getAttribute("aria-disabled")).toBe(expected);
  });

  it("dims a non-native disabled button through the disabled state attribute", () => {
    renderThemed(
      <>
        <Button render={<a href="/docs" />} nativeButton={false} disabled>
          Anchor
        </Button>
        <Button>Enabled</Button>
      </>
    );

    // A rendered <a> never matches `:disabled`; Base UI marks it with the disabled state
    // attribute instead, and the dim must follow that attribute.
    expect(effectiveOpacity(roleNamed("button", "Anchor"))).toBe(0.5);
    expect(effectiveOpacity(roleNamed("button", "Enabled"))).toBe(1);
  });

  it("forwards a predicted path to onIntent only while live: not disabled, pending, or visually disabled", () => {
    const live = vi.fn();
    const disabled = vi.fn();
    const pending = vi.fn();
    const visual = vi.fn();

    renderThemed(
      <>
        <Button onIntent={live}>Prefetch</Button>
        <Button disabled onIntent={disabled}>
          Disabled prefetch
        </Button>
        <Button isPending onIntent={pending}>
          Pending prefetch
        </Button>
        <Button isVisuallyDisabled onIntent={visual}>
          Visual prefetch
        </Button>
      </>
    );

    const liveButton = roleNamed("button", "Prefetch");
    const rect = liveButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    dispatchPredictedPointer(x, y);
    expect(live).toHaveBeenCalledTimes(1);

    for (const name of ["Disabled prefetch", "Pending prefetch", "Visual prefetch"]) {
      const blocked = roleNamed("button", name).getBoundingClientRect();
      dispatchPredictedPointer(blocked.left + blocked.width / 2, blocked.top + blocked.height / 2);
    }
    expect(disabled).not.toHaveBeenCalled();
    expect(pending).not.toHaveBeenCalled();
    expect(visual).not.toHaveBeenCalled();
  });

  it("merges an external ref when onIntent is set and shares one pointermove listener", () => {
    const firstRef = createRef<HTMLButtonElement>();
    const secondRef = createRef<HTMLButtonElement>();
    const add = vi.spyOn(document, "addEventListener");

    renderThemed(
      <>
        <Button ref={firstRef} onIntent={() => undefined}>
          First
        </Button>
        <Button ref={secondRef} onIntent={() => undefined}>
          Second
        </Button>
      </>
    );

    expect(firstRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(secondRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(firstRef.current).toBe(roleNamed("button", "First"));
    expect(add.mock.calls.filter((call) => call[0] === "pointermove")).toHaveLength(1);
    add.mockRestore();
  });

  it("clears a callback ref on unmount", () => {
    let trigger: HTMLElement | null = null;
    const { unmount } = renderThemed(
      <Button
        ref={(element) => {
          trigger = element;
        }}>
        Trigger
      </Button>
    );

    expect(trigger).toBe(roleNamed("button", "Trigger"));
    unmount();
    expect(trigger).toBeNull();
  });

  it("draws the internal outline as a 1px border hairline with the xs shadow", () => {
    renderThemed(<Button variant="outline">Hairline</Button>);
    const button = roleNamed("button", "Hairline");
    const style = getComputedStyle(button);

    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      expect(style[`border${side}Width`], side).toBe("1px");
    }
    expect(style.borderTopColor).toBe(cssVarColor(button, "--border"));
    // Tailwind's shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05).
    expect(ownShadow(button).css).toBe("rgba(0, 0, 0, 0.05) 0px 1px 2px 0px");
  });

  it.each(["light", "dark"] as const)(
    "rings the external %s outline 2px in the text color and casts no shadow",
    (colorScheme) => {
      render(
        <div data-theme={colorScheme}>
          <ThemeScope theme={fkasExternal}>
            <Button variant="outline">Ring</Button>
          </ThemeScope>
        </div>
      );
      const button = roleNamed("button", "Ring");
      const style = getComputedStyle(button);

      for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
        expect(style[`border${side}Width`], side).toBe("2px");
      }
      expect(style.borderTopColor).toBe(cssVarColor(button, "--foreground"));
      expect(style.borderTopColor).not.toBe(cssVarColor(button, "--border"));
      const shadow = ownShadow(button);
      expect(paintsOutsideBorderBox(shadow), shadow.css).toBe(false);
    }
  );

  it.each(["card", "popover"] as const)(
    "lifts a hovered external dark ghost button off a %s, which its muted hover tint must not repeat",
    async (surface) => {
      render(
        <div data-theme="dark">
          <ThemeScope theme={fkasExternal}>
            <div data-testid="surface" style={{ background: `var(--${surface})`, padding: 8 }}>
              <Button variant="ghost" className="transition-none">
                Close
              </Button>
            </div>
          </ThemeScope>
        </div>
      );
      const surfaceColor = computedOklch(
        getComputedStyle(page.getByTestId("surface").element()).backgroundColor
      );
      const button = roleNamed("button", "Close");

      await userEvent.hover(button);
      // `computedOklch` throws on a translucent color, so a hover that leaves the ghost
      // transparent, showing the surface through it, fails here too.
      await vi.waitFor(() => {
        expect(computedOklch(getComputedStyle(button).backgroundColor).l).toBeGreaterThan(surfaceColor.l);
      });
    }
  );

  it("lets a consumer shadow class replace the outline shadow", () => {
    renderThemed(
      <Button variant="outline" className="shadow-none">
        Flat
      </Button>
    );
    const shadow = ownShadow(roleNamed("button", "Flat"));
    expect(paintsOutsideBorderBox(shadow), shadow.css).toBe(false);
  });

  it("renders variant and size recipe classes and keeps role when render swaps the tag", () => {
    renderThemed(
      <>
        <Button variant="outline" size="lg">
          Outline
        </Button>
        <Button nativeButton={false} render={<a href="#go" />}>
          Open
        </Button>
      </>
    );

    const outlineButton = roleNamed("button", "Outline");
    expect(getComputedStyle(outlineButton).borderTopWidth).not.toBe("0px");
    expect(Number.parseFloat(getComputedStyle(outlineButton).height)).toBeGreaterThan(36);

    const link = roleNamed("button", "Open");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#go");
  });
});
