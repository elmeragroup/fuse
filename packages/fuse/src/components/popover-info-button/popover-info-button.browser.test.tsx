import type { ReactNode } from "react";
import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Popover } from "@elmeragroup/fuse/popover";
import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { LABEL, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Field } from "../field";

const MORE_INFORMATION_COPY = {
  "nb-NO": "Mer informasjon",
  "sv-SE": "Mer information",
  "en-US": "More information",
  "fi-FI": "Lisätietoja",
} as const;

const EXPLAINER = "Grid rent is the fee for using the electricity grid.";

function renderInfo(node: ReactNode, locale: (typeof SUPPORTED_LOCALES)[number] = "en-US") {
  return renderThemed(withLocale(locale, node));
}

/** Base UI mounts the popup a frame or more after the opening event, so wait for it. */
async function mountedInfo(): Promise<HTMLElement> {
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  const dialog = page.getByRole("dialog").element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  return dialog;
}

async function openInfo(name = "More information"): Promise<HTMLElement> {
  await userEvent.click(roleNamed("button", name));
  return mountedInfo();
}

/** Opens the popup and finishes its entry animation, whose scale would skew every measured box. */
async function openSettled(name = "More information"): Promise<HTMLElement> {
  const dialog = await openInfo(name);
  for (const animation of dialog.getAnimations()) {
    animation.finish();
  }
  return dialog;
}

