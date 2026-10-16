import type { CSSProperties, ReactElement, ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { render } from "../../../test/browser-render";
import { ContextProbe, DESKTOP, MOBILE } from "../../../test/sidebar-browser-fixtures";
import {
  cssVarColor,
  headingNamed,
  roleNamed,
  snapshotDocumentTheme,
} from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ResolvedColorScheme } from "../../theme/color-scheme-types";
import { ThemeScope } from "../../theme/theme-scope";
import type { ThemeInput, ThemeVariant } from "../../theme/tokens/themes";
import { AlertDialog } from "../alert-dialog";
import { Command } from "../command";
import { Dialog } from "../dialog";
import { Popover } from "../popover";
import { Select } from "../select";
import { Sheet } from "../sheet";
import { Sidebar } from "../sidebar";

let restoreDocumentTheme: () => void;

beforeEach(() => {
  restoreDocumentTheme = snapshotDocumentTheme();
});

afterEach(async () => {
  restoreDocumentTheme();
  await page.viewport(DESKTOP.width, DESKTOP.height);
});

const SCOPE_NAME = "Order flow";

function Scope({
  variant,
  style,
  children,
}: {
  variant: ThemeVariant;
  style?: CSSProperties;
  children: ReactNode;
}): ReactElement {
  // fkas is the brand whose light page tint sits furthest from its white card.
  const theme = { variant, brand: "fkas", segment: "private" } as const satisfies ThemeInput;
  return (
    <LocaleProvider locale="en-US">
      <ThemeScope theme={theme} role="region" aria-label={SCOPE_NAME} style={style}>
        {children}
      </ThemeScope>
    </LocaleProvider>
  );
}

/** Each modal, opened from a trigger, with the accessible name its popup takes. */
const MODALS = [
  {
    label: "Dialog.Content",
    role: "dialog",
    name: "Call me back",
    node: (
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Call me back</Dialog.Title>
          <Dialog.Description>We call you within one working day.</Dialog.Description>
        </Dialog.Content>
      </Dialog.Root>
    ),
  },
  {
    label: "AlertDialog.Content",
    role: "alertdialog",
    name: "Cancel the order?",
    node: (
      <AlertDialog.Root>
        <AlertDialog.Trigger>Open</AlertDialog.Trigger>
        <AlertDialog.Content title="Cancel the order?" actionLabel="Cancel order">
          The order is not sent.
        </AlertDialog.Content>
      </AlertDialog.Root>
    ),
  },
  {
    label: "Sheet.Content",
    role: "dialog",
    name: "Delivery address",
    node: (
      <Sheet.Root>
        <Sheet.Trigger>Open</Sheet.Trigger>
        <Sheet.Content>
          <Sheet.Header>
            <Sheet.Title>Delivery address</Sheet.Title>
            <Sheet.Description>Where we send the meter.</Sheet.Description>
          </Sheet.Header>
        </Sheet.Content>
      </Sheet.Root>
    ),
  },
] as const;

async function openModal(name: string, role: "dialog" | "alertdialog" = "dialog"): Promise<HTMLElement> {
  await userEvent.click(roleNamed("button", "Open"));
  // Base UI mounts the popup a frame or more after the click.
  await expect.element(page.getByRole(role, { name })).toBeInTheDocument();
  return roleNamed(role, name);
}

/** The colour a role resolves to on the theme scope, read through the browser's own cascade. */
function scopeColor(token: string): string {
  return cssVarColor(roleNamed("region", SCOPE_NAME), token);
}

