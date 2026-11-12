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
  cssVarColor,
  fkasBranded,
  fkasPrivate,
  guenBranded,
  renderThemed,
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

function settledFace(name: string) {
  const tab = htmlTab(name);
  for (const animation of tab.getAnimations()) animation.finish();
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
    // Base UI keeps a closing panel mounted until the panel's own animations finish; paused, this
    // one never does while the test looks.
    account.animate([{ opacity: 1 }, { opacity: 0.99 }], { duration: 1000 }).pause();

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

  it.each([
    ["fkas private light", fkasBranded, "light"],
    ["fkas private dark", fkasBranded, "dark"],
    ["guen light", guenBranded, "light"],
    ["guen dark", guenBranded, "dark"],
  ] as const)(
    "fills the active default trigger with the card on its muted list, %s",
    async (_name, theme, scheme) => {
      // Unit under test: the active trigger's fill and text. Oracle: the scope's own `--card`,
      // `--card-foreground` and `--muted`. These branded themes tint the page darker than
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
      expect(settledFace("Account")).toEqual(active);
      expect(settledFace("Billing").fill).toBe("rgba(0, 0, 0, 0)");

      // The pointer stays on Billing after the click, so this also reads the hovered active face.
      await userEvent.click(page.getByRole("tab", { name: "Billing", exact: true }));
      expect(htmlTab("Billing").matches(":hover")).toBe(true);
      expect(settledFace("Billing")).toEqual(active);
      expect(settledFace("Account").fill).toBe("rgba(0, 0, 0, 0)");
    }
  );

  const fksePrivate = { identity: "branded", brand: "fkse", segment: "private" } as const;

  it.each([
    ["branded fkse private", "light", fksePrivate],
    ["branded fkse private", "dark", fksePrivate],
    ["neutral fkas private", "light", fkasPrivate],
    ["neutral fkas private", "dark", fkasPrivate],
  ] as const)(
    "paints inactive trigger text in --muted-foreground on both list variants, %s %s",
    (_name, scheme, theme) => {
      // Unit under test: the role an inactive, unhovered trigger paints its text in. Oracle:
      // `--muted-foreground`, which `contrast-matrix.test.ts` holds to 4.5:1 on `muted` (the default
      // list) and on every control surface a transparent line list sits on, in every theme and
      // scheme. Tying the trigger to that role makes a per-theme contrast measurement here redundant.
      // Telinet light was the worst case of the old translucent foreground, at 3.38:1.
      for (const variant of ["default", "line"] as const) {
        const { unmount } = renderThemed(
          <div data-theme={scheme}>
            <ThemeScope theme={theme}>
              <AccountPassword variant={variant} />
            </ThemeScope>
          </div>
        );
        const tab = htmlTab("Password");
        expect(tab.matches(":hover")).toBe(false);
        expect(settledFace("Password").text, variant).toBe(cssVarColor(tab, "--muted-foreground"));
        unmount();
      }
    }
  );
});
