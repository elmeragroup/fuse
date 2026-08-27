import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { renderThemed } from "../../../test/themed-browser-render";
import { Toast } from "./toast";

const CLOSE_COPY = {
  "nb-NO": "Lukk",
  "sv-SE": "Stäng",
  "en-US": "Close",
  "fi-FI": "Sulje",
} as const;

const moduleScopeManager = Toast.createToastManager();

function renderToast(
  node: ReactNode = <Toast.Viewport />,
  options: {
    locale?: (typeof SUPPORTED_LOCALES)[number];
    manager?: ReturnType<typeof Toast.createToastManager>;
    limit?: number;
  } = {}
) {
  const manager = options.manager ?? Toast.createToastManager();
  const result = renderThemed(
    withLocale(
      options.locale ?? "en-US",
      <Toast.Provider toastManager={manager} timeout={0} limit={options.limit}>
        {node}
      </Toast.Provider>
    )
  );
  return { ...result, manager };
}

function queryToastCopy(name: string): HTMLElement | undefined {
  const copy = page
    .getByText(name, { exact: true })
    .elements()
    .find(
      (node) =>
        node.getAttribute("data-slot") === "toast-title" ||
        node.getAttribute("data-slot") === "toast-description"
    );
  return copy instanceof HTMLElement ? copy : undefined;
}

function toastCopy(name: string): HTMLElement {
  const copy = queryToastCopy(name);
  if (copy === undefined) {
    throw new Error(`expected toast copy ${name}`);
  }
  return copy;
}

function toastRootNamed(name: string): HTMLElement {
  const root = toastCopy(name).closest("[data-slot=toast-root]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected toast root for ${name}`);
  }
  return root;
}

async function waitForToast(name: string): Promise<HTMLElement> {
  await vi.waitFor(() => {
    expect(queryToastCopy(name)).toBeTruthy();
  });
  return toastRootNamed(name);
}

async function waitForToastGone(name: string): Promise<void> {
  await vi.waitFor(() => {
    expect(queryToastCopy(name)).toBeUndefined();
  });
}

async function expandViewport(): Promise<HTMLElement> {
  const viewport = page.getByRole("region", { name: "Notifications", exact: true }).element();
  if (!(viewport instanceof HTMLElement)) {
    throw new Error("expected the toast viewport");
  }
  await userEvent.keyboard("{F6}");
  return viewport;
}

