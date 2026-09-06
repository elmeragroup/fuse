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

describe("Link semantics", () => {
  it("renders a real anchor carrying its href and accessible name", () => {
    renderThemed(<Link href="/orders/1042">Invoice 1042</Link>);

    const link = linkNamed("Invoice 1042");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/orders/1042");
  });

  it("still exposes role link and activates on Enter without an href", async () => {
    const onPress = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Link onPress={onPress}>Open the panel</Link>
      </>
    );

    const link = linkNamed("Open the panel");
    expect(link.getAttribute("href")).toBeNull();

    buttonNamed("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement, "a link without href keeps its own tab stop").toBe(link);

    await userEvent.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("takes isDisabled out of the tab order, marks it, and suppresses onPress", async () => {
    const onPress = vi.fn();
    renderThemed(
      <>
        <button type="button">Before</button>
        <Link href="/orders/1042" isDisabled onPress={onPress}>
          Invoice 1042
        </Link>
        <button type="button">After</button>
      </>
    );

    const link = linkNamed("Invoice 1042");
    expect(link.hasAttribute("data-disabled")).toBe(true);
    expect(link.getAttribute("aria-disabled")).toBe("true");
    // RAC swaps the anchor for a span when the link is disabled, so the href it still
    // echoes is inert — there is nothing navigable left.
    expect(link.tagName, "a disabled link is not a navigable anchor").toBe("SPAN");

    buttonNamed("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement, "a disabled link is skipped by Tab").toBe(buttonNamed("After"));

    // `force` skips the actionability wait: a real pointer cannot reach an aria-disabled
    // target, and forcing the click is what proves no press escapes even then.
    await userEvent.click(page.getByRole("link", { name: "Invoice 1042", exact: true }), {
      force: true,
    });
    expect(onPress).not.toHaveBeenCalled();
  });

  it("reports aria-current as data-current for state-based styling", () => {
    renderThemed(
      <>
        <Link href="/orders" aria-current="page">
          Orders
        </Link>
        <Link href="/invoices">Invoices</Link>
      </>
    );

    expect(linkNamed("Orders").getAttribute("aria-current")).toBe("page");
    expect(linkNamed("Orders").hasAttribute("data-current")).toBe(true);
    expect(linkNamed("Invoices").hasAttribute("data-current")).toBe(false);
  });
});

describe("Link client-side navigation", () => {
  it("hands an internal href to the UiProviders navigate instead of navigating", async () => {
    const navigate = vi.fn();
    const locationBefore = window.location.href;
    const { host } = renderRouted(<Link href="/orders/1042">Invoice 1042</Link>, navigate);

    const link = linkNamed("Invoice 1042");
    expect(link.getAttribute("href")).toBe("/orders/1042");

    let clickDefaultPrevented = false;
    const observeBubbledClick = (event: Event) => {
      if (event.target instanceof Node && link.contains(event.target)) {
        clickDefaultPrevented = event.defaultPrevented;
      }
    };
    host.addEventListener("click", observeBubbledClick);
    try {
      await userEvent.click(page.getByRole("link", { name: "Invoice 1042", exact: true }));
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0]?.[0]).toBe("/orders/1042");
      expect(clickDefaultPrevented, "client navigation must cancel the browser default").toBe(true);
      expect(window.location.href).toBe(locationBefore);
    } finally {
      host.removeEventListener("click", observeBubbledClick);
    }
  });

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
