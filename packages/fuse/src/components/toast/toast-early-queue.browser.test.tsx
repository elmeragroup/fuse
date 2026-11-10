import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { Toast } from "./index";

type ModuleManager = ReturnType<typeof Toast.createToastManager>;

function providerTree(manager: ModuleManager, children: ReactNode = null) {
  return withLocale(
    "en-US",
    <Toast.Provider toastManager={manager} timeout={0}>
      <Toast.Viewport />
      {children}
    </Toast.Provider>
  );
}

function renderProvider(manager: ModuleManager, children: ReactNode = null) {
  return renderThemed(providerTree(manager, children));
}

/** Each toast's accessible name (its title), in DOM order. Every toast here is low priority. */
function toastTitles(): string[] {
  return page
    .getByRole("dialog")
    .elements()
    .map((root) => document.getElementById(root.getAttribute("aria-labelledby") ?? "")?.textContent ?? "");
}

async function expectTitles(expected: string[]): Promise<void> {
  await vi.waitFor(() => {
    expect(toastTitles()).toEqual(expected);
  });
}

describe("Toast module manager before the provider connects", () => {
  it("replays update and close in call order against ids minted while queued", async () => {
    const manager = Toast.createToastManager();
    const kept = manager.add({ title: "Saving" });
    const dropped = manager.add({ title: "Dropped" });
    manager.update(kept, { title: "Saved" });
    manager.close(dropped);

    renderProvider(manager);

    await expectTitles(["Saved"]);
  });

  it("runs a call made during replay after the calls queued before it", async () => {
    const manager = Toast.createToastManager();
    const later = "later";
    const first = manager.add({
      title: "Closes the later toast",
      onClose: () => {
        manager.close(later);
      },
    });
    manager.close(first);
    manager.add({ id: later, title: "Closed by the first toast" });
    manager.add({ title: "Still open" });

    renderProvider(manager);

    await expectTitles(["Still open"]);
  });
});
