import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { headingNamed, renderThemed } from "../../../test/themed-browser-render";
import { Alert } from "./alert";

const VARIANTS = ["default", "destructive", "warning", "success"] as const;

const ICON_PATH = {
  default: "M112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z",
  warning: "M236.8,188.09",
  destructive: "M232,91.55v72.9",
  success: "M173.66,98.34",
} as const;

function alertNamed(name: string): HTMLElement {
  const element = page.getByRole("alert").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected alert ${name}`);
  }
  return element;
}

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected button ${name}`);
  }
  return element;
}

function iconIn(root: HTMLElement): SVGSVGElement {
  // spec §9 slot audit: variant icons are asserted via the alert-icon data-slot hook.
  const icon = root.querySelector('[data-slot="alert-icon"]');
  if (!(icon instanceof SVGSVGElement)) {
    throw new Error("expected alert-icon");
  }
  return icon;
}

describe("Alert", () => {
  it("finds Root by alert role for every variant and keeps children inside it", () => {
    for (const variant of VARIANTS) {
      const { unmount } = renderThemed(
        <Alert.Root variant={variant}>
          <Alert.Title>{variant} title</Alert.Title>
          <Alert.Description>{variant} body</Alert.Description>
        </Alert.Root>
      );
      const root = alertNamed(variant);
      expect(root.getAttribute("data-slot")).toBe("item");
      expect(root.getAttribute("data-variant")).toBe("outline");
      expect(root.getAttribute("data-size")).toBe("sm");
      expect(root.contains(headingNamed(`${variant} title`, 3))).toBe(true);
      expect(root.textContent).toContain(`${variant} body`);
      unmount();
    }
  });

  it("renders the mapped Phosphor glyph for each variant, hidden from AT", () => {
    for (const variant of VARIANTS) {
      const { unmount } = renderThemed(
        <Alert.Root variant={variant}>
          <Alert.Title>{variant}</Alert.Title>
        </Alert.Root>
      );
      const icon = iconIn(alertNamed(variant));
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("data-slot")).toBe("alert-icon");
      expect(icon.innerHTML).toContain(ICON_PATH[variant]);
      unmount();
    }
  });

  it("finds Title as a level-3 heading and renders level 2 as h2", () => {
    const { unmount } = renderThemed(
      <Alert.Root>
        <Alert.Title>Sync delayed</Alert.Title>
      </Alert.Root>
    );
    const title = headingNamed("Sync delayed", 3);
    expect(title.tagName).toBe("H3");
    expect(title.getAttribute("data-slot")).toBe("item-title");
    expect(title.getAttribute("variant")).toBeNull();
    unmount();

    renderThemed(
      <Alert.Root>
        <Alert.Title level={2}>Facility status</Alert.Title>
      </Alert.Root>
    );
    const h2 = headingNamed("Facility status", 2);
    expect(h2.tagName).toBe("H2");
    expect(h2.getAttribute("data-slot")).toBe("item-title");
  });

  it("fires the action button and omits it when onAction is unset", async () => {
    const onAction = vi.fn();
    const { unmount } = renderThemed(
      <Alert.Root variant="warning" onAction={onAction} actionLabel="Retry">
        <Alert.Title>Sync delayed</Alert.Title>
        <Alert.Description>Facility data is more than an hour old.</Alert.Description>
      </Alert.Root>
    );
    const action = buttonNamed("Retry");
    expect(action.getAttribute("type")).toBe("button");
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledOnce();
    unmount();

    renderThemed(
      <Alert.Root>
        <Alert.Title>Saved</Alert.Title>
      </Alert.Root>
    );
    expect(page.getByRole("button").query()).toBeNull();
  });

  it("does not emit a variant attribute on Title or Description", () => {
    renderThemed(
      <Alert.Root variant="destructive">
        <Alert.Title>Outage</Alert.Title>
        <Alert.Description>Two meters are offline.</Alert.Description>
      </Alert.Root>
    );
    const title = headingNamed("Outage", 3);
    const description = page.getByText("Two meters are offline.", { exact: true }).element();
    if (!(description instanceof HTMLElement)) {
      throw new Error("expected the description");
    }
    expect(title.getAttribute("variant")).toBeNull();
    expect(description.getAttribute("variant")).toBeNull();
    expect(description.tagName).toBe("P");
  });
});
