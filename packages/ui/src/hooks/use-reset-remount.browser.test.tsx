import { useRef } from "react";

import { describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { formNamed, inputNamed } from "../../test/themed-browser-render";
import { useResetRemount } from "./use-reset-remount";
import type { ResetRemount } from "./use-reset-remount";

type ProbeProps = {
  enabled: boolean;
  /** Receives the hook's return value on every render; the last call is the current state. */
  onState: (state: ResetRemount) => void;
};

/** One form around one input that the hook remounts through `key`, as the composites do. */
function Probe({ enabled, onState }: ProbeProps) {
  const element = useRef<HTMLInputElement>(null);
  const state = useResetRemount(element, enabled);
  onState(state);
  return (
    <form aria-label="Probe">
      <input key={state.key} aria-label="Field" ref={element} defaultValue="start" />
    </form>
  );
}

function mountProbe(enabled: boolean) {
  const onState = vi.fn<(state: ResetRemount) => void>();
  render(<Probe enabled={enabled} onState={onState} />);
  const current = (): ResetRemount => {
    const last = onState.mock.lastCall?.[0];
    if (!last) throw new Error("Probe has not rendered");
    return last;
  };
  return { current, form: formNamed("Probe"), input: inputNamed("Field") };
}

describe("useResetRemount", () => {
  it("increments the key once per native reset when enabled", async () => {
    const { current, form } = mountProbe(true);
    expect(current()).toEqual({ key: 0, isInitialMount: true });

    form.reset();
    await vi.waitFor(() => {
      expect(current().key).toBe(1);
    });

    form.reset();
    await vi.waitFor(() => {
      expect(current().key).toBe(2);
    });
  });

  it("leaves the key alone when disabled", async () => {
    const { current, form } = mountProbe(false);
    vi.useFakeTimers();
    try {
      form.reset();
      await vi.runOnlyPendingTimersAsync();
    } finally {
      vi.useRealTimers();
    }
    expect(current()).toEqual({ key: 0, isInitialMount: true });
  });

  it("hands focus back to the remounted control when the reset fired while it was focused", async () => {
    const { current, form, input } = mountProbe(true);
    input.focus();
    expect(document.activeElement).toBe(input);

    form.reset();
    await vi.waitFor(() => {
      expect(current().key).toBe(1);
    });

    const remounted = inputNamed("Field");
    expect(remounted, "the key change replaces the node").not.toBe(input);
    expect(document.activeElement).toBe(remounted);
  });

  it("does not move focus to a control that was not focused when reset fired", async () => {
    const { current, form, input } = mountProbe(true);
    expect(document.activeElement).not.toBe(input);

    form.reset();
    await vi.waitFor(() => {
      expect(current().key).toBe(1);
    });

    expect(document.activeElement).not.toBe(inputNamed("Field"));
  });

  it("reports the initial mount as over once a reset has remounted", async () => {
    const { current, form } = mountProbe(true);
    expect(current().isInitialMount).toBe(true);

    form.reset();
    await vi.waitFor(() => {
      expect(current().isInitialMount).toBe(false);
    });
  });
});
