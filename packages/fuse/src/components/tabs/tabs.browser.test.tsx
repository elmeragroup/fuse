import type { ComponentProps } from "react";

import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
// Role tokens live in themes.css only; the tinted-page fills below read them per theme.
import "../../../dist/themes.css";
import {
  assertFocusRingAtBothDensities,
  assertFocusRingOnKeyboardAbsentOnMouse,
} from "../../../test/assert-focus-ring";
import {
  computedOklch,
  CONTROL_MD,
  cssVarColor,
  fkasExternal,
  guenExternal,
  px,
  renderThemed,
  stampDensity,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Tabs } from "./index";

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

async function settledFace(name: string): Promise<{ fill: string; text: string }> {
  const tab = htmlTab(name);
  await Promise.all(tab.getAnimations().map((animation) => animation.finished));
  const style = getComputedStyle(tab);
  return { fill: style.backgroundColor, text: style.color };
}

function htmlControl(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function tabsRoot(): HTMLElement {
  const root = htmlTablist().parentElement;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected the tabs root");
  }
  return root;
}

function AccountPassword({
  variant,
  ...rootProps
}: ComponentProps<typeof Tabs.Root> & Pick<ComponentProps<typeof Tabs.List>, "variant">) {
  return (
    <Tabs.Root defaultValue="account" {...rootProps}>
      <Tabs.List variant={variant}>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="password">Password</Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="account">Account panel</Tabs.Content>
      <Tabs.Content value="password">Password panel</Tabs.Content>
      <Tabs.Content value="billing">Billing panel</Tabs.Content>
    </Tabs.Root>
  );
}

describe("Tabs", () => {
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

  it("hides the closing panel on the frame that opens the next one", async () => {
    renderThemed(<AccountPassword />);
    await expect.element(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeVisible();
    const account = htmlPanel("Account");
    // Base UI keeps a closing panel mounted until the panel's own animations finish.
    account.animate([{ opacity: 1 }, { opacity: 0.99 }], { duration: 1000 });

    htmlTab("Password").click();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(account.isConnected).toBe(true);
    expect(account.hasAttribute("data-ending-style")).toBe(true);
    // A panel that still showed would have a layout box, stacked on the open one.
    expect(account.getClientRects().length).toBe(0);
    expect(htmlPanel("Password").getClientRects().length).toBe(1);
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

    await userEvent.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(htmlTab("Account"));
    expect(htmlTab("Password").getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard(" ");
    expect(htmlTab("Account").getAttribute("aria-selected")).toBe("true");
    await expect.element(page.getByRole("tabpanel", { name: "Account", exact: true })).toBeInTheDocument();
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

  it("paints the shared ring on the trigger at both densities, and on the open panel for keyboard focus only", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <AccountPassword />
      </>
    );
    await assertFocusRingAtBothDensities(htmlControl("Before"), htmlTab("Account"));
    await assertFocusRingOnKeyboardAbsentOnMouse(htmlTab("Account"), htmlPanel("Account"));
  });

  it("emits data-variant=line and leaves the active trigger unfilled, in page text", async () => {
    renderThemed(
      <ThemeScope theme={fkasExternal}>
        <AccountPassword variant="line" />
      </ThemeScope>
    );
    const list = htmlTablist();
    // Oracle sanity: fkas external light sets card text apart from page text.
    expect(cssVarColor(list, "--card-foreground")).not.toBe(cssVarColor(list, "--foreground"));

    expect(list.getAttribute("data-variant")).toBe("line");
    expect(await settledFace("Account")).toEqual({
      fill: "rgba(0, 0, 0, 0)",
      text: cssVarColor(list, "--foreground"),
    });
  });

  it.each([
    ["fkas private light", fkasExternal, "light"],
    ["fkas private dark", fkasExternal, "dark"],
    ["guen light", guenExternal, "light"],
    ["guen dark", guenExternal, "dark"],
  ] as const)(
    "fills the active default trigger with the card on its muted list, %s",
    async (_name, theme, scheme) => {
      // Unit under test: the active trigger's fill and text. Oracle: the scope's own `--card`,
      // `--card-foreground` and `--muted`. These external themes tint the page darker than
      // `--muted` in light.
      const tabs = (
        <ThemeScope theme={theme}>
          <AccountPassword />
        </ThemeScope>
      );
      renderThemed(scheme === "dark" ? <div data-theme="dark">{tabs}</div> : tabs);
      const list = htmlTablist();
      const active = { fill: cssVarColor(list, "--card"), text: cssVarColor(list, "--card-foreground") };
      // Oracle sanity: the page tint differs from the card, so a trigger on the page fill fails.
      expect(cssVarColor(list, "--background")).not.toBe(active.fill);
      expect(getComputedStyle(list).backgroundColor).toBe(cssVarColor(list, "--muted"));
      expect(await settledFace("Account")).toEqual(active);
      expect((await settledFace("Billing")).fill).toBe("rgba(0, 0, 0, 0)");

      // The pointer stays on Billing after the click, so this also reads the hovered active face.
      await userEvent.click(page.getByRole("tab", { name: "Billing", exact: true }));
      expect(htmlTab("Billing").matches(":hover")).toBe(true);
      expect(await settledFace("Billing")).toEqual(active);
      expect((await settledFace("Account")).fill).toBe("rgba(0, 0, 0, 0)");
    }
  );

  it.each([
    ["fkas private", fkasExternal],
    ["guen", guenExternal],
  ] as const)(
    "lifts the active default trigger above its list on a tinted light page, %s",
    async (_name, theme) => {
      // #418's symptom: on these pages the active tab sat darker than its list. Oracle: a raised
      // tab reads lighter than the list it sits in, whichever token fills it.
      renderThemed(
        <ThemeScope theme={theme}>
          <AccountPassword />
        </ThemeScope>
      );
      const list = computedOklch(getComputedStyle(htmlTablist()).backgroundColor);
      const active = computedOklch((await settledFace("Account")).fill);

      expect(active.l).toBeGreaterThan(list.l);
    }
  );

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
