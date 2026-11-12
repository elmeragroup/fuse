// SparklineHover's hydration, in Chromium and WebKit. Unit under test: SparklineHover around
// Sparklines, from server HTML to the hydrated page. Oracles: the CSS hover's contract, where a
// Sparkline keeps its own cross-fading hover until its nearest wrapper has hydrated and marked its
// glide group `data-glide`; React's own hydration contract, no recoverable error; and the box
// worked by hand, where the middle of three values [2, 6, 4] sits halfway across at the top edge.
import { Suspense, use, useEffect } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";

import { hoverIn, placeIn, settleStylesheet, shownIn } from "../../../test/chart/sparkline";
import "./chart.css";
import { Sparkline } from "./sparkline";
import { SparklineHover } from "./sparkline-hover";

/** Calls `onCommit` from a passive effect, once the commit that hydrates it has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

/** A Sparkline of [2, 6, 4] named `label`. */
function Line({ label }: { readonly label: string }) {
  return <Sparkline aria-label={label} data={[2, 6, 4]} locale="nb-NO" curve="linear" />;
}

function Fixture({ onHydrated }: { readonly onHydrated?: () => void }) {
  return (
    <SparklineHover style={{ width: 300 }}>
      <Line label="Spot price" />
      <Sparkline aria-label="Use" data={[1, null, 3]} locale="nb-NO" variant="bar" />
      <CommitMarker onCommit={onHydrated} />
    </SparklineHover>
  );
}

/**
 * An inner wrapper that waits on `ready` in the browser and renders at once on the server, on a
 * `render` element that writes `slot` as its own `data-slot` when one is given.
 */
function LateInner({
  ready,
  slot,
}: {
  readonly ready: Promise<void> | null;
  readonly slot: string | undefined;
}): ReactNode {
  if (ready !== null) use(ready);
  const line = <Line label="Inner" />;
  if (slot === undefined) return <SparklineHover>{line}</SparklineHover>;
  return <SparklineHover render={<div data-slot={slot} />}>{line}</SparklineHover>;
}

function Nested({
  ready,
  slot,
  onHydrated,
  onLateHydrated,
}: {
  readonly ready: Promise<void> | null;
  readonly slot: string | undefined;
  readonly onHydrated?: () => void;
  readonly onLateHydrated?: () => void;
}) {
  return (
    <SparklineHover style={{ width: 300 }}>
      <Line label="Outer" />
      <Suspense fallback={null}>
        <LateInner ready={ready} slot={slot} />
        <CommitMarker onCommit={onLateHydrated} />
      </Suspense>
      <CommitMarker onCommit={onHydrated} />
    </SparklineHover>
  );
}

/** A Sparkline that waits on `ready` in the browser and renders at once on the server. */
function LateLine({ ready }: { readonly ready: Promise<void> | null }): ReactNode {
  if (ready !== null) use(ready);
  return <Line label="Late" />;
}

/** One wrapper whose Sparkline sits in a Suspense boundary that hydrates after the wrapper. */
function Delayed({
  ready,
  onHydrated,
  onLateHydrated,
}: {
  readonly ready: Promise<void> | null;
  readonly onHydrated?: () => void;
  readonly onLateHydrated?: () => void;
}) {
  return (
    <SparklineHover style={{ width: 300 }}>
      <Suspense fallback={null}>
        <LateLine ready={ready} />
        <CommitMarker onCommit={onLateHydrated} />
      </Suspense>
      <CommitMarker onCommit={onHydrated} />
    </SparklineHover>
  );
}

/** The server HTML of `node`, in the page. */
function serverPage(node: ReactNode): HTMLDivElement {
  const host = document.createElement("div");
  host.innerHTML = renderToString(node);
  document.body.append(host);
  return host;
}

/** Hydrate the server HTML with `client`, resolving once its hydration commit has run. */
async function hydrate(host: HTMLDivElement, client: (onHydrated: () => void) => ReactNode) {
  const recover = vi.fn();
  const hydrated = Promise.withResolvers<void>();
  const root = hydrateRoot(host, client(hydrated.resolve), { onRecoverableError: recover });
  await hydrated.promise;
  return { root, recover };
}

/** A Sparkline in the page by its label. */
function image(host: HTMLElement, label: string): SVGSVGElement {
  const element = host.querySelector(`svg[aria-label^="${label}."]`);
  if (!(element instanceof SVGSVGElement)) throw new Error(`expected the ${label} Sparkline`);
  return element;
}

/** Whether a wrapper took a Sparkline over: its glide group carries the takeover marker. */
const taken = (svg: SVGSVGElement) =>
  svg.querySelector('[data-slot="sparkline-glide"]')?.hasAttribute("data-glide") ?? false;

