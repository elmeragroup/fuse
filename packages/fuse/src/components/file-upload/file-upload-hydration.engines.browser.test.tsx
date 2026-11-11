// A FileUpload's Field wiring from server HTML to the hydrated tree, in Chromium and WebKit. Units
// under test: FileUpload.Root and FileUpload.Trigger inside a Field.Root. Oracles: HTML's label
// association (`label.control`), which names the Field's Trigger in the server markup as it names
// Base UI's own Select.Trigger, and again once hydrated; and React's hydration contract, no
// recoverable error.
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { Field } from "../field/index";
import { FileUpload } from "./index";

const tree = (
  <Field.Root>
    <Field.Label>Attachments</Field.Label>
    <FileUpload.Root>
      <FileUpload.Trigger>Browse files</FileUpload.Trigger>
    </FileUpload.Root>
  </Field.Root>
);

/** The label's control. Before hydration the Trigger has no name to query it by. */
function labelledControl(host: HTMLElement): HTMLElement | null {
  const label = host.querySelector("label");
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error("expected the Field's label");
  }
  return label.control;
}

describe("FileUpload in a Field, hydrated", () => {
  it("pairs the label with the Trigger in the server markup and once hydrated", async () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(tree);
    document.body.append(host);
    const recover = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      expect(labelledControl(host)?.textContent).toBe("Browse files");

      root = hydrateRoot(host, tree, { onRecoverableError: recover });
      const trigger = page.getByRole("button", { name: "Browse files Attachments", exact: true });
      await expect.element(trigger).toBeInTheDocument();
      expect(labelledControl(host)).toBe(trigger.element());
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root?.unmount();
      host.remove();
    }
  });
});
