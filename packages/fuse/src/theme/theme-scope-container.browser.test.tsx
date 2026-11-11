import { createRef, StrictMode, Suspense, use, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { distinctSteps, hydrateStreamedPage, settleScheduledWork } from "../../test/streamed-hydration";
import { Popover } from "../components/popover";
import { ThemeScope } from "./theme-scope";
import { useResolvedPortalContainer } from "./theme-scope-container";

type Resolved = HTMLElement | null | undefined;

function Probe({
  container,
  onResolve,
}: {
  container?: HTMLElement | RefObject<HTMLElement | null> | undefined;
  onResolve: (resolved: Resolved) => void;
}): ReactNode {
  onResolve(useResolvedPortalContainer(container));
  return null;
}

function resolutions(node: (record: (resolved: Resolved) => void) => ReactNode): Resolved[] {
  const seen: Resolved[] = [];
  render(
    node((resolved) => {
      seen.push(resolved);
    })
  );
  return seen;
}

describe("useResolvedPortalContainer", () => {
  const target = document.createElement("div");

  it.each<{
    name: string;
    container: HTMLElement | RefObject<HTMLElement | null> | undefined;
    expected: Resolved;
  }>([
    { name: "returns an explicit element unchanged", container: target, expected: target },
    { name: "reads an explicit ref's current element", container: { current: target }, expected: target },
    {
      name: "waits with null while an explicit ref is still unattached",
      container: { current: null },
      expected: null,
    },
    {
      name: "leaves the primitive default in place when there is no scope and no container",
      container: undefined,
      expected: undefined,
    },
  ])("$name", ({ container, expected }) => {
    const seen = resolutions((record) => <Probe container={container} onResolve={record} />);
    expect(seen.at(-1)).toBe(expected);
  });

  it("falls back to the nearest ThemeScope element once it is attached", () => {
    const seen = resolutions((record) => (
      <ThemeScope theme={{ identity: "neutral", brand: "fkas", segment: "private" }}>
        <Probe onResolve={record} />
      </ThemeScope>
    ));
    expect(seen[0]).toBeNull();
    const resolved = seen.at(-1);
    if (!(resolved instanceof HTMLElement)) {
      throw new Error("expected the scope element");
    }
    expect(resolved.getAttribute("data-theme-brand")).toBe("fkas");
  });

  it("reports a ref's element after commit without a host rerender", async () => {
    function Host({ onResolve }: { onResolve: (resolved: Resolved) => void }): ReactNode {
      const ref = useRef<HTMLElement | null>(null);
      return (
        <>
          <section ref={ref} aria-label="Portal host" />
          <Probe container={ref} onResolve={onResolve} />
        </>
      );
    }
    const seen: Resolved[] = [];
    render(
      <Host
        onResolve={(resolved) => {
          seen.push(resolved);
        }}
      />
    );
    expect(seen[0]).toBeNull();
    await expect.poll(() => seen.at(-1)).toBeInstanceOf(HTMLElement);
  });
});

const scopeTheme = { identity: "neutral", brand: "fkas", segment: "private" } as const;

function scopeElements(seen: Resolved[]): HTMLElement[] {
  return seen.filter((resolved): resolved is HTMLElement => resolved instanceof HTMLElement);
}

/** Everything recorded from the first attached element on, which must never fall back to null. */
function afterFirstAttach(seen: Resolved[]): Resolved[] {
  return seen.slice(seen.findIndex((resolved) => resolved instanceof HTMLElement));
}

function SuspendOn({ pending }: { pending: Promise<void> | undefined }): ReactNode {
  if (pending !== undefined) {
    use(pending);
  }
  return null;
}

/** A promise that keeps shown content suspended, hidden behind its fallback, until `reveal`. */
function suspension() {
  let reveal: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    reveal = resolve;
  });
  return { pending, reveal };
}

