import { useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { LABEL, px, renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
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

describe("PopoverInfoButton", () => {
  it("renders the dictionary default in all four locales and honors an explicit label", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderInfo(<PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>, locale);
      expect(
        page.getByRole("button", { name: MORE_INFORMATION_COPY[locale], exact: true }).query()
      ).not.toBeNull();
      unmount();
    }

    renderInfo(<PopoverInfoButton label="About grid rent">{EXPLAINER}</PopoverInfoButton>, "nb-NO");
    expect(page.getByRole("button", { name: "About grid rent", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Mer informasjon", exact: true }).query()).toBeNull();
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

  it("maps contentSize onto the content max-width class and forwards Button props to the trigger", async () => {
    const { rerender } = renderInfo(
      <div style={{ padding: 240 }}>
        <PopoverInfoButton contentSize="sm">{EXPLAINER}</PopoverInfoButton>
      </div>
    );
    const trigger = roleNamed("button", "More information");
    expect(px(getComputedStyle(trigger).width)).toBe(px(getComputedStyle(trigger).height));

    let dialog = await openInfo();
    const smMaxWidth = px(getComputedStyle(dialog).maxWidth);
    expect(smMaxWidth).toBeGreaterThan(0);
    expect(px(getComputedStyle(dialog).paddingTop)).toBeGreaterThan(0);

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });

    rerender(
      withLocale(
        "en-US",
        <div style={{ padding: 240 }}>
          <PopoverInfoButton contentSize="2xl" variant="outline" disabled>
            {EXPLAINER}
          </PopoverInfoButton>
        </div>
      )
    );
    const outlined = roleNamed("button", "More information");
    await expect.poll(() => getComputedStyle(outlined).borderTopColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(outlined).toHaveProperty("disabled", true);

    rerender(
      withLocale(
        "en-US",
        <div style={{ padding: 240 }}>
          <PopoverInfoButton contentSize="2xl">{EXPLAINER}</PopoverInfoButton>
        </div>
      )
    );
    dialog = await openInfo();
    expect(px(getComputedStyle(dialog).maxWidth)).toBeGreaterThan(smMaxWidth);
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

  // Oracle: the 48px line the heading writes. In an inline formatting context the square fills
  // that line box instead of sitting on the baseline and growing it.
  it("keeps a block heading's line box at its line height", () => {
    renderInfo(
      <h2 style={{ fontFamily: "Arial", fontSize: 48, lineHeight: "48px", margin: 0 }}>
        Grid rent <PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>
      </h2>
    );
    const trigger = roleNamed("button", "More information");
    const heading = trigger.closest("h2");
    if (heading === null) {
      throw new Error("expected the trigger inside the heading");
    }
    const headingBox = heading.getBoundingClientRect();
    const triggerBox = trigger.getBoundingClientRect();

    expect(headingBox.height, "heading height").toBe(48);
    expect(triggerBox.top - headingBox.top, "trigger top").toBe(0);
    expect(triggerBox.height, "trigger height").toBe(48);
  });

  // Oracle: the same heading without the trigger. Under `line-height: normal` the line takes its
  // height from the font, so a square sized from another family's or weight's metrics would grow
  // the line. The fallback fonts differ by platform, so the line is measured, not written down.
  it.each([
    { name: "a bold Palatino", font: { fontFamily: "Palatino, Georgia, serif" } },
    {
      name: "a weight-400 Helvetica Neue",
      font: { fontFamily: "'Helvetica Neue', sans-serif", fontWeight: 400 },
    },
  ] as const)(
    "keeps $name `line-height: normal` heading at the height it has without the trigger",
    ({ font }) => {
      const heading = { ...font, fontSize: 48, lineHeight: "normal", margin: 0 };
      renderInfo(
        <>
          <h2 style={heading}>Grid rent</h2>
          <h2 style={heading}>
            Grid rent <PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>
          </h2>
        </>
      );
      const trigger = roleNamed("button", "More information");
      const [bare, withTrigger] = page
        .getByRole("heading", { level: 2 })
        .elements()
        .map((element) => element.getBoundingClientRect());
      if (bare === undefined || withTrigger === undefined) {
        throw new Error("expected both headings");
      }
      const triggerBox = trigger.getBoundingClientRect();

      expect(withTrigger.height, "heading height").toBe(bare.height);
      expect(triggerBox.top - withTrigger.top, "trigger top").toBe(0);
      expect(triggerBox.height, "trigger height").toBe(bare.height);
    }
  );

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
