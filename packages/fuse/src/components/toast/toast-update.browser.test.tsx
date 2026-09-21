import { useLayoutEffect } from "react";

import { expect, it } from "vitest";
import { page } from "vitest/browser";

import { Toast } from "@elmeragroup/fuse/toast";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";

for (const face of ["module", "hook"] as const) {
  it(`${face} manager preserves omitted toast fields and supports explicit clearing`, async () => {
    let manager = Toast.createToastManager();
    function Controls() {
      const hook = Toast.useToastManager();
      useLayoutEffect(() => {
        if (face === "hook") manager = hook;
      }, [hook]);
      return <Toast.Viewport />;
    }
    renderThemed(
      withLocale(
        "en-US",
        <Toast.Provider toastManager={manager} timeout={0}>
          <Controls />
        </Toast.Provider>
      )
    );
    const id = manager.add({ type: "error", title: "Failed", description: "Try again" });
    const surface = () =>
      page
        .getByText("Failed", { exact: true })
        .elements()
        .map((node) => node.closest('[role="dialog"], [role="alertdialog"]'))
        .find(Boolean);
    await expect.poll(() => surface()?.getAttribute("data-status")).toBe("error");
    const icon = surface()?.querySelector("svg")?.innerHTML;
    manager.update(id, { priority: "low" });
    await expect.poll(() => surface()?.getAttribute("data-status")).toBe("error");
    expect(surface()?.querySelector("svg")?.innerHTML).toBe(icon);
    expect(surface()?.textContent).toContain("Failed");
    expect(surface()?.textContent).toContain("Try again");
    manager.update(id, { description: "Retry now" });
    await expect.poll(() => surface()?.textContent).toContain("Retry now");
    expect(surface()?.getAttribute("data-status")).toBe("error");
    manager.update(id, { priority: undefined });
    await expect.poll(() => surface()?.getAttribute("data-status")).toBe("error");
    expect(surface()?.textContent).toContain("Retry now");
    manager.update(id, { type: "success" });
    await expect.poll(() => surface()?.getAttribute("data-status")).toBe("success");
    expect(surface()?.querySelector("svg")?.innerHTML).not.toBe(icon);
    expect(surface()?.textContent).toContain("Failed");
    manager.update(id, { type: undefined, description: undefined });
    await expect.poll(() => surface()?.getAttribute("data-status")).toBe("neutral");
    expect(surface()?.textContent).not.toContain("Retry now");
    expect(surface()?.textContent).toContain("Failed");
  });
}
