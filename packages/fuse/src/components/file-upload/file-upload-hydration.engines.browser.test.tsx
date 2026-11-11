// A FileUpload's Field wiring from server HTML to the hydrated tree, in Chromium and WebKit. Units
// under test: FileUpload.Root and FileUpload.Trigger inside a Field.Root. Oracles: HTML's label
// association (`label.control`), which names the Field's Trigger in the server markup as it names
// Base UI's own Select.Trigger, and again once hydrated; and React's hydration contract, no
// recoverable error and no console error, through which React 19 reports attribute mismatches.
import type { ReactElement } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { Field } from "../field/index";
import { FileUpload } from "./index";

function tree(triggerId: string | undefined): ReactElement {
  return (
    <Field.Root>
      <Field.Label>Attachments</Field.Label>
      <FileUpload.Root>
        <FileUpload.Trigger id={triggerId}>Browse files</FileUpload.Trigger>
      </FileUpload.Root>
    </Field.Root>
  );
}

/** The label's control. Before hydration the Trigger has no name to query it by. */
function labelledControl(host: HTMLElement): HTMLElement | null {
  const label = host.querySelector("label");
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error("expected the Field's label");
  }
  return label.control;
}

describe("FileUpload in a Field, hydrated", () => {
  it.each([
    { triggerId: undefined, hydratedId: null },
    { triggerId: "attachments-trigger", hydratedId: "attachments-trigger" },
  ])(
    "pairs the label with the Trigger (id $triggerId) in the server markup and once hydrated",
    async ({ triggerId, hydratedId }) => {
      const element = tree(triggerId);
      const host = document.createElement("div");
      host.innerHTML = renderToString(element);
      document.body.append(host);
      const recover = vi.fn();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      try {
        expect(labelledControl(host)?.textContent).toBe("Browse files");

        root = hydrateRoot(host, element, { onRecoverableError: recover });
        const trigger = page.getByRole("button", { name: "Browse files Attachments", exact: true });
        await expect.element(trigger).toBeInTheDocument();
        if (hydratedId !== null) {
          await expect.element(trigger).toHaveAttribute("id", hydratedId);
        }
        expect(labelledControl(host)).toBe(trigger.element());
        expect(recover).not.toHaveBeenCalled();
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        root?.unmount();
        host.remove();
        consoleError.mockRestore();
      }
    }
  );
});
