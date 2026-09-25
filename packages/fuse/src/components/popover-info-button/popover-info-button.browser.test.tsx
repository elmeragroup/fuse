import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PopoverInfoButton } from "@elmeragroup/fuse/popover-info-button";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { px, renderThemed, roleNamed } from "../../../test/themed-browser-render";

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
  it("names the trigger from the en-US dictionary default and lets label override it", () => {
    const { rerender } = renderInfo(<PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>);

    expect(roleNamed("button", "More information")).toBeTruthy();
    expect(page.getByRole("button").elements()).toHaveLength(1);

    rerender(withLocale("en-US", <PopoverInfoButton label="About grid rent">{EXPLAINER}</PopoverInfoButton>));
    expect(roleNamed("button", "About grid rent")).toBeTruthy();
    expect(page.getByRole("button", { name: "More information", exact: true }).query()).toBeNull();
  });

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

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    renderInfo(
      <div style={{ padding: 240 }}>
        <PopoverInfoButton>{EXPLAINER}</PopoverInfoButton>
      </div>
    );
    const dialog = await openInfo();
    const scope = dialog.closest("[data-theme-brand]");
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

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

  it("waits while the resolved container element is still null", async () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return <PopoverInfoButton container={ref}>Pending</PopoverInfoButton>;
    }
    renderInfo(<NeverAttached />);

    await userEvent.click(roleNamed("button", "More information"));
    expect(page.getByRole("dialog").query()).toBeNull();
    expect([...document.body.children].some((child) => child.getAttribute("role") === "dialog")).toBe(false);
  });
});
