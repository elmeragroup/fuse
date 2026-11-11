// ListDetail's two layouts and the changes between them. Unit under test: ListDetail.Root and its
// parts, sized through the width of the root's parent. Oracles: the documented breakpoint,
// Tailwind's `@4xl` container size of 56rem, measured as a container query measures it (layout
// width, rem at the root font size); the complementary landmark and the dialog, each named by the
// Title or else the Detail's `aria-label`; and the documented layout rules, which keep the detail
// and focus where the user was.
import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { withLocale } from "../../../test/locale-matrix";
import { popupFocusRestored } from "../../../test/popup-focus";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { AlertDialog } from "../alert-dialog";
import { DropdownMenu } from "../dropdown-menu";
import { ListDetail } from "./index";
import type { ListDetailDetailProps, ListDetailRootProps, ListDetailSplit } from "./list-detail";

/** 56rem at the 16px root font size the suite pins: the default `4xl` split. */
const SPLIT_PX = 56 * 16;

beforeEach(() => {
  document.documentElement.style.fontSize = "16px";
});

afterEach(() => {
  document.documentElement.style.removeProperty("font-size");
});

type HarnessProps = {
  readonly width: number;
  readonly initiallyOpen?: boolean;
  readonly split?: ListDetailSplit;
  readonly titled?: boolean;
  /** Styles the frame's wrapper, such as a transform. */
  readonly around?: CSSProperties;
  /** Receives the mounted detail element through the Detail's `ref`. */
  readonly detailRef?: ListDetailDetailProps["ref"];
};

/**
 * A list with one item and the open item's detail, its open state and split held like an app
 * holds them. Search shows the list as a wide table that never splits; Search order also opens an
 * item there in the same change, as a jump from a command palette does.
 */
function Harness({ width, initiallyOpen = false, split, titled = true, around, detailRef }: HarnessProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const [view, setView] = useState<ListDetailSplit | undefined>(split);
  const [resolved, setResolved] = useState(false);
  // Unset unless a case passes one, so the other cases exercise the default split.
  const splitProps: Pick<ListDetailRootProps, "split"> = {};
  if (view !== undefined) {
    splitProps.split = view;
  }
  return (
    <div style={around}>
      <div data-testid="frame" style={{ width, height: 400, display: "flex" }}>
        <ListDetail.Root open={open} onOpenChange={setOpen} className="flex-1" {...splitProps}>
          <ListDetail.List>
            <button
              type="button"
              onClick={() => {
                setOpen(true);
              }}>
              Order 4012
            </button>
            <button type="button">Refresh</button>
            <button
              type="button"
              onClick={() => {
                setView("never");
              }}>
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setView("never");
                setOpen(true);
              }}>
              Search order
            </button>
            <p data-testid="open-state">{open ? "open" : "closed"}</p>
          </ListDetail.List>
          <ListDetail.Detail aria-label="Order details" ref={detailRef}>
            {titled ? <ListDetail.Title>Henrik Aasen</ListDetail.Title> : null}
            <label>
              Comment
              <input />
            </label>
            <button
              type="button"
              onClick={() => {
                setView((current) => (current === "never" ? "4xl" : "never"));
              }}>
              Switch view
            </button>
            {resolved ? null : (
              <button
                type="button"
                onClick={() => {
                  setResolved(true);
                }}>
                Resolve
              </button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>More actions</DropdownMenu.Trigger>
              <DropdownMenu.Content>
                <DropdownMenu.Item>Copy order number</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <AlertDialog.Root>
              <AlertDialog.Trigger>Cancel order</AlertDialog.Trigger>
              <AlertDialog.Content
                title="Cancel order 4012?"
                actionLabel="Cancel order"
                cancelLabel="Keep order">
                Henrik Aasen gets no contract.
              </AlertDialog.Content>
            </AlertDialog.Root>
            <ListDetail.Close>Close details</ListDetail.Close>
          </ListDetail.Detail>
        </ListDetail.Root>
      </div>
    </div>
  );
}

/**
 * A root at a fixed width whose contents cannot resize it, so a breakpoint change can only come
 * from the root font size.
 */