/** Where the one crosshair a Sparkline shows sits across it. */
const crosshairX = (svg: SVGSVGElement) => placeIn(svg, shownIn(svg, '[data-slot="sparkline-crosshair"]')).x;

describe("SparklineHover hydration", () => {
  afterEach(async () => {
    await commands.parkPointer();
  });

  it("sends the CSS hover from the server and takes each Sparkline over once hydrated, with no recoverable error", async () => {
    const host = serverPage(<Fixture />);
    const marked = () => [...host.querySelectorAll("svg")].map(taken);
    expect(marked()).toEqual([false, false]);
    const { root, recover } = await hydrate(host, (onHydrated) => <Fixture onHydrated={onHydrated} />);
    try {
      expect(marked()).toEqual([true, true]);
      expect(recover).not.toHaveBeenCalled();
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it("places the marks on the value a pointer rests on as it hydrates", async () => {
    const host = serverPage(<Fixture />);
    const line = image(host, "Spot price");
    await hoverIn(line, 1 / 2);
    const { root } = await hydrate(host, (onHydrated) => <Fixture onHydrated={onHydrated} />);
    try {
      expect(taken(line)).toBe(true);
      // The value's own marks fade out over the stylesheet's 120 ms as the glide's take over.
      settleStylesheet();
      expect(crosshairX(line)).toBe(0.5);
      expect(placeIn(line, shownIn(line, '[data-slot="sparkline-dot"][data-part="glide"]'))).toEqual({
        x: 0.5,
        y: 0,
      });
    } finally {
      root.unmount();
      host.remove();
    }
  });

  it.each([
    { element: "its default element", slot: undefined },
    { element: "a render element with its own data-slot", slot: "tile" },
  ])(
    "keeps a Sparkline's CSS hover until its own wrapper on $element hydrates, inside one that hydrated first",
    async ({ slot }) => {
      const host = serverPage(<Nested ready={null} slot={slot} />);
      const inner = image(host, "Inner");
      await hoverIn(inner, 1 / 2);
      const ready = Promise.withResolvers<void>();
      const late = Promise.withResolvers<void>();
      const { root, recover } = await hydrate(host, (onHydrated) => (
        <Nested ready={ready.promise} slot={slot} onHydrated={onHydrated} onLateHydrated={late.resolve} />
      ));
      try {
        // The outer wrapper took its own Sparkline over and left the inner one, still on the
        // server's markup, to the CSS hover.
        expect(taken(image(host, "Outer"))).toBe(true);
        expect(taken(inner)).toBe(false);
        settleStylesheet();
        expect(crosshairX(inner)).toBe(0.5);

        ready.resolve();
        await late.promise;
        expect(taken(inner)).toBe(true);
        settleStylesheet();
        expect(crosshairX(inner)).toBe(0.5);
        expect(recover).not.toHaveBeenCalled();
      } finally {
        root.unmount();
        host.remove();
      }
    }
  );

  it("hydrates a Sparkline the wrapper took over before its Suspense boundary did, with no mismatch", async () => {
    // The wrapper hydrates first and takes the waiting Sparkline over, writing `data-glide` and the
    // marks' place on its glide group, which the boundary then hydrates over. React must report no
    // mismatch for them and keep them, and the marks stay on the hovered middle value.
    const host = serverPage(<Delayed ready={null} />);
    const late = image(host, "Late");
    await hoverIn(late, 1 / 2);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const ready = Promise.withResolvers<void>();
    const boundary = Promise.withResolvers<void>();
    const { root, recover } = await hydrate(host, (onHydrated) => (
      <Delayed ready={ready.promise} onHydrated={onHydrated} onLateHydrated={boundary.resolve} />
    ));
    try {
      expect(taken(late)).toBe(true);
      ready.resolve();
      await boundary.promise;
      // The boundary hydrated the server's own svg in place rather than drawing a new one.
      expect(image(host, "Late")).toBe(late);
      expect(late.getAttribute("role")).toBe("img");
      expect(taken(late)).toBe(true);
      settleStylesheet();
      expect(crosshairX(late)).toBe(0.5);
      expect(placeIn(late, shownIn(late, '[data-slot="sparkline-dot"][data-part="glide"]'))).toEqual({
        x: 0.5,
        y: 0,
      });
      expect(recover).not.toHaveBeenCalled();
      expect(errors.mock.calls).toEqual([]);
    } finally {
      errors.mockRestore();
      root.unmount();
      host.remove();
    }
  });
});
