import type { ComponentProps } from "react";
import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { renderThemed } from "../../../test/themed-browser-render";
import { Accordion } from "./accordion";

function htmlControl(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function ShippingBilling({
  shippingDisabled,
  ...props
}: ComponentProps<typeof Accordion.Root> & {
  shippingDisabled?: boolean;
}) {
  return (
    <Accordion.Root {...props}>
      <Accordion.Item value="shipping" disabled={shippingDisabled}>
        <Accordion.Header>
          <Accordion.Trigger>Shipping</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          Delivered within 3–5 business days. <a href="#track">Track shipment</a>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item value="billing">
        <Accordion.Header>
          <Accordion.Trigger>Billing</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content>
          Invoices are issued at the start of each month. <a href="#invoice">View invoice</a>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

describe("Accordion", () => {
  it("exposes a heading-wrapped trigger that labels its region", () => {
    renderThemed(<ShippingBilling defaultValue={["shipping"]} />);

    const heading = page.getByRole("heading", { level: 3, name: "Shipping" }).element();
    const trigger = page.getByRole("button", { name: "Shipping", exact: true }).element();
    expect(heading.contains(trigger)).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const region = page.getByRole("region", { name: "Shipping" }).element();
    expect(region.id).toBe(controls);
    expect(region.getAttribute("data-slot")).toBe("accordion-content");
    expect(trigger.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("toggles from click, Enter, and Space, tracking aria-expanded and region visibility", async () => {
    renderThemed(<ShippingBilling />);

    const trigger = page.getByRole("button", { name: "Shipping", exact: true });
    expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
    expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();

    await userEvent.click(trigger);
    expect(trigger.element().getAttribute("aria-expanded")).toBe("true");
    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();
    });

    trigger.element().focus();
    await userEvent.keyboard("{Enter}");
    expect(trigger.element().getAttribute("aria-expanded")).toBe("true");

    await userEvent.keyboard(" ");
    expect(trigger.element().getAttribute("aria-expanded")).toBe("false");
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();
    });
  });

  it("closes the open item when another opens in single mode, and stays collapsible", async () => {
    renderThemed(<ShippingBilling defaultValue={["shipping"]} />);

    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();
    expect(page.getByRole("region", { name: "Billing" }).query()).toBeNull();

    await userEvent.click(page.getByRole("button", { name: "Billing", exact: true }));
    await expect.element(page.getByRole("region", { name: "Billing" })).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();
    });

    await userEvent.click(page.getByRole("button", { name: "Billing", exact: true }));
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Billing" }).query()).toBeNull();
    });
  });

  it("keeps both items open independently when multiple", async () => {
    renderThemed(<ShippingBilling multiple defaultValue={["shipping", "billing"]} />);

    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();
    await expect.element(page.getByRole("region", { name: "Billing" })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Billing", exact: true }));
    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Billing" }).query()).toBeNull();
    });
  });

  it("moves focus trigger → trigger → open panel content with Tab, not Arrow keys", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <ShippingBilling defaultValue={["billing"]} />
      </>
    );

    htmlControl("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(htmlControl("Shipping"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(htmlControl("Billing"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(
      page.getByRole("link", { name: "View invoice", exact: true }).element()
    );

    htmlControl("Shipping").focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(htmlControl("Shipping"));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(htmlControl("Shipping"));
    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(htmlControl("Shipping"));
  });

  it("round-trips controlled value and reports an array of length at most one in single mode", async () => {
    const onValueChange = vi.fn();

    function Host() {
      const [value, setValue] = useState<unknown[]>([]);
      return (
        <ShippingBilling
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
        />
      );
    }

    renderThemed(<Host />);

    await userEvent.click(page.getByRole("button", { name: "Shipping", exact: true }));
    expect(onValueChange).toHaveBeenNthCalledWith(1, ["shipping"]);
    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();

    await userEvent.click(page.getByRole("button", { name: "Billing", exact: true }));
    expect(onValueChange).toHaveBeenLastCalledWith(["billing"]);
    await expect.element(page.getByRole("region", { name: "Billing" })).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();
    });
  });

  it("disables every trigger from Root and only the marked item per-item", async () => {
    const onValueChange = vi.fn();
    const { rerender } = renderThemed(<ShippingBilling disabled onValueChange={onValueChange} />);

    const shipping = htmlControl("Shipping");
    const billing = htmlControl("Billing");
    expect(shipping.hasAttribute("data-disabled")).toBe(true);
    expect(billing.hasAttribute("data-disabled")).toBe(true);
    shipping.click();
    expect(onValueChange).not.toHaveBeenCalled();
    expect(page.getByRole("region", { name: "Shipping" }).query()).toBeNull();

    rerender(<ShippingBilling shippingDisabled onValueChange={onValueChange} />);
    expect(htmlControl("Shipping").hasAttribute("data-disabled")).toBe(true);
    expect(htmlControl("Billing").hasAttribute("data-disabled")).toBe(false);
    htmlControl("Shipping").click();
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.click(page.getByRole("button", { name: "Billing", exact: true }));
    expect(onValueChange).toHaveBeenCalled();
    await expect.element(page.getByRole("region", { name: "Billing" })).toBeInTheDocument();
  });

  it("keeps closed panels in the DOM for hiddenUntilFound and keepMounted, and unmounts by default", async () => {
    const { rerender } = renderThemed(<ShippingBilling />);
    expect(page.getByText("Delivered within 3–5 business days.", { exact: false }).query()).toBeNull();

    rerender(<ShippingBilling keepMounted />);
    const kept = page.getByText("Delivered within 3–5 business days.", { exact: false }).element();
    expect(kept.closest('[role="region"]')?.hasAttribute("hidden")).toBe(true);
    expect(
      page.getByRole("button", { name: "Shipping", exact: true }).element().getAttribute("aria-expanded")
    ).toBe("false");

    rerender(<ShippingBilling hiddenUntilFound />);
    const searchable = page.getByText("Delivered within 3–5 business days.", { exact: false }).element();
    const panel = searchable.closest('[role="region"]');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("hidden")).toBe("until-found");
    panel?.dispatchEvent(new Event("beforematch", { bubbles: true }));
    await vi.waitFor(() => {
      expect(
        page.getByRole("button", { name: "Shipping", exact: true }).element().getAttribute("aria-expanded")
      ).toBe("true");
    });
    await expect.element(page.getByRole("region", { name: "Shipping" })).toBeInTheDocument();
  });

  it("passes variant and radius from Root to Item, Trigger, and Content via context", () => {
    renderThemed(<ShippingBilling variant="card" radius="xl" defaultValue={["shipping"]} />);

    const trigger = htmlControl("Shipping");
    const content = page.getByRole("region", { name: "Shipping" }).element();
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the shipping region");
    }
    // card trigger is justify-between; infodropdown is justify-start (accordion.md §4).
    expect(getComputedStyle(trigger).justifyContent).toBe("space-between");
    const shippingBox = trigger.getBoundingClientRect();
    const billingBox = htmlControl("Billing").getBoundingClientRect();
    // Root `space-y-3` on the card variant separates items.
    expect(billingBox.top - shippingBox.bottom).toBeGreaterThan(8);
    expect(page.getByRole("heading", { level: 3, name: "Shipping" }).element().contains(trigger)).toBe(true);
  });

  it("paints the shared ring on keyboard focus-visible and not on mouse focus, at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <ShippingBilling />
      </>
    );
    await assertFocusRingAtBothDensities(htmlControl("Before"), htmlControl("Shipping"));
  });
});