function FixedRoot({ width }: { readonly width: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width, height: 400, display: "flex" }}>
      <ListDetail.Root open={open} onOpenChange={setOpen} className="flex-1">
        <ListDetail.List>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
            }}>
            Order 4012
          </button>
        </ListDetail.List>
        <ListDetail.Detail>
          <ListDetail.Title>Henrik Aasen</ListDetail.Title>
        </ListDetail.Detail>
      </ListDetail.Root>
    </div>
  );
}

/**
 * Renders `node` into a shadow root that adopts the page's styles, as a host app embedding the
 * list in a web component does. A closed root is reachable only through the returned root.
 *
 * @param mode - The shadow root's mode.
 * @returns The shadow root.
 */
function renderInShadowRoot(node: ReactNode, mode: ShadowRootMode = "open"): ShadowRoot {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode });
  const styles = new CSSStyleSheet();
  styles.replaceSync(
    [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)).join("\n")
  );
  shadow.adoptedStyleSheets = [styles];
  const container = document.createElement("div");
  shadow.append(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(node);
  });
  onTestFinished(() => {
    flushSync(() => {
      root.unmount();
    });
    host.remove();
  });
  return shadow;
}

function frame(): HTMLElement {
  const element = page.getByTestId("frame").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the frame");
  }
  return element;
}

/**
 * Resizes the root's parent, which the root's container query follows, and lays the page out at
 * once: the browser applies the new styles before a size observer can report the change, as it
 * may on its own.
 */
function resize(width: number, target: HTMLElement = frame()): void {
  flushSync(() => {
    target.style.width = `${String(width)}px`;
  });
  void target.offsetWidth;
}

function openState(): string | null {
  return page.getByTestId("open-state").element().textContent;
}

const complementary = () => page.getByRole("complementary");
const dialog = () => page.getByRole("dialog");

