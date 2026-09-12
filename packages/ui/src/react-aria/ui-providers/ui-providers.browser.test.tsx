import type { ReactNode } from "react";

import { DateField, DateInput, DateSegment, Label, Link, useLocale } from "react-aria-components";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { Pagination } from "../../components/pagination/pagination";
import { UiProviders } from "./ui-providers";

function linkNamed(name: string): HTMLAnchorElement {
  const element = page.getByRole("link", { name, exact: true }).element();
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`expected link ${name}`);
  }
  return element;
}

function navNamed(name: string): HTMLElement {
  const element = page.getByRole("navigation", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`expected navigation ${name}`);
  }
  return element;
}

function RacLocale() {
  const { locale } = useLocale();
  return <output aria-label="RAC locale">{locale}</output>;
}

function InvoiceDate() {
  return (
    <DateField>
      <Label>Invoice date</Label>
      <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
    </DateField>
  );
}

function Pages() {
  return (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#previous" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#1" isActive>
            1
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#next" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}

function renderProviders(node: ReactNode, locale: "nb-NO" | "sv-SE" | "en-US" | "fi-FI" = "en-US") {
  return renderThemed(
    <UiProviders locale={locale} navigate={() => undefined}>
      {node}
    </UiProviders>
  );
}

describe("UiProviders", () => {
  it("lets a RAC Link call navigate and prevents full navigation", async () => {
    const navigate = vi.fn();
    const locationBefore = window.location.href;
    const { host } = renderThemed(
      <UiProviders locale="en-US" navigate={navigate}>
        <Link href="/x">Open /x</Link>
      </UiProviders>
    );

    const link = linkNamed("Open /x");
    expect(link.getAttribute("href")).toBe("/x");

    let clickDefaultPrevented = false;
    const observeBubbledClick = (event: Event) => {
      if (event.target instanceof Node && link.contains(event.target)) {
        clickDefaultPrevented = event.defaultPrevented;
      }
    };
    host.addEventListener("click", observeBubbledClick);
    try {
      await userEvent.click(page.getByRole("link", { name: "Open /x" }));
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0]?.[0]).toBe("/x");
      expect(clickDefaultPrevented).toBe(true);
      expect(window.location.href).toBe(locationBefore);
    } finally {
      host.removeEventListener("click", observeBubbledClick);
    }
  });

  it("renders no DOM of its own", () => {
    const { host } = renderThemed(
      <UiProviders locale="en-US" navigate={() => undefined}>
        <output aria-label="provider child">ok</output>
      </UiProviders>
    );

    const child = page.getByRole("status", { name: "provider child", exact: true }).element();
    expect(child.parentElement).toBe(host.firstElementChild);
    expect(host.firstElementChild?.childElementCount).toBe(1);
  });

  it("forwards locale to RAC I18n instead of navigator.language", async () => {
    const navigatorLanguage = Object.getOwnPropertyDescriptor(window.navigator, "language");
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      get: () => "en-US",
    });
    try {
      renderProviders(
        <>
          <RacLocale />
          <InvoiceDate />
        </>,
        "nb-NO"
      );

      await expect.element(page.getByRole("status", { name: "RAC locale" })).toHaveTextContent("nb-NO");
      await expect.element(page.getByRole("spinbutton", { name: "måned", exact: false })).toBeVisible();
      await expect.element(page.getByRole("spinbutton", { name: "dag", exact: false })).toBeVisible();
      await expect.element(page.getByRole("spinbutton", { name: "år", exact: false })).toBeVisible();
      expect(page.getByRole("spinbutton", { name: "month", exact: false }).query()).toBeNull();
      expect(window.navigator.language).toBe("en-US");
    } finally {
      if (navigatorLanguage === undefined) {
        Reflect.deleteProperty(window.navigator, "language");
      } else {
        Object.defineProperty(window.navigator, "language", navigatorLanguage);
      }
    }
  });

  it("forwards locale to string-bearing dictionary consumers", async () => {
    const { rerender } = renderProviders(<Pages />, "nb-NO");
    expect(navNamed("Sidenavigasjon")).toBeTruthy();
    await expect.element(page.getByRole("link", { name: "Gå til forrige side" })).toBeVisible();

    rerender(
      <UiProviders locale="sv-SE" navigate={() => undefined}>
        <Pages />
      </UiProviders>
    );
    expect(navNamed("Sidnavigering")).toBeTruthy();
    await expect.element(page.getByRole("link", { name: "Gå till föregående sida" })).toBeVisible();
  });
});
