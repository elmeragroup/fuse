import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  assertFocusRingAtBothDensities,
  assertFocusRingOnKeyboardAbsentOnMouse,
  assertKeyboardFocusRingAtBothDensities,
} from "../../../test/assert-focus-ring";
import {
  CONTROL_MD,
  fkasExternal,
  px,
  renderThemed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Tabs } from "./tabs";

function htmlTab(name: string): HTMLElement {
  const element = page.getByRole("tab", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected a tab named ${name}`);
  }
  return element;
}

function htmlTablist(): HTMLElement {
  const element = page.getByRole("tablist").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected a tablist");
  }
  return element;
}

function htmlPanel(name: string): HTMLElement {
  const element = page.getByRole("tabpanel", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected a tabpanel named ${name}`);
  }
  return element;
}

function htmlControl(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function tabsRoot(): HTMLElement {
  const root = htmlTablist().closest("[data-slot='tabs']");
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected the tabs root");
  }
  return root;
}

function AccountPassword({
  passwordDisabled,
  ...props
}: ComponentProps<typeof Tabs.Root> &
  Pick<ComponentProps<typeof Tabs.List>, "variant"> & {
    passwordDisabled?: boolean;
  }) {
  const { variant, ...rootProps } = props;
  return (
    <Tabs.Root defaultValue="account" {...rootProps}>
      <Tabs.List variant={variant}>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password" disabled={passwordDisabled}>
          Password
        </Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Account panel</Tabs.Content>
      <Tabs.Content value="password">Password panel</Tabs.Content>
      <Tabs.Content value="billing">Billing panel</Tabs.Content>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
  it("activates a tab from click and hides the previous panel", async () => {
    renderThemed(<AccountPassword />);

    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
    await expect.element(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeInTheDocument();
    expect(page.getByRole("tabpanel", { name: "Password", exact: true }).query()).toBeNull();

    await userEvent.click(page.getByRole("tab", { name: "Password", exact: true }));
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("true");
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("false");
    await expect.element(page.getByRole("tabpanel", { name: "Password", exact: true })).toBeInTheDocument();
    expect(page.getByRole("tabpanel", { name: "Account", exact: true }).query()).toBeNull();
  });

  it("moves and activates tabs with Arrow keys, Home, and End", async () => {
    renderThemed(<AccountPassword />);

    htmlTab("Account").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(htmlTab("Password"));
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("true");
    await expect.element(page.getByRole("tabpanel", { name: "Password", exact: true })).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(htmlTab("Billing"));
    expect(htmlTab("Billing").getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
  });

  it("lets activateOnFocus={false} opt out: arrows move focus, Enter or Space activates", async () => {
    renderThemed(
      <Tabs.Root defaultValue="account">
        <Tabs.List activateOnFocus={false}>
          <Tabs.Trigger value="account">Account</Tabs.Trigger>
          <Tabs.Trigger value="password">Password</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="account">Account panel</Tabs.Content>
        <Tabs.Content value="password">Password panel</Tabs.Content>
      </Tabs.Root>
    );

    htmlTab("Account").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(htmlTab("Password"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("false");
    await expect.element(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeInTheDocument();

    await userEvent.keyboard("{Enter}");
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("true");
    await expect.element(page.getByRole("tabpanel", { name: "Password", exact: true })).toBeInTheDocument();
  });

  it("stamps vertical orientation on Root and navigates with ArrowUp/ArrowDown", async () => {
    renderThemed(<AccountPassword orientation="vertical" />);

    expect(tabsRoot().getAttribute("data-orientation")).toBe("vertical");

    htmlTab("Account").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(htmlTab("Password"));
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
  });

  it("lets a disabled trigger receive roving focus without activating, including from click", async () => {
    renderThemed(<AccountPassword passwordDisabled />);

    expect(htmlTab("Password").getAttribute("aria-disabled")).toBe("true");
    htmlTab("Password").click();
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("false");
    expect(page.getByRole("tabpanel", { name: "Password", exact: true }).query()).toBeNull();

    htmlTab("Account").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(htmlTab("Password"));
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("false");
    await expect.element(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeInTheDocument();
  });

  it("tabs from the active trigger into the open panel", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <AccountPassword />
      </>
    );

    htmlControl("Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(htmlPanel("Account"));
  });

  it("paints the shared ring on the trigger and the open panel at both densities", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <AccountPassword />
      </>
    );
    await assertFocusRingAtBothDensities(htmlControl("Before"), htmlTab("Account"));
    await assertKeyboardFocusRingAtBothDensities(htmlTab("Account"), htmlPanel("Account"));
    await assertFocusRingOnKeyboardAbsentOnMouse(htmlTab("Account"), htmlPanel("Account"));
  });

  it("emits data-variant=line and does not apply bg-background on the active trigger", () => {
    renderThemed(<AccountPassword variant="line" />);

    expect(htmlTablist().getAttribute("data-variant")).toBe("line");
    const classes = htmlTab("Account").className.split(/\s+/);
    expect(classes).not.toContain("bg-background");
    expect(classes.some((token) => token.includes("data-active:bg-transparent"))).toBe(true);
  });

  it("matches signed md list height when horizontal and stays content-sized when vertical", () => {
    const { rerender } = renderThemed(
      <>
        <Tabs.Root defaultValue="account">
          <Tabs.List>
            <Tabs.Trigger value="account">Horizontal</Tabs.Trigger>
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="account">Account panel</Tabs.Content>
          <Tabs.Content value="password">Password panel</Tabs.Content>
        </Tabs.Root>
        <Tabs.Root defaultValue="account" orientation="vertical">
          <Tabs.List>
            <Tabs.Trigger value="account">Vertical</Tabs.Trigger>
            <Tabs.Trigger value="password">Password</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="account">Account panel</Tabs.Content>
          <Tabs.Content value="password">Password panel</Tabs.Content>
        </Tabs.Root>
      </>
    );

    const horizontalHeights: number[] = [];
    for (const density of ["dense", "comfortable"] as const) {
      stampDensity(density);
      const horizontal = htmlTab("Horizontal").closest("[role='tablist']");
      const vertical = htmlTab("Vertical").closest("[role='tablist']");
      if (!(horizontal instanceof HTMLElement) || !(vertical instanceof HTMLElement)) {
        throw new Error("expected both tablists");
      }
      const horizontalHeight = px(getComputedStyle(horizontal).height);
      const verticalHeight = px(getComputedStyle(vertical).height);
      expect(horizontalHeight, `${density} horizontal`).toBe(CONTROL_MD[density].height);
      expect(verticalHeight, `${density} vertical`).not.toBe(CONTROL_MD[density].height);
      const trigger = htmlTab("Horizontal");
      const triggerStyle = getComputedStyle(trigger);
      expect(px(triggerStyle.paddingInlineStart), `${density} trigger px`).toBe(CONTROL_MD[density].px);
      expect(px(triggerStyle.fontSize), `${density} trigger font`).toBe(CONTROL_MD[density].font);
      expect(px(triggerStyle.lineHeight), `${density} trigger leading`).toBe(CONTROL_MD[density].leading);
      horizontalHeights.push(horizontalHeight);
    }
    expect(horizontalHeights[0]).not.toBe(horizontalHeights[1]);

    stampDensity("dense");
    rerender(
      <div data-density="comfortable">
        <Tabs.Root defaultValue="account">
          <Tabs.List>
            <Tabs.Trigger value="account">Nested</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="account">Account panel</Tabs.Content>
        </Tabs.Root>
      </div>
    );
    const nested = htmlTab("Nested").closest("[role='tablist']");
    if (!(nested instanceof HTMLElement)) {
      throw new Error("expected the nested tablist");
    }
    expect(px(getComputedStyle(nested).height)).toBe(CONTROL_MD.dense.height);

    rerender(
      <ThemeScope theme={fkasExternal}>
        <Tabs.Root defaultValue="account">
          <Tabs.List>
            <Tabs.Trigger value="account">Scoped</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="account">Account panel</Tabs.Content>
        </Tabs.Root>
      </ThemeScope>
    );
    const scoped = htmlTab("Scoped").closest("[role='tablist']");
    if (!(scoped instanceof HTMLElement)) {
      throw new Error("expected the scoped tablist");
    }
    expect(px(getComputedStyle(scoped).height)).toBe(CONTROL_MD.dense.height);
  });
});