describe("ListDetail", () => {
  it("shows the detail as a complementary pane named by its Title from the breakpoint", async () => {
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));

    await expect.element(page.getByRole("complementary", { name: "Henrik Aasen" })).toBeVisible();
    expect(dialog().elements()).toHaveLength(0);
    // The Sheet's close has nothing to close beside the list.
    expect(page.getByRole("button", { name: "Close details" }).elements()).toHaveLength(0);
  });

  it("names the pane by the Detail's aria-label while no Title is mounted", async () => {
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} titled={false} />));

    await expect.element(page.getByRole("complementary", { name: "Order details" })).toBeVisible();
  });

  it("opens the detail in a dialog named by its Title below the breakpoint, and closes it", async () => {
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} />));
    await expect.poll(() => complementary().elements()).toHaveLength(0);
    expect(dialog().elements()).toHaveLength(0);

    await userEvent.click(roleNamed("button", "Order 4012"));
    await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();

    await userEvent.click(roleNamed("button", "Close details"));
    await expect.poll(() => dialog().elements()).toHaveLength(0);
    expect(openState()).toBe("closed");

    await userEvent.click(roleNamed("button", "Order 4012"));
    await expect.element(dialog()).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => dialog().elements()).toHaveLength(0);
    expect(openState()).toBe("closed");
  });

  it("keeps the detail in a dialog at every width with split never", async () => {
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX * 2} split="never" initiallyOpen />));

    await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
    expect(complementary().elements()).toHaveLength(0);
  });

  it("measures the root's layout width, not its transformed width", async () => {
    // 895px wide, drawn 1074px wide: a container query reads the layout width, below 56rem.
    const scaled = { transform: "scale(1.2)", transformOrigin: "0 0" } as const;
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} initiallyOpen around={scaled} />));

    await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
    expect(openState()).toBe("open");
  });

  it("follows a root font size change at an unchanged width", async () => {
    renderThemed(withLocale("en-US", <FixedRoot width={SPLIT_PX + 54} />));
    await expect.element(complementary()).toBeVisible();
    // Past the frames a size observer first reports in, so only the font size changes after.
    await nextFrames(2);

    // 950px is below 56rem once a rem is 20px.
    document.documentElement.style.fontSize = "20px";

    await expect.poll(() => complementary().elements()).toHaveLength(0);
    await userEvent.click(roleNamed("button", "Order 4012"));
    await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
  });

  it("leaves focus that moved on while the dialog closed where it went", async () => {
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} />));
    await userEvent.click(roleNamed("button", "Order 4012"));
    await expect.element(dialog()).toBeVisible();

    await userEvent.click(roleNamed("button", "Close details"));
    const refresh = roleNamed("button", "Refresh");
    refresh.focus();

    await expect.poll(() => dialog().elements()).toHaveLength(0);
    expect(document.activeElement).toBe(refresh);
  });

  it("hands the Detail's ref the mounted pane or dialog", async () => {
    const mounted: Array<string | null> = [];
    const detailRef = (node: HTMLElement | null) => {
      if (node !== null) {
        mounted.push(node.getAttribute("role") ?? node.localName);
      }
    };
    renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} detailRef={detailRef} />));
    await expect.element(complementary()).toBeVisible();
    expect(mounted.at(-1)).toBe("aside");

    resize(SPLIT_PX - 1);
    await userEvent.click(roleNamed("button", "Order 4012"));
    await expect.element(dialog()).toBeVisible();
    expect(mounted.at(-1)).toBe("dialog");
  });

  describe("crossing the breakpoint", () => {
    it("moves an open dialog's focus to the pane when the root widens", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      await expect.element(dialog()).toBeVisible();
      await userEvent.click(roleNamed("textbox", "Comment"));

      resize(SPLIT_PX);

      const pane = page.getByRole("complementary", { name: "Henrik Aasen" });
      await expect.element(pane).toBeVisible();
      expect(dialog().elements()).toHaveLength(0);
      await expect.poll(() => document.activeElement).toBe(pane.element());
    });

    it("carries a focused pane into the dialog when the root narrows", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("textbox", "Comment"));
      expect(openState()).toBe("closed");

      resize(SPLIT_PX - 1);

      const sheet = page.getByRole("dialog", { name: "Henrik Aasen" });
      await expect.element(sheet).toBeVisible();
      expect(openState()).toBe("open");
      await expect.poll(() => sheet.element().contains(document.activeElement)).toBe(true);
    });

    it("returns focus to the list item a narrowing-opened dialog took over when it closes", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      await userEvent.click(roleNamed("textbox", "Comment"));
      resize(SPLIT_PX - 1);
      await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();

      await userEvent.keyboard("{Escape}");

      await expect.poll(() => dialog().elements()).toHaveLength(0);
      await expect.poll(() => document.activeElement).toBe(roleNamed("button", "Order 4012"));
    });

    it("keeps the list when the root narrows after a focused detail control was removed", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("button", "Resolve"));
      await expect.poll(() => page.getByRole("button", { name: "Resolve" }).elements()).toHaveLength(0);
      const refresh = roleNamed("button", "Refresh");
      await userEvent.click(refresh);

      resize(SPLIT_PX - 1);

      await expect.poll(() => complementary().elements()).toHaveLength(0);
      expect(dialog().elements()).toHaveLength(0);
      expect(document.activeElement).toBe(refresh);
    });

    it("keeps the list when the root narrows while focus is in it", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      // Beside the list the pane shows the item, so the Sheet stays closed.
      await expect.poll(openState).toBe("closed");

      resize(SPLIT_PX - 1);

      await expect.poll(() => complementary().elements()).toHaveLength(0);
      expect(dialog().elements()).toHaveLength(0);
      expect(document.activeElement).toBe(roleNamed("button", "Order 4012"));
    });
  });

  describe("focus in the detail's popups and shadow roots", () => {
    it("carries a pane whose menu has focus into the dialog when the root narrows", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("button", "More actions"));
      await expect.element(page.getByRole("menu")).toBeVisible();
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("menuitem");

      resize(SPLIT_PX - 1);

      const sheet = page.getByRole("dialog", { name: "Henrik Aasen" });
      await expect.element(sheet).toBeVisible();
      expect(openState()).toBe("open");
      await expect.poll(() => sheet.element().contains(document.activeElement)).toBe(true);
    });

    it("moves focus from the dialog's menu to the pane when the root widens", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      await expect.element(dialog()).toBeVisible();
      await userEvent.click(roleNamed("button", "More actions"));
      await expect.element(page.getByRole("menu")).toBeVisible();
      await userEvent.keyboard("{ArrowDown}");
      await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("menuitem");

      resize(SPLIT_PX);

      const pane = page.getByRole("complementary", { name: "Henrik Aasen" });
      await expect.element(pane).toBeVisible();
      await expect.poll(() => document.activeElement).toBe(pane.element());
    });

    it("moves focus from a dialog nested in the Sheet to the pane when the root widens", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX - 1} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
      await userEvent.click(roleNamed("button", "Cancel order"));
      const confirm = page.getByRole("alertdialog", { name: "Cancel order 4012?" });
      await expect.element(confirm).toBeVisible();
      await expect.poll(() => confirm.element().contains(document.activeElement)).toBe(true);

      resize(SPLIT_PX);

      const pane = page.getByRole("complementary", { name: "Henrik Aasen" });
      await expect.element(pane).toBeVisible();
      await expect.poll(() => document.activeElement).toBe(pane.element());
      // Past the frames a late restoration would land in, focus stays on the pane.
      await popupFocusRestored();
      expect(document.activeElement).toBe(pane.element());
    });

    it("carries a focused pane into the dialog inside a shadow root", async () => {
      const shadow = renderInShadowRoot(withLocale("en-US", <Harness width={SPLIT_PX} />));
      const pane = shadow.querySelector("aside");
      const comment = pane?.querySelector("input");
      if (!(comment instanceof HTMLInputElement)) {
        throw new Error("expected the pane's comment field");
      }
      comment.focus();
      expect(shadow.activeElement).toBe(comment);

      const frameInShadow = shadow.querySelector("[data-testid=frame]");
      if (!(frameInShadow instanceof HTMLElement)) {
        throw new Error("expected the frame");
      }
      resize(SPLIT_PX - 1, frameInShadow);

      await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
      expect(shadow.querySelector("aside")).toBeNull();
    });

    it("carries a focused pane into the dialog inside a closed shadow root", async () => {
      const shadow = renderInShadowRoot(withLocale("en-US", <Harness width={SPLIT_PX} />), "closed");
      const comment = shadow.querySelector("aside")?.querySelector("input");
      if (!(comment instanceof HTMLInputElement)) {
        throw new Error("expected the pane's comment field");
      }
      comment.focus();
      expect(shadow.activeElement).toBe(comment);

      const frameInShadow = shadow.querySelector("[data-testid=frame]");
      if (!(frameInShadow instanceof HTMLElement)) {
        throw new Error("expected the frame");
      }
      resize(SPLIT_PX - 1, frameInShadow);

      const sheet = () => shadow.querySelector("[role=dialog]") ?? document.querySelector("[role=dialog]");
      await expect.poll(sheet).not.toBeNull();
      const focused = () => shadow.activeElement ?? document.activeElement;
      await expect.poll(() => sheet()?.contains(focused()) === true).toBe(true);
    });
  });

  describe("changing split", () => {
    it("opens no dialog for an item the pane showed when the list stops splitting", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await userEvent.click(roleNamed("button", "Order 4012"));
      await expect.element(complementary()).toBeVisible();

      await userEvent.click(roleNamed("button", "Search"));

      await expect.poll(() => complementary().elements()).toHaveLength(0);
      expect(dialog().elements()).toHaveLength(0);
      expect(openState()).toBe("closed");
    });

    it("opens the dialog for an item opened in the same change that stops the split", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));
      await expect.element(complementary()).toBeVisible();

      await userEvent.click(roleNamed("button", "Search order"));

      await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
    });

    it("carries a focused pane into the dialog when the list stops splitting", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} />));

      await userEvent.click(roleNamed("button", "Switch view"));

      const sheet = page.getByRole("dialog", { name: "Henrik Aasen" });
      await expect.element(sheet).toBeVisible();
      await expect.poll(() => sheet.element().contains(document.activeElement)).toBe(true);
    });

    it("moves an open dialog's focus to the pane when the list starts splitting", async () => {
      renderThemed(withLocale("en-US", <Harness width={SPLIT_PX} split="never" initiallyOpen />));
      await expect.element(dialog()).toBeVisible();

      await userEvent.click(roleNamed("button", "Switch view"));

      const pane = page.getByRole("complementary", { name: "Henrik Aasen" });
      await expect.element(pane).toBeVisible();
      await expect.poll(() => document.activeElement).toBe(pane.element());
    });
  });
});
