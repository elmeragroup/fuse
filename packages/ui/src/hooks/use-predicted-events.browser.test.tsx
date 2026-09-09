import { afterEach, describe, expect, it, vi } from "vitest";

import { flushEffects, render } from "../../test/browser-render";
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

describe("usePredictedEvents", () => {
  it("fires onIntent once from a predicted path", async () => {
    const live = vi.fn();
    render(<Probe label="Prefetch" onIntent={live} />);
    await flushEffects();

    const { x, y } = center(roleNamed("button", "Prefetch"));
    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);
    expect(live).toHaveBeenCalledTimes(1);
  });

  it("stops measuring a fired registration and removes the last pointermove listener", async () => {
    const live = vi.fn();
    render(<Probe label="Prefetch" onIntent={live} />);
    await flushEffects();

    const target = roleNamed("button", "Prefetch");
    const { x, y } = center(target);
    const measure = vi.spyOn(target, "getBoundingClientRect");
    const remove = vi.spyOn(document, "removeEventListener");

    try {
      dispatchPredictedPointer(x, y);
      expect(live).toHaveBeenCalledTimes(1);
      expect(remove.mock.calls.filter((call) => call[0] === "pointermove").length).toBeGreaterThanOrEqual(1);

      measure.mockClear();
      dispatchPredictedPointer(x, y);
      dispatchPredictedPointer(x, y);
      expect(measure).not.toHaveBeenCalled();
      expect(live).toHaveBeenCalledTimes(1);
    } finally {
      measure.mockRestore();
      remove.mockRestore();
    }
  });

  it("keeps the shared pointermove listener while a sibling registration is still pending", async () => {
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
    await flushEffects();

    const firstPoint = center(roleNamed("button", "First"));
    const secondPoint = center(roleNamed("button", "Second"));

    try {
      dispatchPredictedPointer(firstPoint.x, firstPoint.y);
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).not.toHaveBeenCalled();
      expect(remove.mock.calls.filter((call) => call[0] === "pointermove")).toHaveLength(0);

      const measureFirst = vi.spyOn(roleNamed("button", "First"), "getBoundingClientRect");
      try {
        dispatchPredictedPointer(secondPoint.x, secondPoint.y);
        expect(second).toHaveBeenCalledTimes(1);
        expect(measureFirst).not.toHaveBeenCalled();
        expect(remove.mock.calls.filter((call) => call[0] === "pointermove").length).toBeGreaterThanOrEqual(
          1
        );
      } finally {
        measureFirst.mockRestore();
      }
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it("unmounts safely from inside onIntent without double-removing the listener", async () => {
    let calls = 0;
    let unmount: () => void = () => {
      throw new Error("unmount was called before render completed");
    };
    ({ unmount } = render(
      <Probe
        label="Gone"
        onIntent={() => {
          calls += 1;
          unmount();
        }}
      />
    ));
    await flushEffects();

    const gone = roleNamed("button", "Gone");
    const { x, y } = center(gone);

    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);
    dispatchPredictedPointer(x, y);

    expect(calls).toBe(1);
    expect(document.contains(gone)).toBe(false);
  });

  it("uses the latest onIntent before the first hit and does not rearm afterwards", async () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const third = vi.fn();
    const { rerender } = render(<Probe label="Prefetch" onIntent={stale} />);
    await flushEffects();

    rerender(<Probe label="Prefetch" onIntent={fresh} />);
    await flushEffects();

    const { x, y } = center(roleNamed("button", "Prefetch"));
    dispatchPredictedPointer(x, y);
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();

    rerender(<Probe label="Prefetch" onIntent={third} />);
    await flushEffects();
    dispatchPredictedPointer(x, y);
    expect(third).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("does not accumulate pointermove listeners across a predictionZoneSize rerender", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(
      <Probe label="Prefetch" predictionZoneSize={30} onIntent={() => undefined} />
    );
    await flushEffects();

    rerender(<Probe label="Prefetch" predictionZoneSize={60} onIntent={() => undefined} />);
    await flushEffects();

    try {
      const { x, y } = center(roleNamed("button", "Prefetch"));
      dispatchPredictedPointer(x, y);
      unmount();

      const additions = add.mock.calls.filter((call) => call[0] === "pointermove");
      const removals = remove.mock.calls.filter((call) => call[0] === "pointermove");
      expect(additions.length).toBeLessThanOrEqual(2);
      expect(additions).toHaveLength(removals.length);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
