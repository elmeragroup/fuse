import { useRef } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { render } from "../../test/browser-render";
import { useFormReset } from "./use-form-reset";

afterEach(() => {
  vi.restoreAllMocks();
});

function resetCalls(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.filter((call) => call[0] === "reset");
}

describe("useFormReset", () => {
  it("ignores a reset when the control belongs to no form", async () => {
    const onReset = vi.fn();

    function Probe() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <>
          <form aria-label="Elsewhere" />
          <input aria-label="Detached" ref={element} />
        </>
      );
    }

    const { host } = render(<Probe />);
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("expected a form");
    }
    vi.useFakeTimers();
    try {
      form.reset();
      await vi.runOnlyPendingTimersAsync();
      expect(onReset).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not subscribe when the callback is null", () => {
    const add = vi.spyOn(document, "addEventListener");

    function Probe() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, null);
      return (
        <form aria-label="Owned">
          <input aria-label="Field" ref={element} />
        </form>
      );
    }

    render(<Probe />);
    expect(resetCalls(add)).toEqual([]);
  });

  it("subscribes on the first commit without a state-driven extra render", () => {
    const add = vi.spyOn(document, "addEventListener");
    let renders = 0;

    function Probe() {
      renders += 1;
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, () => undefined);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={element} />
        </form>
      );
    }

    render(<Probe />);
    expect(renders).toBe(1);
    expect(resetCalls(add)).toHaveLength(1);
  });

  it("invokes the callback after native form.reset()", async () => {
    const onReset = vi.fn();

    function Probe() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={element} defaultValue="start" />
        </form>
      );
    }

    const { host } = render(<Probe />);
    const form = host.querySelector("form");
    const input = host.querySelector("input");
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) {
      throw new Error("expected a form control");
    }
    input.value = "edited";
    form.reset();
    expect(onReset).not.toHaveBeenCalled();
    expect(input.value).toBe("start");
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  it("does not invoke the callback when reset is canceled", async () => {
    const onReset = vi.fn();

    function Probe() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <form
          aria-label="Probe"
          onReset={(event) => {
            event.preventDefault();
          }}>
          <input aria-label="Field" ref={element} defaultValue="start" />
        </form>
      );
    }

    const { host } = render(<Probe />);
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("expected a form");
    }
    vi.useFakeTimers();
    try {
      form.reset();
      await vi.runOnlyPendingTimersAsync();
      expect(onReset).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes the reset listener on unmount", () => {
    function Probe() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, () => undefined);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={element} />
        </form>
      );
    }

    const { unmount } = render(<Probe />);
    const remove = vi.spyOn(document, "removeEventListener");
    unmount();
    expect(resetCalls(remove)).toHaveLength(1);
  });

  it("follows the control's form association without resubscribing", async () => {
    const onReset = vi.fn();

    function Probe({ formId }: { formId: string }) {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <>
          <form id="a" aria-label="First" />
          <form id="b" aria-label="Second" />
          <input aria-label="Field" ref={element} form={formId} defaultValue="start" />
        </>
      );
    }

    const { host, rerender } = render(<Probe formId="a" />);
    const input = host.querySelector("input");
    const first = host.querySelector("#a");
    const second = host.querySelector("#b");
    if (
      !(input instanceof HTMLInputElement) ||
      !(first instanceof HTMLFormElement) ||
      !(second instanceof HTMLFormElement)
    ) {
      throw new Error("expected associated forms");
    }
    expect(input.form).toBe(first);

    // A reset on the form the control is not associated with must never reach the callback.
    second.reset();
    first.reset();
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    // The `form` attribute moves; the element and its subscription are never replaced.
    const add = vi.spyOn(document, "addEventListener");
    rerender(<Probe formId="b" />);
    expect(host.querySelector("input")).toBe(input);
    expect(resetCalls(add)).toEqual([]);
    expect(input.form).toBe(second);

    // Both forms reset in the same task: only the live association may add a call.
    first.reset();
    second.reset();
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(2);
    });
    expect(onReset).toHaveBeenCalledTimes(2);
  });
});