describe("Toast manager", () => {
  it("createToastManager dispatches from non-React code", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Toast.Provider toastManager={moduleScopeManager} timeout={0}>
          <Toast.Viewport />
        </Toast.Provider>
      )
    );

    const id = moduleScopeManager.add({
      title: "Saved from module",
      description: "Timer callback.",
      timeout: 0,
    });
    expect(id).toEqual(expect.any(String));
    const root = await waitForToast("Saved from module");
    expect(queryToastCopy("Timer callback.")).toBeTruthy();
    expect(root.getAttribute("data-status")).toBe("neutral");
    moduleScopeManager.close(id);
    await waitForToastGone("Saved from module");
  });

  it("add returns an id, upserts by id, update swaps copy, and close removes one or all", async () => {
    const { manager } = renderToast();

    const first = manager.add({ id: "save", title: "Saving…", description: "Please wait.", timeout: 0 });
    expect(first).toBe("save");
    await waitForToast("Saving…");
    expect(queryToastCopy("Please wait.")).toBeTruthy();

    const upserted = manager.add({ id: "save", title: "Saved", description: "Changes stored.", timeout: 0 });
    expect(upserted).toBe("save");
    await waitForToast("Saved");
    expect(queryToastCopy("Saving…")).toBeUndefined();
    expect(document.querySelectorAll("[data-slot=toast-root]")).toHaveLength(1);

    manager.update("save", { description: "All good." });
    await vi.waitFor(() => {
      expect(queryToastCopy("All good.")).toBeTruthy();
    });

    const extra = manager.add({ title: "Second", timeout: 0 });
    await waitForToast("Second");
    expect(document.querySelectorAll("[data-slot=toast-root]").length).toBeGreaterThan(1);

    manager.close(extra);
    await waitForToastGone("Second");
    expect(queryToastCopy("Saved")).toBeTruthy();

    manager.close();
    await vi.waitFor(() => {
      expect(document.querySelector("[data-slot=toast-root]")).toBeNull();
    });
  });

  it("defaults error to high/alert and other types to low; explicit priority wins", async () => {
    const { manager } = renderToast();

    manager.add({ type: "error", title: "Outage", description: "Grid is down.", timeout: 0 });
    await waitForToast("Outage");
    expect(page.getByRole("alert").element()).toBeTruthy();
    expect(toastRootNamed("Outage").getAttribute("role")).toBe("alertdialog");
    expect(toastRootNamed("Outage").getAttribute("data-status")).toBe("error");
    manager.close();
    await vi.waitFor(() => {
      expect(page.getByRole("alert").query()).toBeNull();
    });

    for (const type of ["info", "success", "warning", "loading"] as const) {
      manager.add({ type, title: type, timeout: 0 });
      const root = await waitForToast(type);
      expect(root.getAttribute("data-status"), type).toBe(type);
      expect(root.getAttribute("role"), type).toBe("dialog");
      expect(page.getByRole("alert").query(), type).toBeNull();
      manager.close();
      await waitForToastGone(type);
    }

    manager.add({ title: "Plain", timeout: 0 });
    const neutral = await waitForToast("Plain");
    expect(neutral.getAttribute("data-status")).toBe("neutral");
    expect(neutral.getAttribute("role")).toBe("dialog");
    expect(neutral.querySelector("[data-toast-icon]")).toBeNull();
    manager.close();
    await waitForToastGone("Plain");

    manager.add({ type: "error", priority: "low", title: "Quiet error", timeout: 0 });
    const quiet = await waitForToast("Quiet error");
    expect(quiet.getAttribute("role")).toBe("dialog");
    expect(page.getByRole("alert").query()).toBeNull();
    manager.close();
    await waitForToastGone("Quiet error");

    manager.add({ type: "success", priority: "high", title: "Loud success", timeout: 0 });
    const loud = await waitForToast("Loud success");
    expect(loud.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
  });

  it("promise walks loading → success and loading → error, with state-level priority overrides", async () => {
    const { manager } = renderToast();

    let resolveOk: (value: string) => void = () => {
      throw new Error("unresolved");
    };
    const ok = new Promise<string>((resolve) => {
      resolveOk = resolve;
    });
    const successPromise = manager.promise(ok, {
      loading: "Saving…",
      success: { title: "Saved", description: "Stored." },
      error: "Failed",
    });

    const loading = await waitForToast("Saving…");
    expect(loading.getAttribute("data-status")).toBe("loading");
    expect(loading.getAttribute("role")).toBe("dialog");
    expect(loading.querySelector("[data-toast-icon]")).not.toBeNull();
    expect(page.getByRole("alert").query()).toBeNull();

    resolveOk("done");
    await expect(successPromise).resolves.toBe("done");
    const success = await waitForToast("Saved");
    expect(success.getAttribute("data-status")).toBe("success");
    expect(success.getAttribute("role")).toBe("dialog");
    expect(queryToastCopy("Stored.")).toBeTruthy();
    expect(queryToastCopy("Saving…")).toBeUndefined();
    manager.close();
    await waitForToastGone("Saved");

    let rejectErr: (reason: Error) => void = () => {
      throw new Error("unrejected");
    };
    const failing = new Promise<string>((_resolve, reject) => {
      rejectErr = reject;
    });
    const errorPromise = manager.promise(failing, {
      loading: "Uploading…",
      success: "Uploaded",
      error: { title: "Upload failed", description: "Try again." },
    });
    await waitForToast("Uploading…");
    rejectErr(new Error("nope"));
    await expect(errorPromise).rejects.toThrow("nope");
    const errorRoot = await waitForToast("Upload failed");
    expect(errorRoot.getAttribute("data-status")).toBe("error");
    expect(errorRoot.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
    manager.close();
    await waitForToastGone("Upload failed");

    let resolveLoud: (value: string) => void = () => {
      throw new Error("unresolved");
    };
    const loudOk = new Promise<string>((resolve) => {
      resolveLoud = resolve;
    });
    const loudPromise = manager.promise(loudOk, {
      loading: "Working…",
      success: { title: "Loud save", priority: "high" },
      error: { title: "Quiet fail", priority: "low" },
    });
    await waitForToast("Working…");
    resolveLoud("ok");
    await expect(loudPromise).resolves.toBe("ok");
    const loud = await waitForToast("Loud save");
    expect(loud.getAttribute("role")).toBe("alertdialog");
    expect(page.getByRole("alert").element()).toBeTruthy();
    manager.close();
    await waitForToastGone("Loud save");

    let rejectQuiet: (reason: Error) => void = () => {
      throw new Error("unrejected");
    };
    const quietFail = new Promise<string>((_resolve, reject) => {
      rejectQuiet = reject;
    });
    const quietPromise = manager.promise(quietFail, {
      loading: "Working…",
      success: "ok",
      error: { title: "Quiet fail", priority: "low" },
    });
    await waitForToast("Working…");
    rejectQuiet(new Error("nope"));
    await expect(quietPromise).rejects.toThrow("nope");
    const quiet = await waitForToast("Quiet fail");
    expect(quiet.getAttribute("data-status")).toBe("error");
    expect(quiet.getAttribute("role")).toBe("dialog");
    expect(page.getByRole("alert").query()).toBeNull();
  });
});

