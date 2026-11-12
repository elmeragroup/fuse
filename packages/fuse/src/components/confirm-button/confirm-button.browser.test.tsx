import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { expectVisuallyHidden } from "../../../test/visually-hidden";
import { Dialog } from "../dialog";
import { ConfirmButton } from "./confirm-button";

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

describe("ConfirmButton", () => {
  it.each([
    ["the pointer", () => userEvent.click(page.getByRole("button", { name: /^(Delete|Confirm delete)$/ }))],
    [
      "Enter",
      async () => {
        page
          .getByRole("button", { name: /^(Delete|Confirm delete)$/ })
          .element()
          .focus();
        await userEvent.keyboard("{Enter}");
      },
    ],
    [
      "Space",
      async () => {
        page
          .getByRole("button", { name: /^(Delete|Confirm delete)$/ })
          .element()
          .focus();
        await userEvent.keyboard(" ");
      },
    ],
  ] as const)("arms on the first press and confirms once on the second, from %s", async (_input, press) => {
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton onConfirm={onConfirm} armedChildren="Confirm delete">
        Delete
      </ConfirmButton>
    );

    const resting = buttonNamed("Delete");
    expect(resting.hasAttribute("data-armed")).toBe(false);

    await press();
    expect(onConfirm).not.toHaveBeenCalled();
    const armed = buttonNamed("Confirm delete");
    expect(armed.getAttribute("data-armed")).toBe("true");
    expect(armed.hasAttribute("data-armed")).toBe(true);

    await press();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const after = buttonNamed("Delete");
    expect(after.hasAttribute("data-armed")).toBe(false);
    expect(after.getAttribute("data-armed")).toBeNull();

    await press();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");
  });

  // Chrome's page translation swaps each text node for `<font>` wrappers that React does not
  // know about. Arming then threw `NotFoundError` removing the old text node, or wrote the armed
  // text into the detached node and left the translated resting label showing.
  it.each([
    ["text", "Confirm delete"],
    ["an element", <strong key="armed">Confirm delete</strong>],
  ] as const)(
    "shows %s armedChildren after page translation replaced the resting label",
    async (_case, armedChildren) => {
      renderThemed(
        <ConfirmButton onConfirm={() => undefined} armedChildren={armedChildren}>
          Delete
        </ConfirmButton>
      );
      const button = buttonNamed("Delete");
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      const label = walker.nextNode();
      if (label === null) {
        throw new Error("Expected the resting label as a text node");
      }
      const translated = document.createElement("font");
      translated.innerHTML = "<font>Slett</font>";
      label.parentNode?.replaceChild(translated, label);

      await userEvent.click(button);

      expect(button.isConnected).toBe(true);
      expect(button.getAttribute("data-armed")).toBe("true");
      // The visible label, without the visually hidden live region that also says "Confirm delete".
      const visibleLabel = [...button.childNodes]
        .filter((node) => !(node instanceof HTMLElement && node.hasAttribute("aria-live")))
        .map((node) => node.textContent)
        .join("");
      expect(visibleLabel).toBe("Confirm delete");
    }
  );

  it("disarms on Escape without confirming, and still invokes consumer onKeyDown", async () => {
    const onConfirm = vi.fn();
    const onKeyDown = vi.fn();
    renderThemed(
      <ConfirmButton onConfirm={onConfirm} onKeyDown={onKeyDown} armedChildren="Confirm delete">
        Delete
      </ConfirmButton>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    buttonNamed("Confirm delete").focus();
    await userEvent.keyboard("{Escape}");

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(buttonNamed("Delete").hasAttribute("data-armed")).toBe(false);
  });

  it("disarms on the first Escape inside a Dialog and closes the Dialog on the second", async () => {
    const onConfirm = vi.fn();
    renderThemed(
      withLocale(
        "en-US",
        <Dialog.Root>
          <Dialog.Trigger>Open</Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Title>Remove meter</Dialog.Title>
            <ConfirmButton onConfirm={onConfirm} armedChildren="Confirm remove">
              Remove
            </ConfirmButton>
          </Dialog.Content>
        </Dialog.Root>
      )
    );

    // The open modal marks the trigger inert, so keep it to read its open state later.
    const trigger = roleNamed("button", "Open");
    await userEvent.click(trigger);
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(roleNamed("button", "Remove"));
    expect(roleNamed("button", "Confirm remove").getAttribute("data-armed")).toBe("true");

    await userEvent.keyboard("{Escape}");
    expect(roleNamed("button", "Remove").hasAttribute("data-armed")).toBe(false);
    expect(page.getByRole("dialog").query()).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(onConfirm).not.toHaveBeenCalled();

    await userEvent.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
  });

  it.each([
    ["disabled", { disabled: true }, null, true],
    // Pending keeps the button focusable, so it is blocked through aria-disabled instead.
    ["isPending", { isPending: true }, "true", false],
  ] as const)(
    "disarms when %s turns on while armed, and is resting, not confirming, once it clears",
    async (_prop, inert, dataPending, nativelyDisabled) => {
      const onConfirm = vi.fn();

      function Fixture({ inert: inertProps }: { inert?: { disabled?: boolean; isPending?: boolean } }) {
        return (
          <ConfirmButton {...inertProps} onConfirm={onConfirm} armedChildren="Confirm delete">
            Delete
          </ConfirmButton>
        );
      }

      const { rerender } = renderThemed(<Fixture />);
      await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
      expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

      rerender(<Fixture inert={inert} />);
      const blocked = buttonNamed("Delete");
      expect(blocked.hasAttribute("disabled")).toBe(nativelyDisabled);
      expect(blocked.getAttribute("aria-disabled")).toBe(nativelyDisabled ? null : "true");
      expect(blocked.getAttribute("data-pending")).toBe(dataPending);
      expect(blocked.hasAttribute("data-armed")).toBe(false);

      rerender(<Fixture />);
      const reenabled = buttonNamed("Delete");
      expect(reenabled).toBeEnabled();
      expect(reenabled.hasAttribute("data-armed")).toBe(false);

      await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
      expect(onConfirm).not.toHaveBeenCalled();
      expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");
    }
  );

  it("never arms or confirms while isVisuallyDisabled, though presses still land", async () => {
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton isVisuallyDisabled onConfirm={onConfirm} armedChildren="Confirm delete">
        Delete
      </ConfirmButton>
    );

    // Playwright refuses to click aria-disabled targets; force the pointer presses through.
    const button = page.getByRole("button", { name: "Delete", exact: true });
    await userEvent.click(button, { force: true });
    await userEvent.click(button, { force: true });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(buttonNamed("Delete").hasAttribute("data-armed")).toBe(false);

    buttonNamed("Delete").focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Enter}");

    expect(onConfirm).not.toHaveBeenCalled();
    const resting = buttonNamed("Delete");
    expect(resting.hasAttribute("disabled")).toBe(false);
    expect(resting.getAttribute("aria-disabled")).toBe("true");
    expect(resting.hasAttribute("data-armed")).toBe(false);
  });
});