describe("ThemeScope's container across a streamed Suspense boundary", () => {
  it("hydrates an overlay that streams in after the scope attached as the server rendered it", async () => {
    const committed: string[] = [];
    function StreamedOverlay() {
      const resolved = useResolvedPortalContainer();
      const output = useRef<HTMLElement>(null);
      useLayoutEffect(() => {
        committed.push(output.current?.textContent ?? "");
      });
      return <strong ref={output}>{resolved instanceof HTMLElement ? "in scope" : "waiting"}</strong>;
    }
    const streamed = await hydrateStreamedPage(
      (boundary) => <ThemeScope theme={scopeTheme}>{boundary}</ThemeScope>,
      <StreamedOverlay />
    );
    await settleScheduledWork();

    await streamed.finishStreaming();

    await expect.poll(() => distinctSteps(committed)).toEqual(["waiting", "in scope"]);
    expect(streamed.recoverableErrors).toEqual([]);
  });
});

describe("ThemeScope's container across a Suspense hide and reveal", () => {
  it("keeps the same element and an open overlay in it while the boundary hides and reveals", async () => {
    const seen: Resolved[] = [];
    const record = (resolved: Resolved) => {
      seen.push(resolved);
    };
    const tree = (pending?: Promise<void>) => (
      <Suspense fallback={<span>Hidden</span>}>
        <ThemeScope theme={scopeTheme}>
          <Probe onResolve={record} />
          <Popover.Root defaultOpen>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Content>
              <Popover.Title>Scoped popup</Popover.Title>
            </Popover.Content>
          </Popover.Root>
          <SuspendOn pending={pending} />
        </ThemeScope>
      </Suspense>
    );
    const { host, rerender } = render(tree());
    const scope = host.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);
    const popup = page.getByRole("dialog", { name: "Scoped popup" });
    await expect.element(popup).toBeVisible();

    const { pending, reveal } = suspension();
    // A non-transition update that suspends shown content hides it behind the fallback.
    rerender(tree(pending));
    await expect.element(page.getByText("Hidden")).toBeVisible();
    await settleScheduledWork();
    reveal();
    await expect.element(page.getByText("Hidden")).not.toBeInTheDocument();
    await expect.element(popup).toBeVisible();
    await settleScheduledWork();

    expect(afterFirstAttach(seen)).not.toContain(null);
    expect(new Set(scopeElements(seen))).toEqual(new Set([scope]));
    expect(host.querySelector("[data-theme-brand]")).toBe(scope);
    expect(scope?.contains(popup.element())).toBe(true);
  });
});

describe("ThemeScope's container lifecycle", () => {
  it("still attaches and cleans up a caller's ref", () => {
    const calls: string[] = [];
    const objectRef = createRef<HTMLDivElement>();
    const { host, unmount } = render(
      <>
        <ThemeScope
          theme={scopeTheme}
          ref={(node) => {
            calls.push(`attach ${node?.tagName ?? "null"}`);
            return () => {
              calls.push("cleanup");
            };
          }}
        />
        <ThemeScope theme={scopeTheme} ref={objectRef} />
      </>
    );
    expect(calls).toEqual(["attach DIV"]);
    expect(objectRef.current).toBe(host.querySelectorAll("[data-theme-brand]")[1]);

    unmount();

    expect(calls).toEqual(["attach DIV", "cleanup"]);
    expect(objectRef.current).toBeNull();
  });

  it.each<{ name: string; inDocument: boolean }>([
    { name: "in the document", inDocument: true },
    // isConnected is false throughout, so only the reattach may cancel the detach.
    { name: "outside the document", inDocument: false },
  ])("keeps one element through StrictMode's double attach in a root $name", async ({ inDocument }) => {
    const seen: Resolved[] = [];
    const host = document.createElement("div");
    if (inDocument) {
      document.body.append(host);
    }
    const root = createRoot(host);
    try {
      flushSync(() => {
        root.render(
          <StrictMode>
            <ThemeScope theme={scopeTheme}>
              <Probe
                onResolve={(resolved) => {
                  seen.push(resolved);
                }}
              />
            </ThemeScope>
          </StrictMode>
        );
      });
      const scope = host.querySelector("[data-theme-brand]");
      await expect.poll(() => seen.at(-1)).toBe(scope);
      await settleScheduledWork();

      expect(afterFirstAttach(seen)).not.toContain(null);
      expect(new Set(scopeElements(seen))).toEqual(new Set([scope]));
    } finally {
      flushSync(() => {
        root.unmount();
      });
      host.remove();
    }
  });
});
