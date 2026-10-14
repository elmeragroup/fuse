import { createRef, StrictMode, Suspense, use, useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import { render } from "../../test/browser-render";
import { hydrateStreamedPage, serverBoundaryNodes, settleScheduledWork } from "../../test/streamed-hydration";
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
      <ThemeScope theme={{ variant: "internal", brand: "fkas", segment: "private" }}>
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

  it("prefers an explicit container over an enclosing ThemeScope", () => {
    const target = document.createElement("div");
    const seen = resolutions((record) => (
      <ThemeScope theme={{ variant: "external", brand: "tkas", segment: "company" }}>
        <Probe container={target} onResolve={record} />
      </ThemeScope>
    ));
    expect(seen.at(-1)).toBe(target);
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

const scopeTheme = { variant: "internal", brand: "fkas", segment: "private" } as const;

function scopeElements(seen: Resolved[]): HTMLElement[] {
  return seen.filter((resolved): resolved is HTMLElement => resolved instanceof HTMLElement);
}

/** Everything recorded from the first attached element on, which must never fall back to null. */
function afterFirstAttach(seen: Resolved[]): Resolved[] {
  return seen.slice(seen.findIndex((resolved) => resolved instanceof HTMLElement));
}

describe("ThemeScope's container across a streamed Suspense boundary", () => {
  it("attaches without client-rendering a boundary whose content is still streaming", async () => {
    const seen: Resolved[] = [];
    const { host, recoverableErrors } = await hydrateStreamedPage(
      (boundary) => (
        <ThemeScope theme={scopeTheme}>
          <Probe
            onResolve={(resolved) => {
              seen.push(resolved);
            }}
          />
          {boundary}
        </ThemeScope>
      ),
      <span>Streamed content</span>
    );
    const server = serverBoundaryNodes(host);
    expect(server.template).not.toBeNull();

    await expect.poll(() => seen.at(-1)).toBe(host.querySelector("[data-theme-brand]"));
    await settleScheduledWork();

    expect(server.template?.isConnected).toBe(true);
    expect(server.fallback?.isConnected).toBe(true);
    expect(recoverableErrors).toEqual([]);
  });

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

    await expect.poll(() => committed).toEqual(["waiting", "in scope"]);
    expect(streamed.recoverableErrors).toEqual([]);
  });
});

describe("ThemeScope's container across a Suspense hide and reveal", () => {
  it("keeps the same element and an open overlay in it while the boundary hides and reveals", async () => {
    function SuspendOn({ pending }: { pending: Promise<void> | undefined }) {
      if (pending !== undefined) {
        use(pending);
      }
      return null;
    }
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

    let reveal: () => void = () => undefined;
    // A non-transition update that suspends shown content hides it behind the fallback.
    rerender(
      tree(
        new Promise<void>((resolve) => {
          reveal = resolve;
        })
      )
    );
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
  it("provides the new element when a render change replaces it", async () => {
    const seen: Resolved[] = [];
    const record = (resolved: Resolved) => {
      seen.push(resolved);
    };
    const { host, rerender } = render(
      <ThemeScope theme={scopeTheme}>
        <Probe onResolve={record} />
      </ThemeScope>
    );
    await expect.poll(() => seen.at(-1)).toBe(host.querySelector("div[data-theme-brand]"));

    rerender(
      <ThemeScope theme={scopeTheme} render={<section />}>
        <Probe onResolve={record} />
      </ThemeScope>
    );

    const section = host.querySelector("section[data-theme-brand]");
    expect(section).not.toBeNull();
    await expect.poll(() => seen.at(-1)).toBe(section);
  });

  it("stops providing an element that a render change removed from the document", async () => {
    const seen: Resolved[] = [];
    const record = (resolved: Resolved) => {
      seen.push(resolved);
    };
    function Scope({ attached }: { attached: boolean }) {
      return (
        <ThemeScope
          theme={scopeTheme}
          render={(props) => (attached ? <div {...props} /> : <>{props.children}</>)}>
          <Probe onResolve={record} />
        </ThemeScope>
      );
    }
    const { host, rerender } = render(<Scope attached />);
    const scope = host.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);

    rerender(<Scope attached={false} />);

    expect(host.querySelector("[data-theme-brand]")).toBeNull();
    await expect.poll(() => seen.at(-1)).toBeNull();
  });

  it("stops providing an element that a render change removed while a boundary hid it", async () => {
    function SuspendOn({ pending }: { pending: Promise<void> | undefined }) {
      if (pending !== undefined) {
        use(pending);
      }
      return null;
    }
    const seen: Resolved[] = [];
    const record = (resolved: Resolved) => {
      seen.push(resolved);
    };
    const tree = (attached: boolean, pending?: Promise<void>) => (
      <Suspense fallback={<span>Hidden</span>}>
        <ThemeScope
          theme={scopeTheme}
          render={(props) => (attached ? <div {...props} /> : <>{props.children}</>)}>
          <Probe onResolve={record} />
          <SuspendOn pending={pending} />
        </ThemeScope>
      </Suspense>
    );
    const { host, rerender } = render(tree(true));
    const scope = host.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);

    let reveal: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      reveal = resolve;
    });
    rerender(tree(true, pending));
    await expect.element(page.getByText("Hidden")).toBeVisible();
    await settleScheduledWork();
    // React deletes the hidden element without detaching its ref a second time.
    rerender(tree(false, pending));
    reveal();
    await expect.element(page.getByText("Hidden")).not.toBeInTheDocument();

    expect(host.querySelector("[data-theme-brand]")).toBeNull();
    await expect.poll(() => seen.at(-1)).toBeNull();
  });

  it("stops providing a removed element to a consumer that stays mounted through the hide", async () => {
    function SuspendOn({ pending }: { pending: Promise<void> | undefined }) {
      if (pending !== undefined) {
        use(pending);
      }
      return null;
    }
    const seen: Resolved[] = [];
    const record = (resolved: Resolved) => {
      seen.push(resolved);
    };
    const mounts: string[] = [];
    function MountedProbe() {
      // Passive effects stay connected while a Suspense boundary hides its content.
      useEffect(() => {
        mounts.push("mount");
      }, []);
      return <Probe onResolve={record} />;
    }
    // The children sit beside the scope element, so removing the element keeps them mounted.
    const tree = (attached: boolean, pending?: Promise<void>) => (
      <Suspense fallback={<span>Hidden</span>}>
        <ThemeScope
          theme={scopeTheme}
          render={({ children, ...props }) => (
            <>
              {attached ? <div {...props} /> : null}
              {children}
            </>
          )}>
          <MountedProbe />
          <SuspendOn pending={pending} />
        </ThemeScope>
      </Suspense>
    );
    const { host, rerender } = render(tree(true));
    const scope = host.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);

    let reveal: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      reveal = resolve;
    });
    rerender(tree(true, pending));
    await expect.element(page.getByText("Hidden")).toBeVisible();
    await settleScheduledWork();
    rerender(tree(false, pending));
    reveal();
    await expect.element(page.getByText("Hidden")).not.toBeInTheDocument();

    expect(host.querySelector("[data-theme-brand]")).toBeNull();
    await expect.poll(() => seen.at(-1)).toBeNull();
    expect(mounts).toEqual(["mount"]);
  });

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

  it("keeps one element through StrictMode's double attach in a root outside the document", async () => {
    const seen: Resolved[] = [];
    const detachedHost = document.createElement("div");
    const root = createRoot(detachedHost);
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
    const scope = detachedHost.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);
    await settleScheduledWork();

    expect(seen.at(-1)).toBe(scope);
    flushSync(() => {
      root.unmount();
    });
  });

  it("keeps one element through StrictMode's double attach", async () => {
    const seen: Resolved[] = [];
    const { host } = render(
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
    const scope = host.querySelector("[data-theme-brand]");
    await expect.poll(() => seen.at(-1)).toBe(scope);
    await settleScheduledWork();

    expect(afterFirstAttach(seen)).not.toContain(null);
    expect(new Set(scopeElements(seen))).toEqual(new Set([scope]));
  });
});
