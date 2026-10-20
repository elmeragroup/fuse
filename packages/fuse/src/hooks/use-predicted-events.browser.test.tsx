import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { dispatchPredictedPointer } from "../../test/predicted-pointer";
import { roleNamed } from "../../test/themed-browser-render";
import { usePredictedEvents } from "./use-predicted-events";

afterEach(() => {
  vi.restoreAllMocks();
});

function Probe({
  label,
  predictionZoneSize = 30,
  onIntent,
  enabled = true,
}: {
  label: string;
  predictionZoneSize?: number;
  onIntent: () => void;
  enabled?: boolean;
}) {
  const { ref } = usePredictedEvents({ predictionZoneSize, onIntent, enabled });
  return <div ref={ref} role="button" aria-label={label} style={{ width: 40, height: 40 }} />;
}

function center(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function pointermoveCalls(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.filter((call) => call[0] === "pointermove");
}

describe("usePredictedEvents", () => {
  it("keeps the shared pointermove listener while a sibling registration is still pending", () => {
    const first = vi.fn();
    const second = vi.fn();
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");

    render(
      <div style={{ display: "flex", gap: 120 }}>
        <Probe label="First" onIntent={first} />
        <Probe label="Second" onIntent={second} />
      </div>
    );

    const firstPoint = center(roleNamed("button", "First"));
    const secondPoint = center(roleNamed("button", "Second"));

    try {
      expect(pointermoveCalls(add), "two registrations share one listener").toHaveLength(1);

      dispatchPredictedPointer(firstPoint.x, firstPoint.y);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).not.toHaveBeenCalled();
      expect(pointermoveCalls(remove)).toHaveLength(0);

      const measureFirst = vi.spyOn(roleNamed("button", "First"), "getBoundingClientRect");
      try {
        dispatchPredictedPointer(secondPoint.x, secondPoint.y);
        expect(second).toHaveBeenCalledTimes(1);
        expect(measureFirst).not.toHaveBeenCalled();
        expect(pointermoveCalls(remove).length).toBeGreaterThanOrEqual(1);
      } finally {
        measureFirst.mockRestore();
      }
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("unmounts safely from inside onIntent without double-removing the listener", () => {
    let calls = 0;
    let unmount: () => void = () => {
      throw new Error("unmount was called before render completed");
    };
    const remove = vi.spyOn(document, "removeEventListener");
    ({ unmount } = render(
      <Probe
        label="Gone"
        onIntent={() => {
          calls += 1;
          unmount();
        }}
      />
    ));

    const gone = roleNamed("button", "Gone");
    const { x, y } = center(gone);

    try {
      dispatchPredictedPointer(x, y);
      dispatchPredictedPointer(x, y);
      dispatchPredictedPointer(x, y);

      expect(calls).toBe(1);
      expect(document.contains(gone)).toBe(false);
      expect(
        pointermoveCalls(remove),
        "the fired registration removes the listener; the unmount cleanup must not remove it again"
      ).toHaveLength(1);
    } finally {
      remove.mockRestore();
    }
  });

  it("uses the latest onIntent before the first hit and does not rearm afterwards", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const third = vi.fn();
    const { rerender } = render(<Probe label="Prefetch" onIntent={stale} />);

    rerender(<Probe label="Prefetch" onIntent={fresh} />);

    const { x, y } = center(roleNamed("button", "Prefetch"));
    dispatchPredictedPointer(x, y);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();

    rerender(<Probe label="Prefetch" onIntent={third} />);
    dispatchPredictedPointer(x, y);
    expect(third).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("does not accumulate pointermove listeners across a predictionZoneSize rerender", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(
      <Probe label="Prefetch" predictionZoneSize={30} onIntent={() => undefined} />
    );

    rerender(<Probe label="Prefetch" predictionZoneSize={60} onIntent={() => undefined} />);

    try {
      const { x, y } = center(roleNamed("button", "Prefetch"));
      dispatchPredictedPointer(x, y);
      unmount();

      const additions = pointermoveCalls(add);
      const removals = pointermoveCalls(remove);
      expect(additions.length).toBeLessThanOrEqual(2);
      expect(additions).toHaveLength(removals.length);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("reads the box of no registration far outside the viewport while the pointer moves", async () => {
    const nearIntent = vi.fn();
    render(
      <>
        <Probe label="Near one" onIntent={nearIntent} />
        <Probe label="Near two" onIntent={vi.fn()} />
        <div style={{ marginTop: 5000 }}>
          <Probe label="Far one" onIntent={vi.fn()} />
          <Probe label="Far two" onIntent={vi.fn()} />
          <Probe label="Far three" onIntent={vi.fn()} />
        </div>
      </>
    );
    const far = ["Far one", "Far two", "Far three"].map((name) => roleNamed("button", name));
    const near = ["Near one", "Near two"].map((name) => roleNamed("button", name));
    const reads = vi.spyOn(Element.prototype, "getBoundingClientRect");
    const readFrom = (elements: HTMLElement[]) =>
      reads.mock.contexts.filter((element) => elements.some((candidate) => candidate === element)).length;
    // Each registration's viewport observer reports its element's first state a task or more after
    // mount, in no fixed order; until then the registration counts as near. Wait for the reports.
    await vi.waitFor(() => {
      reads.mockClear();
      dispatchPredictedPointer(5, 5000);
      expect(readFrom(far)).toBe(0);
    });

    reads.mockClear();
    for (let move = 0; move < 10; move += 1) {
      dispatchPredictedPointer(5, 5000);
    }
    expect(readFrom(far)).toBe(0);
    // At most one read per on-screen registration per move.
    expect(readFrom(near)).toBeLessThanOrEqual(20);

    // An on-screen registration still fires, once, and stops watching the viewport when it does.
    const disconnect = vi.spyOn(IntersectionObserver.prototype, "disconnect");
    // Above the first button, inside its 30px zone and outside the second's, so only it fires.
    const { x } = center(near[0] ?? document.body);
    const y = (near[0]?.getBoundingClientRect().top ?? 0) - 25;
    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);
    expect(nearIntent).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
