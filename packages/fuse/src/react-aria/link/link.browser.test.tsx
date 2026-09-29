import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { UiProviders } from "../ui-providers/ui-providers";
import { Link } from "./link";

function linkNamed(name: string): HTMLElement {
  const element = page.getByRole("link", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected link ${name}`);
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

/**
 * The routed mount: `UiProviders` installs the RAC `RouterProvider` a Link's client-side
 * navigation flows through. It also keeps a same-origin `href` from actually
 * navigating the test page, because RAC calls `preventDefault` before handing the URL to
 * `navigate`.
 */
function renderRouted(node: ReactNode, navigate: (url: string) => void) {
  return renderThemed(
    <UiProviders locale="en-US" navigate={navigate}>
      {node}
    </UiProviders>
  );
}

describe("Link client-side navigation", () => {
  it("leaves a target=_blank link to the browser rather than the router", async () => {
    const navigate = vi.fn();
    const { host } = renderRouted(
      <Link href="https://example.com/status" target="_blank" rel="noreferrer">
        Status page
      </Link>,
      navigate
    );

    const link = linkNamed("Status page");
    let sawUnpreventedClick = false;
    const suppressRealNavigation = (event: Event) => {
      if (event.target instanceof Node && link.contains(event.target)) {
        sawUnpreventedClick = !event.defaultPrevented;
        // The click has already reached RAC; cancelling here only keeps the real popup
        // out of the test run.
        event.preventDefault();
      }
    };
    host.addEventListener("click", suppressRealNavigation);
    try {
      await userEvent.click(page.getByRole("link", { name: "Status page", exact: true }));
      expect(navigate).not.toHaveBeenCalled();
      expect(sawUnpreventedClick, "an external link must stay a full navigation").toBe(true);
    } finally {
      host.removeEventListener("click", suppressRealNavigation);
    }
  });
});

describe("Link styling", () => {
  it("paints the error variant with the status token", () => {
    renderThemed(
      <Link href="/orders/1042" variant="error">
        Invoice 1042
      </Link>
    );

    const link = linkNamed("Invoice 1042");
    expect(getComputedStyle(link).color).toBe(cssVarColor(link, "--error"));
  });

  it("merges a caller className last, so it wins the conflicting utility", () => {
    renderThemed(
      <Link href="/orders/1042" variant="error" className="text-brand underline">
        Invoice 1042
      </Link>
    );

    const link = linkNamed("Invoice 1042");
    expect(getComputedStyle(link).color).not.toBe(cssVarColor(link, "--error"));
    expect(getComputedStyle(link).textDecorationLine).toContain("underline");
  });

  it("paints the shared state ring on keyboard focus only, at both densities", async () => {
    renderRouted(
      <>
        <button type="button">Before</button>
        <Link href="/orders/1042">Invoice 1042</Link>
      </>,
      () => undefined
    );

    await expect.element(page.getByRole("link", { name: "Invoice 1042" })).toBeVisible();
    await assertFocusRingAtBothDensities(buttonNamed("Before"), linkNamed("Invoice 1042"));
  });
});
