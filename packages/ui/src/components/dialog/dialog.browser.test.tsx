import { useRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { assertFocusRingOnKeyboardAbsentOnMouse } from "../../../test/assert-focus-ring";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme/theme-scope";
import { Dialog } from "./dialog";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

function BasicDialog({
  onOpenChange,
  ...contentProps
}: {
  onOpenChange?: (open: boolean) => void;
  showCloseButton?: boolean;
  closeLabel?: string;
  size?: "sm" | "md" | "10xl";
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange}>
      <Dialog.Trigger>Open terms</Dialog.Trigger>
      <Dialog.Content {...contentProps}>
        <Dialog.Header>
          <Dialog.Title>Contract terms</Dialog.Title>
          <Dialog.Description>Read before you sign.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Close>Decline</Dialog.Close>
      </Dialog.Content>
    </Dialog.Root>
  );
}

async function openDialog(): Promise<HTMLElement> {
  await userEvent.click(page.getByRole("button", { name: "Open terms", exact: true }).element());
  const dialog = page.getByRole("dialog").element();
  if (!(dialog instanceof HTMLElement)) {
    throw new Error("expected the popup");
  }
  return dialog;
}

describe("Dialog", () => {
  it("opens from the trigger, is named by its Title, and reports open state", async () => {
    const onOpenChange = vi.fn();
    renderThemed(withLocale("en-US", <BasicDialog onOpenChange={onOpenChange} />));

    const dialog = await openDialog();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(true);
    expect(page.getByRole("dialog", { name: "Contract terms" }).element()).toBe(dialog);
    expect(dialog.getAttribute("data-slot")).toBe("dialog-content");

    const description = page.getByText("Read before you sign.", { exact: true }).element();
    expect(dialog.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderThemed(withLocale("en-US", <BasicDialog />));
    const trigger = page.getByRole("button", { name: "Open terms", exact: true }).element();
    await openDialog();

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("traps focus inside the popup and wraps in both directions", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Behind</button>
          <BasicDialog />
        </>
      )
    );
    const behind = page.getByRole("button", { name: "Behind", exact: true }).element();
    const dialog = await openDialog();
    expect(dialog.contains(document.activeElement)).toBe(true);

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
  });

  it("focuses the popup itself and paints the shared ring when nothing inside is tabbable", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Dialog.Root>
          <Dialog.Trigger>Open notice</Dialog.Trigger>
          <Dialog.Content showCloseButton={false}>
            <Dialog.Title>Notice</Dialog.Title>
          </Dialog.Content>
        </Dialog.Root>
      )
    );
    const trigger = page.getByRole("button", { name: "Open notice", exact: true }).element();
    if (!(trigger instanceof HTMLElement)) {
      throw new Error("expected the trigger");
    }
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const dialog = page.getByRole("dialog").element();
    expect(document.activeElement).toBe(dialog);
    if (!(dialog instanceof HTMLElement)) {
      throw new Error("expected the popup");
    }
    expect(getComputedStyle(dialog).getPropertyValue("--tw-ring-offset-width")).toBe("2px");
  });

  it("closes from the corner button and drops it when showCloseButton is false", async () => {
    const { rerender } = renderThemed(withLocale("en-US", <BasicDialog />));
    await openDialog();
    const corner = page.getByRole("button", { name: "Close", exact: true }).element();
    expect(corner.getAttribute("data-slot")).toBe("dialog-close");
    expect(corner.querySelector("svg")).not.toBeNull();
    expect(corner.getAttribute("aria-label")).toBe("Close");
    expect(corner.className).toContain("hit-area-1");
    await userEvent.click(corner);
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });

    rerender(withLocale("en-US", <BasicDialog showCloseButton={false} />));
    await openDialog();
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
  });

  it("renders the corner close button in every locale and lets closeLabel win", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { unmount } = renderThemed(withLocale(locale, <BasicDialog />));
      await openDialog();
      expect(
        page.getByRole("button", { name: CLOSE_COPY[locale], exact: true }).element(),
        locale
      ).toBeTruthy();
      unmount();
    }

    const { unmount } = renderThemed(withLocale("nb-NO", <BasicDialog closeLabel="Avslutt" />));
    await openDialog();
    expect(page.getByRole("button", { name: "Avslutt", exact: true }).element()).toBeTruthy();
    expect(page.getByRole("button", { name: "Lukk", exact: true }).query()).toBeNull();
    unmount();
  });

  it("renders the Footer close action with the locale label and closes with it", async () => {
    renderThemed(
      withLocale(
        "sv-SE",
        <Dialog.Root>
          <Dialog.Trigger>Open invoice</Dialog.Trigger>
          <Dialog.Content showCloseButton={false}>
            <Dialog.Title>Invoice</Dialog.Title>
            <Dialog.Footer showCloseButton />
          </Dialog.Content>
        </Dialog.Root>
      )
    );
    await userEvent.click(page.getByRole("button", { name: "Open invoice", exact: true }).element());
    const footerClose = page.getByRole("button", { name: "Stäng", exact: true }).element();
    expect(footerClose.getAttribute("data-slot")).toBe("button");
    expect(footerClose.textContent).toBe("Stäng");

    await userEvent.click(footerClose);
    await vi.waitFor(() => {
      expect(page.getByRole("dialog").query()).toBeNull();
    });
  });

  it("overrides the Footer close label from closeLabel", async () => {
    renderThemed(
      withLocale(
        "nb-NO",
        <Dialog.Root>
          <Dialog.Trigger>Open invoice</Dialog.Trigger>
          <Dialog.Content showCloseButton={false}>
            <Dialog.Title>Invoice</Dialog.Title>
            <Dialog.Footer showCloseButton closeLabel="Ikke nå" />
          </Dialog.Content>
        </Dialog.Root>
      )
    );
    await userEvent.click(page.getByRole("button", { name: "Open invoice", exact: true }).element());
    expect(page.getByRole("button", { name: "Ikke nå", exact: true }).element()).toBeTruthy();
  });

  it("maps the size axis onto the popup max-width", async () => {
    const cases = [
      { size: undefined, expected: "[--overlay-width:min(var(--container-md),90%)]" },
      { size: "sm", expected: "[--overlay-width:min(var(--container-sm),90%)]" },
      { size: "10xl", expected: "[--overlay-width:min(1920px,90%)]" },
    ] as const;

    for (const { size, expected } of cases) {
      const { unmount } = renderThemed(withLocale("en-US", <BasicDialog size={size} />));
      const dialog = await openDialog();
      expect(dialog.className, expected).toContain(expected);
      expect(dialog.className).toContain("max-w-(--overlay-width)");
      unmount();
    }
  });

  it("portals into the enclosing ThemeScope instead of the document body", async () => {
    const { host } = renderThemed(withLocale("en-US", <BasicDialog />));
    const scope = host.querySelector("[data-theme-brand]");
    const dialog = await openDialog();
    expect(scope).not.toBeNull();
    expect(scope?.contains(dialog)).toBe(true);
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("waits while the resolved container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <Dialog.Root open>
          <Dialog.Content container={ref}>
            <Dialog.Title>Pending</Dialog.Title>
          </Dialog.Content>
        </Dialog.Root>
      );
    }
    renderThemed(withLocale("en-US", <NeverAttached />));

    expect(page.getByRole("dialog").query()).toBeNull();
    expect(document.querySelector("[data-slot=dialog-content]")).toBeNull();
    expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull();
  });

  it("does not paint the popup outside a ThemeScope element that has not attached yet", () => {
    // A ThemeScope publishes `null` until its callback ref runs; the render below is the
    // first commit, so the popup must not appear in the document body meanwhile.
    renderThemed(
      withLocale(
        "en-US",
        <ThemeScope theme={{ variant: "external", brand: "fkas", segment: "private" }}>
          <Dialog.Root open>
            <Dialog.Content>
              <Dialog.Title>Scoped</Dialog.Title>
            </Dialog.Content>
          </Dialog.Root>
        </ThemeScope>
      )
    );
    const dialog = page.getByRole("dialog").element();
    const scope = dialog.closest("[data-theme-variant=external]");
    expect(scope).not.toBeNull();
    expect([...document.body.children].includes(dialog)).toBe(false);
  });

  it("keeps Escape and backdrop clicks inert for a non-dismissible dialog", async () => {
    // base-ui 1.6.0 spells the spec's `dismissible={false}` as `disablePointerDismissal`
    // plus cancelling the escape-key close reason; Root forwards both verbatim.
    renderThemed(
      withLocale(
        "en-US",
        <Dialog.Root
          disablePointerDismissal
          onOpenChange={(open, eventDetails) => {
            if (!open && eventDetails.reason === "escape-key") {
              eventDetails.cancel();
            }
          }}>
          <Dialog.Trigger>Open terms</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Contract terms</Dialog.Title>
          </Dialog.Content>
        </Dialog.Root>
      )
    );
    await openDialog();

    await userEvent.keyboard("{Escape}");
    expect(page.getByRole("dialog").element()).toBeTruthy();

    const overlay = document.querySelector("[data-slot=dialog-overlay]");
    if (!(overlay instanceof HTMLElement)) {
      throw new Error("expected the backdrop");
    }
    await userEvent.click(overlay, { position: { x: 2, y: 2 } });
    expect(page.getByRole("dialog").element()).toBeTruthy();
  });

  it("gives the trigger the shared keyboard focus ring", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <button type="button">Before</button>
          <BasicDialog />
        </>
      )
    );
    const previous = page.getByRole("button", { name: "Before", exact: true }).element();
    const trigger = page.getByRole("button", { name: "Open terms", exact: true }).element();
    if (!(previous instanceof HTMLElement) || !(trigger instanceof HTMLElement)) {
      throw new Error("expected buttons");
    }
    await assertFocusRingOnKeyboardAbsentOnMouse(previous, trigger);
  });
});
