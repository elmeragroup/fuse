import { StrictMode, Suspense, startTransition, use, useRef, useState } from "react";
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

  it("shares one root listener across subscribers until the last one unmounts", async () => {
    const callbacks = Array.from({ length: 5 }, () => vi.fn());

    function Rows({ count }: { count: number }) {
      return (
        <form aria-label="Rows">
          {callbacks.slice(0, count).map((onReset, index) => (
            <Row key={index} onReset={onReset} />
          ))}
        </form>
      );
    }

    function Row({ onReset }: { onReset: () => void }) {
      const element = useRef<HTMLInputElement>(null);
      useFormReset(element, onReset);
      return <input aria-label="Row" ref={element} />;
    }

    async function resetRows(): Promise<void> {
      vi.useFakeTimers();
      try {
        formNamed("Rows").reset();
        await vi.runOnlyPendingTimersAsync();
      } finally {
        vi.useRealTimers();
      }
    }

    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(<Rows count={5} />);
    expect(resetCalls(add), "five subscribers, one listener").toHaveLength(1);

    await resetRows();
    expect(callbacks.map((onReset) => onReset.mock.calls.length)).toEqual([1, 1, 1, 1, 1]);

    rerender(<Rows count={4} />);
    expect(resetCalls(remove), "the remaining subscribers keep the listener").toEqual([]);
    await resetRows();
    expect(callbacks.map((onReset) => onReset.mock.calls.length)).toEqual([2, 2, 2, 2, 1]);

    unmount();
    expect(resetCalls(remove), "the last unsubscribe removes the listener it added").toEqual(resetCalls(add));
  });

  it("adds one listener per root for subscribers in the document and a shadow root", async () => {
    const shadowHost = document.createElement("div");
    document.body.append(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: "open" });
    const mountPoint = document.createElement("div");
    shadow.append(mountPoint);
    const light = [vi.fn(), vi.fn()];
    const shadowed = [vi.fn(), vi.fn()];

    function Pair({ label, callbacks }: { label: string; callbacks: Array<() => void> }) {
      const first = useRef<HTMLInputElement>(null);
      const second = useRef<HTMLInputElement>(null);
      useFormReset(first, callbacks[0] ?? null);
      useFormReset(second, callbacks[1] ?? null);
      return (
        <form aria-label={label}>
          <input aria-label={`${label} first`} ref={first} />
          <input aria-label={`${label} second`} ref={second} />
        </form>
      );
    }

    const documentAdd = vi.spyOn(document, "addEventListener");
    const shadowAdd = vi.spyOn(shadow, "addEventListener");
    const { unmount } = render(
      <>
        <Pair label="Light" callbacks={light} />
        {createPortal(<Pair label="Shadowed" callbacks={shadowed} />, mountPoint)}
      </>
    );
    expect(resetCalls(documentAdd)).toHaveLength(1);
    expect(resetCalls(shadowAdd)).toHaveLength(1);

    formNamed("Shadowed").reset();
    await vi.waitFor(() => {
      expect(shadowed.map((onReset) => onReset.mock.calls.length)).toEqual([1, 1]);
    });
    expect(light.map((onReset) => onReset.mock.calls.length)).toEqual([0, 0]);

    unmount();
    shadowHost.remove();
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
      // oxlint-disable-next-line react/globals -- test probe swaps the captured callback during a transition
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
