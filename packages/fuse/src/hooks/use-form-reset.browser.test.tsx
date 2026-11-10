import { StrictMode, useRef } from "react";
import type { FormEvent, ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { userEvent } from "vitest/browser";

import { render } from "../../test/browser-render";
import { formNamed, inputNamed, roleNamed } from "../../test/themed-browser-render";
import { useFormReset } from "./use-form-reset";

afterEach(() => {
  vi.restoreAllMocks();
});

function resetCalls(spy: { mock: { calls: unknown[][] } }): unknown[][] {
  return spy.mock.calls.filter((call) => call[0] === "reset");
}

type ProbeProps = {
  onReset: (() => void) | null;
  defaultValue?: string;
  /** Rendered inside the form after the input, e.g. a reset button. */
  children?: ReactNode;
  onFormReset?: (event: FormEvent<HTMLFormElement>) => void;
  onRender?: () => void;
};

/** One labelled form around one subscribed input: the shape every plain-DOM case shares. */
function Probe({ onReset, defaultValue, children, onFormReset, onRender }: ProbeProps) {
  onRender?.();
  const element = useRef<HTMLInputElement>(null);
  useFormReset(element, onReset);
  return (
    <form aria-label="Probe" onReset={onFormReset}>
      <input aria-label="Field" ref={element} defaultValue={defaultValue} />
      {children}
    </form>
  );
}

function mountProbe(props: ProbeProps) {
  const result = render(<Probe {...props} />);
  return { ...result, form: formNamed("Probe"), input: inputNamed("Field") };
}

/** Runs `act` under fake timers and drains the deferred task: the callback must stay silent. */
async function expectNoDeferredReset(onReset: Mock, act: () => void): Promise<void> {
  vi.useFakeTimers();
  try {
    act();
    await vi.runOnlyPendingTimersAsync();
    expect(onReset).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
}

/** A reset that must never reach the callback: the form handler, then what the test does. */
type SilentResetCase = {
  name: string;
  onFormReset?: (event: FormEvent<HTMLFormElement>) => void;
  act: (probe: { form: HTMLFormElement; unmount: () => void }) => void;
};

describe("useFormReset", () => {
  it("ignores a reset when the control belongs to no form", async () => {
    const onReset = vi.fn();

    function Detached() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <>
          <form aria-label="Elsewhere" />
          <input aria-label="Detached" ref={element} />
        </>
      );
    }

    render(<Detached />);
    await expectNoDeferredReset(onReset, () => {
      formNamed("Elsewhere").reset();
    });
  });

  it.each([
    { name: "no reset listener for a null callback", onReset: null, listeners: 0 },
    { name: "one reset listener for a callback", onReset: () => undefined, listeners: 1 },
  ])("adds $name on the first commit without a state-driven extra render", ({ onReset, listeners }) => {
    const add = vi.spyOn(document, "addEventListener");
    const onRender = vi.fn();
    mountProbe({ onReset, onRender });
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(resetCalls(add)).toHaveLength(listeners);
  });

  it("calls the callback once per native reset under StrictMode's double mount", async () => {
    const onReset = vi.fn();
    render(
      <StrictMode>
        <Probe onReset={onReset} />
      </StrictMode>
    );
    vi.useFakeTimers();
    try {
      formNamed("Probe").reset();
      await vi.runOnlyPendingTimersAsync();
      expect(onReset).toHaveBeenCalledTimes(1);
      formNamed("Probe").reset();
      await vi.runOnlyPendingTimersAsync();
      expect(onReset).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("invokes the callback after a reset button's default action has restored the control", async () => {
    // The button path differs from form.reset(): the reset event fires inside the click's
    // activation behaviour, so the deferred task is what lets the callback see the restored value.
    const seen: string[] = [];
    const onReset = vi.fn(() => {
      seen.push(inputNamed("Field").value);
    });
    const { input } = mountProbe({
      onReset,
      defaultValue: "start",
      children: <button type="reset">Reset</button>,
    });
    input.value = "edited";
    await userEvent.click(roleNamed("button", "Reset"));
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });
    expect(seen).toEqual(["start"]);
  });

  it.each<SilentResetCase>([
    {
      name: "reset is canceled",
      onFormReset: (event) => {
        event.preventDefault();
      },
      act: ({ form }) => {
        form.reset();
      },
    },
    {
      name: "unmounted before the deferred task",
      act: ({ form, unmount }) => {
        form.reset();
        unmount();
      },
    },
  ])("does not invoke the callback when $name", async ({ onFormReset, act }) => {
    const onReset = vi.fn();
    const probe = mountProbe({ onReset, defaultValue: "start", onFormReset });
    await expectNoDeferredReset(onReset, () => {
      act(probe);
    });
  });

  it("still invokes the callback when a form handler stops propagation", async () => {
    const onReset = vi.fn();
    const { form, input } = mountProbe({
      onReset,
      defaultValue: "start",
      onFormReset: (event) => {
        event.stopPropagation();
      },
    });
    input.value = "edited";
    vi.useFakeTimers();
    try {
      form.reset();
      await vi.runOnlyPendingTimersAsync();
    } finally {
      vi.useRealTimers();
    }
    expect(input.value, "the native reset still applied").toBe("start");
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("follows the control's form association without resubscribing", async () => {
    const onReset = vi.fn();

    function Reassociated({ formId }: { formId: string }) {
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

    const { rerender } = render(<Reassociated formId="a" />);
    const input = inputNamed("Field");
    const first = formNamed("First");
    const second = formNamed("Second");
    expect(input.form).toBe(first);

    // A reset on the form the control is not associated with must never reach the callback.
    second.reset();
    first.reset();
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    // The `form` attribute moves; the element and its subscription are never replaced.
    const add = vi.spyOn(document, "addEventListener");
    rerender(<Reassociated formId="b" />);
    expect(inputNamed("Field")).toBe(input);
    expect(resetCalls(add)).toEqual([]);
    expect(input.form).toBe(second);

    // Both forms reset in the same task: only the live association may add a call.
    first.reset();
    second.reset();
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(2);
    });
  });
});
