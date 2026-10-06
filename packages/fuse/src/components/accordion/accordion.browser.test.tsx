import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { assertFocusRingAtBothDensities } from "../../../test/assert-focus-ring";
import { expectPanelHeightTransition } from "../../../test/panel-transition";
import { cssVarColor, renderThemed } from "../../../test/themed-browser-render";
import { CaretRight } from "../../icons/generated/caret-right";
import { Plus } from "../../icons/generated/plus";
import { Accordion } from "./index";

function htmlControl(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function ShippingBilling({
  shippingDisabled,
  shippingTrigger = "Shipping",
  shippingIndicator,
  ...props
}: ComponentProps<typeof Accordion.Root> & {
  shippingDisabled?: boolean;
  shippingTrigger?: ReactNode;
  shippingIndicator?: ReactNode;
}) {
  return (
    <Accordion.Root {...props}>
      <Accordion.Item value="shipping" disabled={shippingDisabled}>
        <Accordion.Header>
          <Accordion.Trigger indicator={shippingIndicator}>{shippingTrigger}</Accordion.Trigger>
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
    const { rerender } = renderThemed(<ShippingBilling key="unmounted" />);
    expect(page.getByText("Delivered within 3–5 business days.", { exact: false }).query()).toBeNull();

    rerender(<ShippingBilling key="kept" keepMounted />);
    const kept = page.getByText("Delivered within 3–5 business days.", { exact: false }).element();
    expect(kept.closest('[role="region"]')?.hasAttribute("hidden")).toBe(true);
    expect(
      page.getByRole("button", { name: "Shipping", exact: true }).element().getAttribute("aria-expanded")
    ).toBe("false");

    rerender(<ShippingBilling key="searchable" hiddenUntilFound />);
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

  it("animates a keepMounted panel's height open and closed", async () => {
    renderThemed(<ShippingBilling keepMounted />);

    await expectPanelHeightTransition(htmlControl("Shipping"), "hidden");
  });

  it("passes variant and radius from Root to Item, Trigger, and Content via context", () => {
    renderThemed(<ShippingBilling variant="card" radius="xl" defaultValue={["shipping"]} />);

    const heading = page.getByRole("heading", { level: 3, name: "Shipping" }).element();
    const trigger = htmlControl("Shipping");
    const content = page.getByRole("region", { name: "Shipping" }).element();
    const item = heading.parentElement;
    if (!(heading instanceof HTMLElement) || !(item instanceof HTMLElement)) {
      throw new Error("expected the shipping item");
    }
    if (!(content instanceof HTMLElement)) {
      throw new Error("expected the shipping region");
    }
    expect(heading.contains(trigger)).toBe(true);
    expect(getComputedStyle(item).backgroundColor).toBe(cssVarColor(item, "--card"));
    expect(Number.parseFloat(getComputedStyle(item).borderTopLeftRadius)).toBeGreaterThan(0);
    expect(getComputedStyle(item).overflow).toBe("hidden");
    expect(getComputedStyle(content).backgroundColor).toBe(cssVarColor(content, "--card"));
    expect(getComputedStyle(trigger).justifyContent).toBe("space-between");
    const billingHeading = page.getByRole("heading", { level: 3, name: "Billing" }).element();
    const billingItem = billingHeading.parentElement;
    if (!(billingItem instanceof HTMLElement)) {
      throw new Error("expected the billing item");
    }
    const gap = billingItem.getBoundingClientRect().top - item.getBoundingClientRect().bottom;
    expect(gap).toBeGreaterThanOrEqual(11);
    expect(gap).toBeLessThan(16);
  });

  it("rotates the default caret while its item is open", async () => {
    renderThemed(<ShippingBilling defaultValue={["shipping"]} />);

    const openCaret = htmlControl("Shipping").querySelector("svg");
    const closedCaret = htmlControl("Billing").querySelector("svg");
    if (openCaret === null || closedCaret === null) {
      throw new Error("expected a caret in each trigger");
    }
    expect(htmlControl("Shipping").lastElementChild).toBe(openCaret);
    await vi.waitFor(() => {
      expect(getComputedStyle(openCaret).rotate).toBe("180deg");
    });
    expect(getComputedStyle(closedCaret).rotate).toBe("none");
  });

  it("renders no indicator when indicator is null", () => {
    renderThemed(<ShippingBilling shippingIndicator={null} />);

    expect(htmlControl("Shipping").querySelector("svg")).toBeNull();
    expect(htmlControl("Shipping").children).toHaveLength(0);
    expect(htmlControl("Billing").querySelector("svg")).not.toBeNull();
  });

  it("renders a custom indicator in the caret's place", () => {
    renderThemed(
      <ShippingBilling shippingIndicator={<Plus aria-hidden="true" data-testid="plus-indicator" />} />
    );

    const trigger = htmlControl("Shipping");
    const plus = page.getByTestId("plus-indicator").element();
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    expect(trigger.lastElementChild?.contains(plus)).toBe(true);
  });

  it.each(["default", "infodropdown"] as const)(
    "places a custom indicator where the default caret sits in the %s variant",
    (variant) => {
      renderThemed(
        <ShippingBilling
          variant={variant}
          shippingIndicator={<Plus aria-hidden="true" className="size-4" data-testid="plus-indicator" />}
        />
      );

      const shipping = htmlControl("Shipping").getBoundingClientRect();
      const billing = htmlControl("Billing").getBoundingClientRect();
      const plus = page.getByTestId("plus-indicator").element().getBoundingClientRect();
      const caret = htmlControl("Billing").querySelector("svg")?.getBoundingClientRect();
      if (caret === undefined) {
        throw new Error("expected the default caret in the billing trigger");
      }
      // Oracle: the default caret in the sibling trigger, offset from its own trigger box.
      expect(shipping.right - plus.right).toBeCloseTo(billing.right - caret.right, 0);
      expect(plus.top + plus.height / 2 - shipping.top).toBeCloseTo(
        caret.top + caret.height / 2 - billing.top,
        0
      );
    }
  );

  it("keeps a leading icon beside the label when the indicator is null", () => {
    renderThemed(
      <ShippingBilling
        shippingIndicator={null}
        shippingTrigger={
          <>
            <CaretRight aria-hidden="true" data-testid="leading-chevron" />
            <span>Shipping</span>
          </>
        }
      />
    );

    const trigger = htmlControl("Shipping");
    const chevron = page.getByTestId("leading-chevron").element();
    const label = page.getByText("Shipping", { exact: true }).element();
    expect(trigger.firstElementChild).toBe(chevron);
    const triggerBox = trigger.getBoundingClientRect();
    const chevronBox = chevron.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    const triggerStyle = getComputedStyle(trigger);
    const contentLeft =
      triggerBox.left +
      Number.parseFloat(triggerStyle.borderLeftWidth) +
      Number.parseFloat(triggerStyle.paddingLeft);
    expect(Math.abs(chevronBox.left - contentLeft)).toBeLessThan(1);
    // The trigger's 8px gap, not the free space a space-between row would open.
    expect(labelBox.left - chevronBox.right).toBeCloseTo(8, 0);
    expect(triggerBox.right - labelBox.right).toBeGreaterThan(100);
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
