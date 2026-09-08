import { useState } from "react";

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
  it("does not subscribe without an element or a form", () => {
    const add = vi.spyOn(HTMLFormElement.prototype, "addEventListener");
    const onReset = vi.fn();

    function Detached() {
      const [element, setElement] = useState<HTMLInputElement | null>(null);
      useFormReset(element, onReset);
      return <input aria-label="Detached" ref={setElement} />;
    }

    function Absent() {
      useFormReset(null, onReset);
      return <form aria-label="Empty" />;
    }

    render(<Detached />);
    expect(resetCalls(add)).toEqual([]);

    render(<Absent />);
    expect(resetCalls(add)).toEqual([]);
  });

  it("does not subscribe when the callback is null", () => {
    const add = vi.spyOn(HTMLFormElement.prototype, "addEventListener");

    function Probe() {
      const [element, setElement] = useState<HTMLInputElement | null>(null);
      useFormReset(element, null);
      return (
        <form aria-label="Owned">
          <input aria-label="Field" ref={setElement} />
        </form>
      );
    }

    render(<Probe />);
    expect(resetCalls(add)).toEqual([]);
  });

  it("invokes the callback after native form.reset()", async () => {
    const onReset = vi.fn();

    function Probe() {
      const [element, setElement] = useState<HTMLInputElement | null>(null);
      useFormReset(element, onReset);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={setElement} defaultValue="start" />
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
      const [element, setElement] = useState<HTMLInputElement | null>(null);
      useFormReset(element, onReset);
      return (
        <form
          aria-label="Probe"
          onReset={(event) => {
            event.preventDefault();
          }}>
          <input aria-label="Field" ref={setElement} defaultValue="start" />
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
      const [element, setElement] = useState<HTMLInputElement | null>(null);
      useFormReset(element, () => undefined);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={setElement} />
        </form>
      );
    }

    const { host, unmount } = render(<Probe />);
    const form = host.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("expected a form");
    }
    const remove = vi.spyOn(form, "removeEventListener");
    unmount();
    expect(remove.mock.calls.some(([type]) => type === "reset")).toBe(true);
  });
});
