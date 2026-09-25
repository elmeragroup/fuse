import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { renderThemed } from "../../../test/themed-browser-render";
import { ConfirmButton } from "./confirm-button";

function buttonNamed(name: string): HTMLElement {
  const element = page.getByRole("button", { name, exact: true }).element();
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected an HTML button named ${name}`);
  }
  return element;
}

function liveRegion(button: HTMLElement): HTMLElement {
  const live = button.querySelector("[aria-live='polite']");
  if (!(live instanceof HTMLElement)) {
    throw new Error("Expected an aria-live polite announcement");
  }
  return live;
}

describe("ConfirmButton", () => {
  it("arms on the first click and confirms once on the second", async () => {
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton onConfirm={onConfirm} armedChildren="Confirm delete">
        Delete
      </ConfirmButton>
    );

    const resting = buttonNamed("Delete");
    expect(resting.hasAttribute("data-armed")).toBe(false);

    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    const armed = buttonNamed("Confirm delete");
    expect(armed.getAttribute("data-armed")).toBe("true");
    expect(armed.hasAttribute("data-armed")).toBe(true);

    await userEvent.click(page.getByRole("button", { name: "Confirm delete", exact: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const after = buttonNamed("Delete");
    expect(after.hasAttribute("data-armed")).toBe(false);
    expect(after.getAttribute("data-armed")).toBeNull();
  });

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

  it("disarms on blur when tabbing away, and stays resting on refocus", async () => {
    const onConfirm = vi.fn();
    const onBlur = vi.fn();
    renderThemed(
      <>
        <ConfirmButton onConfirm={onConfirm} onBlur={onBlur} armedChildren="Confirm delete">
          Delete
        </ConfirmButton>
        <button type="button">Next</button>
      </>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

    await userEvent.tab();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
    expect(document.activeElement).toBe(buttonNamed("Next"));

    const resting = buttonNamed("Delete");
    expect(resting.hasAttribute("data-armed")).toBe(false);
    resting.focus();
    expect(buttonNamed("Delete").hasAttribute("data-armed")).toBe(false);
  });

  it("announces armedAriaLabel over string armedChildren and the resting aria-label", async () => {
    renderThemed(
      <ConfirmButton
        onConfirm={() => undefined}
        armedAriaLabel="Really delete"
        armedChildren="Confirm delete"
        aria-label="Delete row">
        Delete
      </ConfirmButton>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete row", exact: true }));
    const labelled = buttonNamed("Really delete");
    expect(labelled.getAttribute("aria-label")).toBe("Really delete");
    const labelledLive = liveRegion(labelled);
    expect(labelledLive.classList.contains("sr-only")).toBe(true);
    expect(labelledLive.getAttribute("aria-live")).toBe("polite");
    expect(labelledLive.textContent).toBe("Really delete");
  });

  it("announces string armedChildren over the resting aria-label", async () => {
    renderThemed(
      <ConfirmButton onConfirm={() => undefined} armedChildren="Confirm delete" aria-label="Delete row">
        Delete
      </ConfirmButton>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete row", exact: true }));
    const fromChildren = buttonNamed("Confirm delete");
    expect(fromChildren.getAttribute("aria-label")).toBe("Confirm delete");
    expect(liveRegion(fromChildren).textContent).toBe("Confirm delete");

    await userEvent.keyboard("{Escape}");
    const restored = buttonNamed("Delete row");
    expect(restored.getAttribute("aria-label")).toBe("Delete row");
    expect(restored.querySelector("[aria-live='polite']")).toBeNull();
  });

  it("announces the resting aria-label when armedChildren is not a string", async () => {
    renderThemed(
      <ConfirmButton onConfirm={() => undefined} armedChildren={<span>Confirm</span>} aria-label="Delete row">
        Delete
      </ConfirmButton>
    );

    await userEvent.click(page.getByRole("button", { name: "Delete row", exact: true }));
    const fromResting = buttonNamed("Delete row");
    expect(fromResting.getAttribute("aria-label")).toBe("Delete row");
    expect(fromResting.textContent).toContain("Confirm");
    expect(liveRegion(fromResting).textContent).toBe("Delete row");
  });

  it("resets armed state when disabled flips true so re-enabling is always resting", async () => {
    const onConfirm = vi.fn();

    function Fixture({ disabled = false }: { disabled?: boolean }) {
      return (
        <ConfirmButton disabled={disabled} onConfirm={onConfirm} armedChildren="Confirm delete">
          Delete
        </ConfirmButton>
      );
    }

    const { rerender } = renderThemed(<Fixture />);
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

    rerender(<Fixture disabled />);
    const disabled = buttonNamed("Delete");
    expect(disabled).toBeDisabled();
    expect(disabled.hasAttribute("data-armed")).toBe(false);

    rerender(<Fixture />);
    const reenabled = buttonNamed("Delete");
    expect(reenabled).toBeEnabled();
    expect(reenabled.hasAttribute("data-armed")).toBe(false);

    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");
  });

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
    expect(resting.querySelector("[aria-live='polite']")).toBeNull();
  });

  it("disarms when isPending turns on while armed, and re-arms without confirming once it clears", async () => {
    const onConfirm = vi.fn();

    function Fixture({ isPending = false }: { isPending?: boolean }) {
      return (
        <ConfirmButton isPending={isPending} onConfirm={onConfirm} armedChildren="Confirm delete">
          Delete
        </ConfirmButton>
      );
    }

    const { rerender } = renderThemed(<Fixture />);
    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

    rerender(<Fixture isPending />);
    const pending = buttonNamed("Delete");
    expect(pending).toBeDisabled();
    expect(pending.getAttribute("data-pending")).toBe("true");
    expect(pending.hasAttribute("data-armed")).toBe(false);

    rerender(<Fixture />);
    const settled = buttonNamed("Delete");
    expect(settled).toBeEnabled();
    expect(settled.hasAttribute("data-armed")).toBe(false);

    await userEvent.click(page.getByRole("button", { name: "Delete", exact: true }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");
  });

  it("drives the same two-press flow from Enter and Space", async () => {
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton onConfirm={onConfirm} armedChildren="Confirm delete">
        Delete
      </ConfirmButton>
    );

    buttonNamed("Delete").focus();
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

    await userEvent.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(buttonNamed("Delete").hasAttribute("data-armed")).toBe(false);

    buttonNamed("Delete").focus();
    await userEvent.keyboard(" ");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(buttonNamed("Confirm delete").getAttribute("data-armed")).toBe("true");

    await userEvent.keyboard(" ");
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(buttonNamed("Delete").hasAttribute("data-armed")).toBe(false);
  });
});