describe("modal fill", () => {
  // Unit under test: the fill and text colour of each modal popup. Oracle: the issue's contract,
  // the page pair in external light and the popover pair everywhere else, read as the scope's own
  // custom properties.
  const cases = [
    { variant: "external", scheme: "light", fill: "--background", text: "--foreground" },
    { variant: "internal", scheme: "light", fill: "--popover", text: "--popover-foreground" },
    { variant: "external", scheme: "dark", fill: "--popover", text: "--popover-foreground" },
    { variant: "internal", scheme: "dark", fill: "--popover", text: "--popover-foreground" },
  ] as const satisfies readonly {
    variant: ThemeVariant;
    scheme: ResolvedColorScheme;
    fill: string;
    text: string;
  }[];

  for (const { variant, scheme, fill, text } of cases) {
    it.each(MODALS)(`fills $label from ${fill} in ${variant} ${scheme}`, async ({ role, name, node }) => {
      document.documentElement.setAttribute("data-theme", scheme);
      render(<Scope variant={variant}>{node}</Scope>);
      const style = getComputedStyle(await openModal(name, role));
      expect(style.backgroundColor).toBe(scopeColor(fill));
      expect(style.color).toBe(scopeColor(text));
    });
  }

  it("tints the external light modal away from the white card and popover", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Scope variant="external">{MODALS[0].node}</Scope>);
    const style = getComputedStyle(await openModal(MODALS[0].name));
    expect(style.backgroundColor).not.toBe(scopeColor("--card"));
    expect(style.backgroundColor).not.toBe(scopeColor("--popover"));
  });

  it.each(MODALS)(
    "reads a --dialog pair set on the theme element in $label and its title",
    async ({ role, name, node }) => {
      document.documentElement.setAttribute("data-theme", "light");
      const custom = { "--dialog": "oklch(0.5 0.1 20)", "--dialog-foreground": "oklch(0.98 0.01 20)" };
      render(
        <Scope variant="external" style={custom}>
          {node}
        </Scope>
      );
      const style = getComputedStyle(await openModal(name, role));
      expect(style.backgroundColor).toBe(scopeColor("--dialog"));
      expect(style.color).toBe(scopeColor("--dialog-foreground"));
      expect(style.backgroundColor).not.toBe(scopeColor("--background"));
      // The title inherits the modal ink rather than painting a role of its own.
      expect(getComputedStyle(headingNamed(name)).color).toBe(scopeColor("--dialog-foreground"));
    }
  );

  it("lets a className put one modal back on the popover fill", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(
      <Scope variant="external">
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Content className="bg-popover text-popover-foreground">
            <Dialog.Title>Call me back</Dialog.Title>
          </Dialog.Content>
        </Dialog.Root>
      </Scope>
    );
    const style = getComputedStyle(await openModal("Call me back"));
    expect(style.backgroundColor).toBe(scopeColor("--popover"));
    expect(style.color).toBe(scopeColor("--popover-foreground"));
  });
});

describe("surfaces that keep their own fill in external light", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });

  it("keeps Command.Content on the popover", async () => {
    render(
      <Scope variant="external">
        <Command.Root items={["Invoices"]}>
          <Command.Trigger>Open</Command.Trigger>
          <Command.Content aria-label="Search the site" />
        </Command.Root>
      </Scope>
    );
    const style = getComputedStyle(await openModal("Search the site"));
    expect(style.backgroundColor).toBe(scopeColor("--popover"));
    expect(style.backgroundColor).not.toBe(scopeColor("--background"));
  });

  it("keeps Popover.Content on the popover", async () => {
    render(
      <Scope variant="external">
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Content aria-label="Price details">Monthly fee and spot price.</Popover.Content>
        </Popover.Root>
      </Scope>
    );
    const style = getComputedStyle(await openModal("Price details"));
    expect(style.backgroundColor).toBe(scopeColor("--popover"));
  });

  it("keeps Select.Content on the popover", async () => {
    render(
      <Scope variant="external">
        <Select.Root items={{ fixed: "Fixed price", spot: "Spot price" }}>
          <Select.Trigger aria-label="Agreement">
            <Select.Value placeholder="Pick an agreement" />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="fixed">Fixed price</Select.Item>
            <Select.Item value="spot">Spot price</Select.Item>
          </Select.Content>
        </Select.Root>
      </Scope>
    );
    await userEvent.click(roleNamed("combobox", "Agreement"));
    await expect.element(page.getByRole("listbox")).toBeVisible();
    // DOM audit: the listbox sits inside the popup, which paints the fill and has no role of its own.
    const popup = page.getByRole("listbox").element().closest('[data-slot="select-content"]');
    if (!(popup instanceof HTMLElement)) throw new Error("expected the Select popup");
    expect(getComputedStyle(popup).backgroundColor).toBe(scopeColor("--popover"));
  });

  it("keeps the mobile Sidebar sheet on the sidebar fill", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    let isMobile = false;
    render(
      <Scope variant="external">
        <Sidebar.Provider>
          <Sidebar.Root>
            <Sidebar.Content />
          </Sidebar.Root>
          <Sidebar.Inset>
            <Sidebar.Trigger />
            <ContextProbe
              onValue={(value) => {
                isMobile = value.isMobile;
              }}
            />
          </Sidebar.Inset>
        </Sidebar.Provider>
      </Scope>
    );
    // The provider reads the viewport after mount, so the trigger opens the Sheet only then.
    await vi.waitFor(() => {
      expect(isMobile).toBe(true);
    });
    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    await expect.element(page.getByRole("dialog", { name: "Sidebar" })).toBeVisible();
    const style = getComputedStyle(roleNamed("dialog", "Sidebar"));
    expect(style.backgroundColor).toBe(scopeColor("--sidebar"));
    expect(style.color).toBe(scopeColor("--sidebar-foreground"));
  });
});
