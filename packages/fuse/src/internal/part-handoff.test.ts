import { createElement, createRef } from "react";

import type { HTMLProps } from "@base-ui/react/types";
import { describe, expect, it } from "vitest";

import { handoff } from "./part-handoff";

/** Part props a test hands off, so `defaults` type-checks against them. */
type ProbeProps = {
  readonly "aria-disabled"?: boolean;
  readonly style?: { readonly color?: string; readonly margin?: number };
};

/**
 * The slice of a React synthetic event Base UI's merge reads: `nativeEvent` marks it
 * synthetic, and the merge installs `preventBaseUIHandler` on it before the handlers run.
 */
type ClickEvent = { readonly nativeEvent: Event; preventBaseUIHandler?: () => void };

function syntheticClick(): ClickEvent {
  return { nativeEvent: new Event("click") };
}

describe("handoff", () => {
  it("drops every present-undefined consumer key", () => {
    const result = handoff({ id: undefined, "aria-labelledby": undefined, title: "t" });
    expect(Object.keys(result)).toStrictEqual(["title"]);
  });

  it("keeps every defined falsy consumer value and a handler", () => {
    const calls: string[] = [];
    const result = handoff({
      id: undefined,
      title: "",
      tabIndex: 0,
      "aria-hidden": false,
      "aria-label": null,
      "aria-labelledby": "",
      onFocus: (_event: ClickEvent) => calls.push("consumer"),
    });
    // Base UI's merge wraps every handler, so the handler survives as one that still runs.
    const { onFocus, ...values } = result;
    expect(values).toStrictEqual({
      title: "",
      tabIndex: 0,
      "aria-hidden": false,
      "aria-label": null,
      "aria-labelledby": "",
    });
    onFocus(syntheticClick());
    expect(calls).toStrictEqual(["consumer"]);
  });

  it("lets a defined consumer prop beat a library default", () => {
    expect(handoff({ disabled: true }, { defaults: { disabled: false, "data-slot": "x" } })).toStrictEqual({
      disabled: true,
      "data-slot": "x",
    });
  });

  it("drops an undefined library default", () => {
    const props: ProbeProps = {};
    const result = handoff(props, { defaults: { "aria-disabled": undefined } });
    expect(Object.hasOwn(result, "aria-disabled")).toBe(false);
    expect(result).toStrictEqual({});
  });

  it("lets an explicit consumer false beat a library true", () => {
    expect(handoff({ "aria-disabled": false }, { defaults: { "aria-disabled": true } })).toStrictEqual({
      "aria-disabled": false,
    });
  });

  it("merges a consumer className string after the library classes", () => {
    expect(handoff({ className: "p-4 consumer" }, { classes: ["p-2 lib"] })).toStrictEqual({
      className: "lib p-4 consumer",
    });
  });

  it("evaluates a consumer className callback with the part state before merging", () => {
    const result = handoff(
      { className: (state: { open: boolean }) => (state.open ? "c-open" : "c") },
      { classes: ["lib"] }
    );
    if (!(result.className instanceof Function)) {
      throw new Error("expected the state callback to survive the merge");
    }
    expect(result.className({ open: true })).toBe("lib c-open");
    expect(result.className({ open: false })).toBe("lib c");
  });

  it("uses the library classes alone when the consumer passes no className", () => {
    expect(handoff({}, { classes: ["lib", false, "extra"] })).toStrictEqual({ className: "lib extra" });
  });

  it("omits className when neither side has classes", () => {
    expect(Object.hasOwn(handoff({ className: undefined }), "className")).toBe(false);
  });

  it("passes a consumer render through in place of the library target", () => {
    const consumerRender = createElement("a", { href: "/docs" });
    const result = handoff({ render: consumerRender }, { as: () => createElement("button") });
    expect(result.render).toBe(consumerRender);
  });

  it("renders the library target through a lowercase callback that receives the part props and state", () => {
    function Target(props: HTMLProps, state: string) {
      return createElement("span", { ...props, "data-state": state });
    }
    const result = handoff({}, { as: Target });
    if (!(result.render instanceof Function)) {
      throw new Error("expected the library target as a render callback");
    }
    // Base UI warns for a render callback named like a component.
    expect(result.render.name).toMatch(/^[a-z]/u);
    const element = result.render({ id: "part" }, "open");
    expect(element.props).toStrictEqual({ id: "part", "data-state": "open" });
  });

  it("runs the consumer handler before the library default", () => {
    const calls: string[] = [];
    const result = handoff(
      { onClick: (_event: ClickEvent) => calls.push("consumer") },
      { defaults: { onClick: () => calls.push("library") } }
    );
    result.onClick(syntheticClick());
    expect(calls).toStrictEqual(["consumer", "library"]);
  });

  it("lets the consumer handler skip the library default through preventBaseUIHandler", () => {
    const calls: string[] = [];
    const result = handoff(
      {
        onClick: (event: ClickEvent) => {
          calls.push("consumer");
          event.preventBaseUIHandler?.();
        },
      },
      { defaults: { onClick: () => calls.push("library") } }
    );
    result.onClick(syntheticClick());
    expect(calls).toStrictEqual(["consumer"]);
  });

  it("merges style objects with consumer keys winning", () => {
    const props: ProbeProps = { style: { color: "blue" } };
    expect(handoff(props, { defaults: { style: { color: "red", margin: 1 } } })).toStrictEqual({
      style: { color: "blue", margin: 1 },
    });
  });

  it("passes the consumer ref through untouched", () => {
    const ref = createRef<HTMLButtonElement>();
    expect(handoff({ ref }).ref).toBe(ref);
  });

  it("gives the same result when a layer hands off props that already went through handoff", () => {
    const defaults = { disabled: false, "data-slot": "x" };
    expect(handoff(handoff({ id: undefined, title: "t" }))).toStrictEqual({ title: "t" });
    expect(handoff(handoff({ disabled: true }, { defaults }), { defaults })).toStrictEqual({
      disabled: true,
      "data-slot": "x",
    });
    expect(
      handoff(handoff({ "aria-disabled": false }, { defaults: { "aria-disabled": true } }), {
        defaults: { "aria-disabled": true },
      })
    ).toStrictEqual({ "aria-disabled": false });
  });
});