describe("PopoverInfoButton", () => {
  // Oracle: the dictionary copy above, written out per locale. The same name labels the trigger
  // and the dialog it opens, because a plain body carries no `Popover.Title`.
  it("names the trigger and the dialog with the dictionary default in all four locales", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const name = MORE_INFORMATION_COPY[locale];
      const { unmount } = renderInfo(<PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>, locale);
      expect(page.getByRole("button", { name, exact: true }).query(), locale).not.toBeNull();

      await openInfo(name);
      expect(page.getByRole("dialog", { name, exact: true }).query(), locale).not.toBeNull();
      unmount();
    }
  });

  it("names the trigger and the dialog with an explicit label", async () => {
    renderInfo(<PopoverInfoButton label="About grid rent">{EXPLAINER}</PopoverInfoButton>, "nb-NO");
    expect(page.getByRole("button", { name: "About grid rent", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Mer informasjon", exact: true }).query()).toBeNull();

    await openInfo("About grid rent");
    expect(page.getByRole("dialog", { name: "About grid rent", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("dialog", { name: "Mer informasjon", exact: true }).query()).toBeNull();
  });

  // Oracle: the Title text. `aria-labelledby` outranks `aria-label` in the accessible-name
  // computation, so a mounted Title names the dialog while the label still names the trigger.
  it("lets a Popover.Title name the dialog over the label", async () => {
    renderInfo(
      <PopoverInfoButton label="About grid rent">
        <Popover.Header>
          <Popover.Title>What is grid rent?</Popover.Title>
          <Popover.Description>{EXPLAINER}</Popover.Description>
        </Popover.Header>
      </PopoverInfoButton>
    );
    await openInfo("About grid rent");
    expect(page.getByRole("dialog", { name: "What is grid rent?", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("dialog", { name: "About grid rent", exact: true }).query()).toBeNull();
  });

  it("opens from click and Enter, toggles aria-expanded, and closes on Escape with focus return", async () => {
    renderInfo(
      <div style={{ padding: 240 }}>
        <PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>
      </div>
    );
    const trigger = roleNamed("button", "More information");
    expect(trigger.getAttribute("aria-expanded")).not.toBe("true");
    expect(trigger.querySelectorAll("button")).toHaveLength(0);
    expect(page.getByRole("button").elements()).toHaveLength(1);
    expect(trigger.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    const dialog = await openInfo();
    expect(dialog.textContent).toContain(EXPLAINER);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    await expect.element(page.getByRole("button", { name: "More information", exact: true })).toHaveFocus();
    expect(trigger.getAttribute("aria-expanded")).not.toBe("true");

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect((await mountedInfo()).textContent).toContain(EXPLAINER);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  // Oracle: the WAI-ARIA disclosure contract. An open popup's trigger reads aria-expanded="true",
  // whatever undefined value the consumer forwards for the key.
  it("keeps the trigger's aria-expanded when the consumer forwards it as undefined", async () => {
    renderInfo(
      <div style={{ padding: 240 }}>
        <PopoverInfoButton aria-expanded={undefined}>{EXPLAINER}</PopoverInfoButton>
      </div>
    );
    const trigger = roleNamed("button", "More information");
    await openInfo();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  // Oracle: Button's documented state, where `isPending` makes the button disabled. A style
  // callback sees that state, not Popover.Trigger's, whose `disabled` stays false while pending.
  it("evaluates a style callback against the pending Button's disabled state", () => {
    renderInfo(
      <PopoverInfoButton isPending style={(state) => ({ outlineColor: state.disabled ? "red" : "blue" })}>
        {EXPLAINER}
      </PopoverInfoButton>
    );
    expect(roleNamed("button", "More information").style.outlineColor).toBe("red");
  });

  // Oracle: the consumer's own `disabled` prop. Popover.Trigger states a non-native disabled
  // trigger through `aria-disabled` alone, so the Button must still read `disabled` itself.
  it("evaluates a style callback against a disabled non-native trigger's disabled state", () => {
    renderInfo(
      <PopoverInfoButton
        disabled
        nativeButton={false}
        render={<span />}
        style={(state) => ({ outlineColor: state.disabled ? "red" : "blue" })}>
        {EXPLAINER}
      </PopoverInfoButton>
    );
    expect(roleNamed("button", "More information").style.outlineColor).toBe("red");
  });

  // Oracle: Base UI's `focusableWhenDisabled` contract, under which a disabled button stays in
  // the Tab order. Popover.Trigger has no such prop, so its own disabled tabindex must not win.
  it.each([
    {
      kind: "a non-native",
      trigger: (
        <PopoverInfoButton disabled focusableWhenDisabled nativeButton={false} render={<span />}>
          {EXPLAINER}
        </PopoverInfoButton>
      ),
    },
    {
      kind: "a native",
      trigger: (
        <PopoverInfoButton disabled focusableWhenDisabled>
          {EXPLAINER}
        </PopoverInfoButton>
      ),
    },
  ])("keeps $kind disabled, focusableWhenDisabled trigger in the Tab order", async ({ trigger }) => {
    renderInfo(
      <>
        <button type="button">Before</button>
        {trigger}
      </>
    );
    const button = roleNamed("button", "More information");
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  // Oracle: the label type pair from the density metrics, `LABEL[density].leading`. The
  // trigger sits on the label's line, so the label stays one line tall and the glyph centres
  // on that line, at both densities.
  it.each(DENSITIES)("sits on a Field.Label's line without growing it at %s", (density) => {
    stampDensity(density);
    renderInfo(
      <Field.Root>
        <Field.Label>
          Grid rent
          <PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>
        </Field.Label>
      </Field.Root>
    );
    const line = LABEL[density].leading;
    const trigger = roleNamed("button", "More information");
    const label = trigger.closest("label");
    const glyph = trigger.querySelector("svg");
    if (label === null || glyph === null) {
      throw new Error("expected the trigger and its glyph inside the label");
    }
    const labelBox = label.getBoundingClientRect();
    const triggerBox = trigger.getBoundingClientRect();
    const glyphBox = glyph.getBoundingClientRect();

    expect(labelBox.height, "label height").toBe(line);
    expect(triggerBox.height, "trigger height").toBe(line);
    expect(triggerBox.width, "trigger width").toBe(line);
    expect(glyphBox.top + glyphBox.height / 2 - labelBox.top, "glyph centre").toBeCloseTo(line / 2, 3);
  });

  // Oracle: the trigger the popup opens beside. The arrow stays the popup's last child, after the
  // body, and points at the trigger's centre along the side the popup took. A narrow test viewport
  // can flip the popup below the trigger, so the axis follows `data-side`.
  it("keeps the arrow after the body, pointing at the trigger", async () => {
    renderInfo(
      <div style={{ padding: 240 }}>
        <PopoverInfoButton>
          <p>Grid rent is set by the network operator.</p>
          <p>It is billed with your consumption.</p>
        </PopoverInfoButton>
      </div>
    );
    const dialog = await openSettled();
    const trigger = roleNamed("button", "More information").getBoundingClientRect();
    // Base UI's arrow has no role or name; it is the popup's last element child.
    const arrow = dialog.lastElementChild;
    if (arrow === null) {
      throw new Error("expected the arrow");
    }
    expect(arrow.textContent, "arrow holds no body text").toBe("");
    const arrowBox = arrow.getBoundingClientRect();
    const side = dialog.getAttribute("data-side");
    const [arrowCentre, triggerCentre] =
      side === "left" || side === "right"
        ? [arrowBox.top + arrowBox.height / 2, trigger.top + trigger.height / 2]
        : [arrowBox.left + arrowBox.width / 2, trigger.left + trigger.width / 2];
    // Floating UI rounds the arrow's offset to whole pixels.
    expect(
      Math.abs(arrowCentre - triggerCentre),
      `arrow centre on the ${String(side)} side`
    ).toBeLessThanOrEqual(1);
  });
});

describe("PopoverInfoButton", () => {
  it("portals into an explicit container element", async () => {
    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? <PopoverInfoButton container={node}>{EXPLAINER}</PopoverInfoButton> : null}
        </>
      );
    }
    renderInfo(
      <div style={{ padding: 240 }}>
        <ExplicitContainer />
      </div>
    );
    const dialog = await openInfo();
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });
});
