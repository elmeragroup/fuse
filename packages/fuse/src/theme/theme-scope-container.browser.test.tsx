import { useRef } from "react";
import type { ReactNode, RefObject } from "react";

import { describe, expect, it } from "vitest";

import { render } from "../../test/browser-render";
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