describe("Toast chrome", () => {
  it("renders actionProps as a button and Close dismisses under en-US", async () => {
    const onAction = vi.fn();
    const { manager } = renderToast();
    manager.add({
      title: "Item deleted",
      timeout: 0,
      actionProps: { children: "Undo", onClick: onAction },
    });
    await waitForToast("Item deleted");
    await expandViewport();

    const action = page.getByRole("button", { name: "Undo", exact: true }).element();
    await userEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);

    const close = page.getByRole("button", { name: "Close", exact: true }).element();
    await userEvent.click(close);
    await waitForToastGone("Item deleted");
  });

  it("renders Close copy in all four locales and lets label override it", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      const manager = Toast.createToastManager();
      const { unmount } = renderToast(<Toast.Viewport />, { locale, manager });
      manager.add({ title: "Notice", timeout: 0 });
      await waitForToast("Notice");
      await expandViewport();
      expect(page.getByRole("button", { name: CLOSE_COPY[locale], exact: true }).query()).not.toBeNull();
      unmount();
    }

    function OverrideClose() {
      const { toasts } = Toast.useToastManager();
      return (
        <Toast.Viewport>
          {toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast}>
              <Toast.Title />
              <Toast.Close label="Dismiss toast" />
            </Toast.Root>
          ))}
        </Toast.Viewport>
      );
    }

    const { manager } = renderToast(<OverrideClose />);
    manager.add({ title: "Override", timeout: 0 });
    await waitForToast("Override");
    await expandViewport();
    expect(page.getByRole("button", { name: "Dismiss toast", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Close", exact: true }).query()).toBeNull();
  });

  it("F6 moves focus into the viewport and Escape restores the prior element", async () => {
    const { manager } = renderToast(
      <>
        <button type="button">Focus start</button>
        <Toast.Viewport />
      </>
    );
    manager.add({ title: "Keyboard toast", timeout: 0 });
    await waitForToast("Keyboard toast");

    const start = page.getByRole("button", { name: "Focus start", exact: true }).element();
    start.focus();
    expect(document.activeElement).toBe(start);

    await userEvent.keyboard("{F6}");
    const viewport = page.getByRole("region", { name: "Notifications", exact: true }).element();
    expect(document.activeElement).toBe(viewport);

    await userEvent.keyboard("{Tab}");
    const root = toastRootNamed("Keyboard toast");
    expect(root.contains(document.activeElement) || document.activeElement === root).toBe(true);

    await userEvent.keyboard("{Escape}");
    await waitForToastGone("Keyboard toast");
    expect(document.activeElement).toBe(start);
  });

  it("passes data-base-ui-swipe-ignore through on an inner element", async () => {
    function SwipeIgnoreList() {
      const { toasts } = Toast.useToastManager();
      return (
        <Toast.Viewport>
          {toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast}>
              <Toast.Title />
              <button type="button" data-base-ui-swipe-ignore>
                Hold
              </button>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      );
    }

    const { manager } = renderToast(<SwipeIgnoreList />);
    manager.add({ title: "Swipe", timeout: 0 });
    await waitForToast("Swipe");
    const hold = page.getByRole("button", { name: "Hold", exact: true }).element();
    expect(hold.getAttribute("data-base-ui-swipe-ignore")).not.toBeNull();
  });
});

describe("Toast overlay containment", () => {
  it("portals the viewport into the enclosing ThemeScope instead of the document body", async () => {
    const { host, manager } = renderToast();
    manager.add({ title: "Scoped", timeout: 0 });
    const root = await waitForToast("Scoped");
    const scope = host.querySelector("[data-theme-brand]");
    expect(scope).not.toBeNull();
    expect(scope?.contains(root)).toBe(true);
    expect([...document.body.children].includes(root)).toBe(false);
  });

  it("portals the viewport into an explicit container element", async () => {
    const manager = Toast.createToastManager();

    function ExplicitContainer() {
      const [node, setNode] = useState<HTMLDivElement | null>(null);
      return (
        <>
          <div ref={setNode} role="region" aria-label="Theme island" />
          {node ? (
            <Toast.Provider toastManager={manager} timeout={0}>
              <Toast.Viewport container={node} />
            </Toast.Provider>
          ) : null}
        </>
      );
    }

    renderThemed(withLocale("en-US", <ExplicitContainer />));
    manager.add({ title: "Islanded", timeout: 0 });
    const root = await waitForToast("Islanded");
    const island = page.getByRole("region", { name: "Theme island", exact: true }).element();
    expect(island.contains(root)).toBe(true);
    expect([...document.body.children].includes(root)).toBe(false);
  });

  it("waits while the resolved Viewport container element is still null", () => {
    function NeverAttached() {
      const ref = useRef<HTMLElement | null>(null);
      const manager = Toast.useToastManager();
      return (
        <>
          <button type="button" onClick={() => manager.add({ title: "Pending", timeout: 0 })}>
            Add
          </button>
          <Toast.Viewport container={ref} />
        </>
      );
    }

    renderThemed(
      withLocale(
        "en-US",
        <Toast.Provider timeout={0}>
          <NeverAttached />
        </Toast.Provider>
      )
    );

    expect(document.querySelector("[data-slot=toast-viewport]")).toBeNull();
    expect(document.querySelector("[data-slot=toast-root]")).toBeNull();
    expect(page.getByRole("region", { name: "Notifications", exact: true }).query()).toBeNull();
  });
});