function liveRegion(button: HTMLElement): HTMLElement {
  const live = button.querySelector("[aria-live='polite']");
  if (!(live instanceof HTMLElement)) {
    throw new Error("Expected an aria-live polite announcement");
  }
  return live;
}

describe("ConfirmButton", () => {
  // The announcement chain: armedAriaLabel, then a string armedChildren, then the resting aria-label.
  it.each([
    [
      "armedAriaLabel over string armedChildren and the resting aria-label",
      "Really delete",
      "Confirm delete",
      "Really delete",
    ],
    ["string armedChildren over the resting aria-label", undefined, "Confirm delete", "Confirm delete"],
    [
      "the resting aria-label when armedChildren is not a string",
      undefined,
      <span key="confirm">Confirm</span>,
      "Delete row",
    ],
  ] as const)("announces %s", async (_case, armedAriaLabel, armedChildren, announced) => {
    renderThemed(
      <ConfirmButton
        onConfirm={() => undefined}
        armedAriaLabel={armedAriaLabel}
        armedChildren={armedChildren}
        aria-label="Delete row">
        Delete
      </ConfirmButton>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete row", exact: true }));
    const armed = buttonNamed(announced);
    expect(armed.getAttribute("aria-label")).toBe(announced);
    expect(armed.textContent).toContain("Confirm");
    const live = liveRegion(armed);
    expectVisuallyHidden(live, "announcement");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe(announced);

    await userEvent.keyboard("{Escape}");
    const restored = buttonNamed("Delete row");
    expect(restored.getAttribute("aria-label")).toBe("Delete row");
    expect(restored.querySelector("[aria-live='polite']")).toBeNull();
  });
});
