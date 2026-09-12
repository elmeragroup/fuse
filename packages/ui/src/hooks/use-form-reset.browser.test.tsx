import { Suspense, startTransition, use, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import { createPortal } from "react-dom";
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

  it("does not subscribe when the callback is null", () => {
    const add = vi.spyOn(document, "addEventListener");
    mountProbe({ onReset: null });
    expect(resetCalls(add)).toEqual([]);
  });

  it("subscribes on the first commit without a state-driven extra render", () => {
    const add = vi.spyOn(document, "addEventListener");
    const onRender = vi.fn();
    mountProbe({ onReset: () => undefined, onRender });
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(resetCalls(add)).toHaveLength(1);
  });

  it("invokes the callback after native form.reset()", async () => {
    const onReset = vi.fn();
    const { form, input } = mountProbe({ onReset, defaultValue: "start" });
    input.value = "edited";
    form.reset();
    expect(onReset).not.toHaveBeenCalled();
    expect(input.value).toBe("start");
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });
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

  it("subscribes on the enclosing shadow root, where a document listener cannot see reset", async () => {
    const onReset = vi.fn();
    const shadowHost = document.createElement("div");
    document.body.append(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadow.append(mountPoint);

    function Shadowed() {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return createPortal(
        <form aria-label="Shadowed">
          <input aria-label="Field" ref={element} defaultValue="start" />
        </form>,
        mountPoint
      );
    }

    const add = vi.spyOn(document, "addEventListener");
    const { unmount } = render(<Shadowed />);
    expect(resetCalls(add), "no document reset listener for a shadow-root control").toEqual([]);

    formNamed("Shadowed").reset();
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    unmount();
    shadowHost.remove();
  });

  it("follows a control that attaches after the first commit in the light DOM", async () => {
    const onReset = vi.fn();

    function Late({ mounted }: { mounted: boolean }) {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return (
        <form aria-label="Late">
          {mounted ? <input aria-label="Field" ref={element} defaultValue="start" /> : null}
        </form>
      );
    }

    const { rerender } = render(<Late mounted={false} />);
    rerender(<Late mounted />);
    const input = inputNamed("Field");
    input.value = "edited";

    formNamed("Late").reset();

    // The listener was placed on `document` before the ref attached; the reset still reaches it.
    await vi.waitFor(() => {
      expect(onReset).toHaveBeenCalledTimes(1);
    });
    expect(input.value).toBe("start");
  });

  it("does not invoke the callback when reset is canceled", async () => {
    const onReset = vi.fn();
    const { form } = mountProbe({
      onReset,
      defaultValue: "start",
      onFormReset: (event) => {
        event.preventDefault();
      },
    });
    await expectNoDeferredReset(onReset, () => {
      form.reset();
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

  it("does not invoke the callback when unmounted before the deferred task", async () => {
    const onReset = vi.fn();
    const { form, unmount } = mountProbe({ onReset, defaultValue: "start" });
    await expectNoDeferredReset(onReset, () => {
      form.reset();
      unmount();
    });
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

  it("keeps the committed callback when a suspended update changes ownership", async () => {
    const onReset = vi.fn();
    const attempted = vi.fn();
    const never = new Promise<void>(() => undefined);
    let changeOwnership: () => void = () => undefined;

    function Suspended() {
      attempted();
      use(never);
      return null;
    }

    function Field({ controlled }: { controlled: boolean }) {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, controlled ? null : onReset);
      return (
        <form aria-label="Probe">
          <input aria-label="Field" ref={element} defaultValue="start" />
        </form>
      );
    }

    function App() {
      const [controlled, setControlled] = useState(false);
      changeOwnership = () => {
        startTransition(() => {
          setControlled(true);
        });
      };
      return (
        <Suspense fallback={<span>Waiting</span>}>
          <Field controlled={controlled} />
          {controlled ? <Suspended /> : null}
        </Suspense>
      );
    }

    render(<App />);
    const committedForm = formNamed("Probe");
    changeOwnership();
    await vi.waitFor(() => {
      expect(attempted).toHaveBeenCalled();
    });
    expect(formNamed("Probe"), "the committed field stays visible").toBe(committedForm);
    expect(committedForm.isConnected).toBe(true);

    vi.useFakeTimers();
    try {
      committedForm.reset();
      await vi.runOnlyPendingTimersAsync();
    } finally {
      vi.useRealTimers();
    }
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
