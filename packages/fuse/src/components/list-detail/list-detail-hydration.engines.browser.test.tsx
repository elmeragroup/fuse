// ListDetail's first paint and hydration, in Chromium and WebKit. Unit under test: ListDetail.Root
// from server HTML to the hydrated layout. Oracles: the documented server state, the split layout
// whose pane CSS hides in a root narrower than Tailwind's `@4xl` container size (56rem); and
// React's hydration contract, no recoverable error, after which a narrow root shows its open
// detail in a dialog instead.
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { ListDetail } from "./index";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A root `width` pixels wide whose detail is open, as an app restoring a selection renders it. */
function Fixture({ width }: { readonly width: number }) {
  return withLocale(
    "en-US",
    <div style={{ width, height: 300, display: "flex", fontSize: 16 }}>
      <ListDetail.Root open onOpenChange={() => undefined} className="flex-1">
        <ListDetail.List>Orders</ListDetail.List>
        <ListDetail.Detail>
          <ListDetail.Title>Henrik Aasen</ListDetail.Title>
        </ListDetail.Detail>
      </ListDetail.Root>
    </div>
  );
}

/** Places the server HTML for a root `width` wide, before any script runs on it. */
function serverRender(width: number): HTMLDivElement {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<Fixture width={width} />);
  document.body.append(host);
  cleanups.push(() => {
    host.remove();
  });
  return host;
}

function hydrate(host: HTMLDivElement, width: number): unknown[] {
  const errors: unknown[] = [];
  const root = hydrateRoot(host, <Fixture width={width} />, {
    onRecoverableError: (error) => {
      errors.push(error);
    },
  });
  cleanups.unshift(() => {
    root.unmount();
  });
  return errors;
}

function pane(host: HTMLElement): HTMLElement {
  const element = host.querySelector("aside");
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected the server-rendered pane");
  }
  return element;
}

describe("ListDetail hydration", () => {
  it("paints the server's pane only from the breakpoint", () => {
    expect(getComputedStyle(pane(serverRender(56 * 16))).display).toBe("flex");
    expect(getComputedStyle(pane(serverRender(56 * 16 - 1))).display).toBe("none");
  });

  it("hydrates a narrow root without a mismatch, then opens its detail in a dialog", async () => {
    const width = 56 * 16 - 1;
    const host = serverRender(width);
    const errors = hydrate(host, width);

    await expect.element(page.getByRole("dialog", { name: "Henrik Aasen" })).toBeVisible();
    expect(host.querySelector("aside")).toBeNull();
    expect(errors).toEqual([]);
  });

  it("hydrates a wide root without a mismatch and keeps the pane", async () => {
    const width = 56 * 16;
    const host = serverRender(width);
    const errors = hydrate(host, width);

    await expect.element(page.getByRole("complementary", { name: "Henrik Aasen" })).toBeVisible();
    expect(page.getByRole("dialog").elements()).toHaveLength(0);
    expect(errors).toEqual([]);
  });
});
