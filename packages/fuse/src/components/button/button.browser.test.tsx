import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { whilePointerPressed } from "../../../test/pointer-press";
import { dispatchPredictedPointer } from "../../../test/predicted-pointer";
import {
  cssVarColor,
  effectiveOpacity,
  fkasPrivate,
  computedOklch,
  renderThemed,
  roleNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Tooltip } from "../tooltip/tooltip";
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
    await expect.element(page.getByRole("button", { name: "Saving" })).toBeDisabled();
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

  it("dims a disabled button to half opacity when it renders a native button or another element", () => {
    renderThemed(
      <>
        <Button disabled>Native</Button>
        <Button render={<a href="/docs" />} nativeButton={false} disabled>
          Anchor
        </Button>
        <Button>Enabled</Button>
      </>
    );

    // A rendered <a> never matches `:disabled`; Base UI marks it with the disabled state
    // attribute instead, and the dim must follow that attribute.
    expect(effectiveOpacity(roleNamed("button", "Native"))).toBe(0.5);
    expect(effectiveOpacity(roleNamed("button", "Anchor"))).toBe(0.5);
    expect(effectiveOpacity(roleNamed("button", "Enabled"))).toBe(1);
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

  it("keeps a focusable disabled button's paint and position still under hover and press, for every variant", async () => {
    renderThemed(
      <>
        <p>Away</p>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled focusableWhenDisabled className="transition-none">
            {`Disabled ${variant}`}
          </Button>
        ))}
      </>
    );

    for (const variant of VARIANTS) {
      const name = `Disabled ${variant}`;
      const button = roleNamed("button", name);
      await userEvent.hover(page.getByText("Away"));
      const resting = pointerPaint(button);

      await userEvent.hover(page.getByRole("button", { name }));
      expect(pointerPaint(button), `${variant} while hovered`).toEqual(resting);
      const pressed = await whilePointerPressed(() => pointerPaint(button));
      expect(pressed, `${variant} while pressed`).toEqual(resting);
    }
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

  it("stamps aria-disabled for isVisuallyDisabled and lets an explicit value win", () => {
    renderThemed(
      <>
        <Button isVisuallyDisabled>Visual</Button>
        <Button isVisuallyDisabled aria-disabled="false">
          Explicit
        </Button>
        <Button aria-disabled="true">Plain</Button>
      </>
    );

    expect(roleNamed("button", "Visual").getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("button", "Explicit").getAttribute("aria-disabled")).toBe("false");
    expect(roleNamed("button", "Plain").getAttribute("aria-disabled")).toBe("true");
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
