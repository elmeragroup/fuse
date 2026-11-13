import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { dispatchPredictedPointer } from "../../../test/predicted-pointer";
import {
  effectiveOpacity,
  fkasBranded,
  fkasPrivate,
  renderThemed,
  roleNamed,
  snapshotDocumentTheme,
  stampDocumentTheme,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Tooltip } from "../tooltip";
import { Button } from "./button";

/** A host's outline Button width, unlike the theme's 1px hairline and 2px branded ring. */
const HOST_OUTLINE_WIDTH = "3px";

describe("Button", () => {
  // Each button meets a click, Enter and Space. Disabled and pending block all three; a visually
  // disabled button looks off but stays fully activatable, as its JSDoc promises.
  it.each([
    ["an enabled", {}, 3],
    ["a disabled", { disabled: true }, 0],
    ["a pending", { isPending: true }, 0],
    ["a visually disabled", { isVisuallyDisabled: true }, 3],
  ] as const)("activates %s button on click, Enter and Space %i times", async (_label, props, expected) => {
    const onClick = vi.fn();
    renderThemed(
      <Button {...props} onClick={onClick}>
        Save
      </Button>
    );
    const button = roleNamed("button", "Save");
    // The native click skips Playwright's actionability check, which reads aria-disabled as disabled.
    button.click();
    button.focus();
    await userEvent.keyboard("{Enter}");
    button.focus();
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(expected);
  });

  it("keeps focus where it was on mousedown over a visually disabled button", () => {
    const onMouseDown = vi.fn();
    renderThemed(
      <>
        <button type="button">Other</button>
        <Button isVisuallyDisabled onMouseDown={onMouseDown}>
          Looks off
        </Button>
      </>
    );
    const other = roleNamed("button", "Other");
    other.focus();
    roleNamed("button", "Looks off").dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, cancelable: true })
    );
    expect(document.activeElement).toBe(other);
    expect(onMouseDown).toHaveBeenCalledTimes(1);
  });

  // An element that is not natively disabled announces unavailability through aria-disabled. An
  // explicit consumer value wins; a wrapper forwarding `aria-disabled={undefined}` must not erase it.
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
      "focusable disabled forwarded as undefined",
      <Button key="3" disabled focusableWhenDisabled aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
    [
      "focusable pending forwarded as undefined",
      <Button key="4" isPending aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
    [
      "non-native disabled forwarded as undefined",
      <Button key="5" render={<a href="/docs" />} nativeButton={false} disabled aria-disabled={undefined}>
        Probe
      </Button>,
      "true",
    ],
  ] as const)("resolves aria-disabled for a %s button", (_label, button, expected) => {
    renderThemed(button);
    expect(roleNamed("button", "Probe").getAttribute("aria-disabled")).toBe(expected);
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

    // Chrome's page translation swaps each text node for `<font>` wrappers that React does not
    // know about. Inserting the indicator before the old text node threw `NotFoundError`.
    it("shows the indicator at the leading edge of a label that page translation replaced", () => {
      function Fixture({ pending }: { pending: boolean }) {
        return <Button isPending={pending}>Save</Button>;
      }
      const { rerender } = renderThemed(<Fixture pending={false} />);
      const button = roleNamed("button", "Save");
      const translated = document.createElement("font");
      translated.innerHTML = "<font>Lagre</font>";
      button.replaceChildren(translated);

      rerender(<Fixture pending />);

      expect(button.isConnected).toBe(true);
      const indicator = button.querySelector('[data-slot="button-pending-indicator"]');
      expect(indicator).not.toBeNull();
      expect(indicator?.getBoundingClientRect().right).toBeLessThanOrEqual(
        translated.getBoundingClientRect().left
      );
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

  // Unit under test: the themes.css rules on a branded theme element in both schemes. Oracle: the
  // host's own width, set by a rule that ties the light theme rule and follows themes.css, as the
  // theming handbook tells a host to override a theme role. A dark rule that restated the
  // light-only role would outweigh it, and the border would flip back to the theme's 2px ring.
  it.each(["light", "dark"] as const)(
    "keeps a host --button-outline-width override on the theme element in %s",
    (scheme) => {
      const restoreDocumentTheme = snapshotDocumentTheme();
      stampDocumentTheme(fkasPrivate, scheme);
      const style = document.createElement("style");
      style.textContent = `.host-outline[data-theme-brand="fkas"] { --button-outline-width: ${HOST_OUTLINE_WIDTH}; }`;
      document.head.append(style);
      try {
        render(
          <ThemeScope theme={fkasBranded} className="host-outline">
            <Button variant="outline">Outlined</Button>
          </ThemeScope>
        );
        expect(getComputedStyle(roleNamed("button", "Outlined")).borderTopWidth).toBe(HOST_OUTLINE_WIDTH);
      } finally {
        style.remove();
        restoreDocumentTheme();
      }
    }
  );
});
