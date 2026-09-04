import { useRef } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { AlertDialog } from "./alert-dialog";

const CANCEL_COPY = {
  "nb-NO": "Avbryt",
  "sv-SE": "Avbryt",
  "en-US": "Cancel",
  "fi-FI": "Peruuta",
} as const;

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

const TITLE = "Delete this order?";
const ACTION = "Delete";
const BODY = "This permanently removes the order.";

function ConfirmDialog({
  onOpenChange,
  title = TITLE,
  actionLabel = ACTION,
  children = BODY,
  ...contentProps
}: {
  onOpenChange?: (open: boolean) => void;
  title?: string;
  actionLabel?: string;
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "destructive" | "neutral";
  cancelLabel?: string;
  onAction?: () => void;
  onCancel?: () => void;
  isPerformingAction?: boolean;
  isActionDisabled?: boolean;
  isAutomaticallyCloseOnActionEnabled?: boolean;
}) {
  return (
    <AlertDialog.Root onOpenChange={onOpenChange}>
      <AlertDialog.Trigger>Delete order</AlertDialog.Trigger>
      <AlertDialog.Content title={title} actionLabel={actionLabel} {...contentProps}>
        {children}
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

async function openConfirm(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Delete order", exact: true }).element());
  const dialog = page.getByRole("alertdialog", { name: TITLE }).element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  return dialog;
}

describe("AlertDialog", () => {
  it("opens as alertdialog named by its title, not as dialog, and wires describedby", async () => {
    const onOpenChange = vi.fn();
    renderThemed(withLocale("en-US", <ConfirmDialog onOpenChange={onOpenChange} />));

    const dialog = await openConfirm();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(dialog.getAttribute("role")).toBe("alertdialog");
    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const description = page.getByText(BODY, { exact: true }).element();
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("focuses the action button on open, traps focus, and restores the trigger on Escape", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Behind</button>
          <ConfirmDialog />
        </>
      )
    );
    const trigger = page.getByRole("button", { name: "Delete order", exact: true }).element();
    const behind = page.getByRole("button", { name: "Behind", exact: true }).element();
    const dialog = await openConfirm();
    const action = page.getByRole("button", { name: ACTION, exact: true }).element();
    expect(document.activeElement).toBe(action);

    const tabbables = [...dialog.querySelectorAll<HTMLElement>("button")];
    expect(tabbables.length).toBeGreaterThan(1);
    const first = tabbables[0];
    const last = tabbables.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error("expected tabbable controls");
    }

    last.focus();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(last);
    });
    await userEvent.keyboard("{Tab}");
    await vi.waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(first);
    });

    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(last);
    });
    expect(behind.contains(document.activeElement)).toBe(false);

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("alertdialog").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("fires onAction without closing by default, and closes when close-on-action is enabled", async () => {
    const onAction = vi.fn();
    const { rerender } = renderThemed(withLocale("en-US", <ConfirmDialog onAction={onAction} />));
    await openConfirm();
    await userEvent.click(page.getByRole("button", { name: ACTION, exact: true }).element());
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(page.getByRole("alertdialog", { name: TITLE }).element()).toBeTruthy();

    rerender(withLocale("en-US", <ConfirmDialog onAction={onAction} isAutomaticallyCloseOnActionEnabled />));
    await openConfirm();
    await userEvent.click(page.getByRole("button", { name: ACTION, exact: true }).element());
    await vi.waitFor(() => {
      expect(page.getByRole("alertdialog").query()).toBeNull();
    });
    expect(onAction).toHaveBeenCalledTimes(2);
  });

  it("fires onCancel and always closes from the cancel button", async () => {
    const onCancel = vi.fn();
    renderThemed(withLocale("en-US", <ConfirmDialog onCancel={onCancel} />));
    await openConfirm();
    await userEvent.click(page.getByRole("button", { name: "Cancel", exact: true }).element());
    expect(onCancel).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(page.getByRole("alertdialog").query()).toBeNull();
    });
  });

  it("resolves cancel copy from the dictionary in every locale and lets cancelLabel win", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(withLocale(locale, <ConfirmDialog />));
      await openConfirm();
      expect(
        page.getByRole("button", { name: CANCEL_COPY[locale], exact: true }).element(),
        locale
      ).toBeTruthy();
      unmount();
    }

    const { unmount } = renderThemed(withLocale("nb-NO", <ConfirmDialog cancelLabel="Keep it" />));
    await openConfirm();
    expect(page.getByRole("button", { name: "Keep it", exact: true }).element()).toBeTruthy();
    expect(page.getByRole("button", { name: "Avbryt", exact: true }).query()).toBeNull();
    unmount();
  });

  it("shows Button pending on the action while cancel stays enabled", async () => {
    renderThemed(withLocale("en-US", <ConfirmDialog isPerformingAction />));
    await openConfirm();
    const action = page.getByRole("button", { name: ACTION, exact: true }).element();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true }).element();
    expect(action.hasAttribute("data-pending")).toBe(true);
    await expect.element(page.getByRole("button", { name: ACTION, exact: true })).toBeDisabled();
    expect(cancel.hasAttribute("disabled")).toBe(false);
  });

  it("disables the action button without disabling cancel", async () => {
    renderThemed(withLocale("en-US", <ConfirmDialog isActionDisabled />));
    await openConfirm();
    const action = page.getByRole("button", { name: ACTION, exact: true }).element();
    const cancel = page.getByRole("button", { name: "Cancel", exact: true }).element();
    expect(action.hasAttribute("data-pending")).toBe(false);
    await expect.element(page.getByRole("button", { name: ACTION, exact: true })).toBeDisabled();
    expect(cancel.hasAttribute("disabled")).toBe(false);
  });

  it("renders no corner close button in any locale", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(withLocale(locale, <ConfirmDialog />));
      await openConfirm();
      expect(page.getByRole("button", { name: CLOSE_COPY[locale], exact: true }).query(), locale).toBeNull();
      unmount();
    }
  });

  it("stamps the load-bearing action-type hooks on both buttons", async () => {
    renderThemed(withLocale("en-US", <ConfirmDialog />));
    await openConfirm();
    expect(
      page
        .getByRole("button", { name: ACTION, exact: true })
        .element()
        .getAttribute("data-dialog-action-type")
    ).toBe("primary");
    expect(
      page
        .getByRole("button", { name: "Cancel", exact: true })
        .element()
        .getAttribute("data-dialog-action-type")
    ).toBe("secondary");
  });

  it("maps variant onto the action button and fallback icon, and lets icon replace the fallback", async () => {
    const { unmount: unmountDestructive } = renderThemed(withLocale("en-US", <ConfirmDialog />));
    const destructive = await openConfirm();
    const destructiveAction = page.getByRole("button", { name: ACTION, exact: true }).element();
    expect(destructiveAction.className).toContain("bg-error/10");
    const destructiveIcon = destructive.querySelector("svg");
    expect(destructiveIcon).not.toBeNull();
    expect(destructiveIcon?.classList.contains("text-error")).toBe(true);
    expect(destructiveIcon?.classList.contains("size-5")).toBe(true);
    unmountDestructive();

    const { unmount: unmountNeutral } = renderThemed(
      withLocale("en-US", <ConfirmDialog variant="neutral" />)
    );
    const neutral = await openConfirm();
    const neutralAction = page.getByRole("button", { name: ACTION, exact: true }).element();
    expect(neutralAction.className).toContain("bg-primary");
    expect(neutralAction.className).not.toContain("bg-error/10");
    const neutralIcon = neutral.querySelector("svg");
    expect(neutralIcon).not.toBeNull();
    expect(neutralIcon?.classList.contains("text-error")).toBe(false);
    expect(neutralIcon?.classList.contains("size-5")).toBe(true);
    unmountNeutral();

    renderThemed(withLocale("en-US", <ConfirmDialog icon={<span>Custom mark</span>} />));
    const custom = await openConfirm();
    expect(page.getByText("Custom mark", { exact: true }).element()).toBeTruthy();
    expect(custom.querySelector("svg")).toBeNull();
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(withLocale("en-US", <ConfirmDialog />));
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openConfirm();
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("waits while the resolved container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <AlertDialog.Root open>
          <AlertDialog.Content container={ref} title="Pending" actionLabel="Confirm">
            Waiting for the container.
          </AlertDialog.Content>
        </AlertDialog.Root>
      );
    }
    renderThemed(withLocale("en-US", <NeverAttached />));

    expect(page.getByRole("alertdialog").query()).toBeNull();
    expect(document.querySelector("[data-slot=dialog-content]")).toBeNull();
    expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    renderThemed(
      withLocale(
        "en-US",
        <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
          <AlertDialog.Root open>
            <AlertDialog.Content title="Scoped" actionLabel="Confirm">
              Stay inside the scope.
            </AlertDialog.Content>
          </AlertDialog.Root>
        </ThemeScope>
      )
    );
    const dialog = page.getByRole("alertdialog").element();
    const scope = dialog.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
    expect([...document.body.children].includes(dialog)).toBe(false);
  });
});
