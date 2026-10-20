import { Result } from "effect";
import { describe, expect, it } from "vitest";

import { cellKey, forcedPseudoClasses, parseCell, parseVariantProperties, restingTwin } from "./cells";

describe("parseVariantProperties", () => {
  it("splits a key into its set and properties", () => {
    const parsed = Result.getOrThrow(
      parseVariantProperties("icon-button/variant=ghost,size=icon-xs,state=hover")
    );
    expect(parsed.set).toBe("icon-button");
    expect([...parsed.properties]).toEqual([
      ["variant", "ghost"],
      ["size", "icon-xs"],
      ["state", "hover"],
    ]);
  });
});

describe("parseCell", () => {
  it("reads a Button cell", () => {
    expect(Result.getOrThrow(parseCell("button/variant=ghost,size=sm,state=pending,icon=end"))).toEqual({
      component: "button",
      variant: "ghost",
      size: "sm",
      state: "pending",
      icon: "end",
    });
  });

  it("reads an Icon button cell", () => {
    expect(Result.getOrThrow(parseCell("icon-button/variant=destructive,size=icon-xs,state=hover"))).toEqual({
      component: "icon-button",
      variant: "destructive",
      size: "icon-xs",
      state: "hover",
    });
  });

  it("reads every state and icon of the kit's matrix", () => {
    const states = ["rest", "hover", "focus", "disabled", "pending"];
    const icons = ["none", "start", "end"];
    for (const state of states) {
      for (const icon of icons) {
        expect(Result.isSuccess(parseCell(`button/variant=link,size=lg,state=${state},icon=${icon}`))).toBe(
          true
        );
      }
    }
  });

  it.each([
    ["no component set", "variant=default,size=default,state=rest,icon=none", "no component set"],
    [
      "a set the harness does not render",
      "toggle/variant=default,size=default,state=rest",
      "component set toggle",
    ],
    [
      "an axis the harness does not render",
      "button/variant=default,size=sm,state=rest,icon=none,shape=pill",
      "axis shape",
    ],
    ["a missing axis", "button/variant=default,size=sm,state=rest", "no icon"],
    ["a variant the recipe lacks", "button/variant=primary,size=sm,state=rest,icon=none", "variant=primary"],
    ["a state the kit lacks", "button/variant=default,size=sm,state=open,icon=none", "state=open"],
    ["a square size on Button", "button/variant=default,size=icon,state=rest,icon=none", "size=icon"],
    ["a label size on Icon button", "icon-button/variant=default,size=sm,state=rest", "size=sm"],
    [
      "icon-inline, which the kit leaves out",
      "icon-button/variant=default,size=icon-inline,state=rest",
      "size=icon-inline",
    ],
    [
      "a property named twice",
      "button/variant=default,variant=ghost,size=sm,state=rest,icon=none",
      "variant twice",
    ],
    ["a property without a value", "button/variant,size=sm,state=rest,icon=none", "name=value"],
  ])("refuses %s", (_, key, reason) => {
    const result = parseCell(key);
    const message = Result.isFailure(result) ? result.failure.message : undefined;
    expect(message).toContain(key);
    expect(message).toContain(reason);
  });
});

describe("cellKey", () => {
  it.each([
    "button/variant=default,size=default,state=rest,icon=none",
    "button/variant=outline,size=xs,state=focus,icon=start",
    "icon-button/variant=success,size=icon-lg,state=disabled",
  ])("writes back %s", (key) => {
    expect(cellKey(Result.getOrThrow(parseCell(key)))).toBe(key);
  });
});

describe("forcedPseudoClasses", () => {
  it("forces :hover for hover, and :focus with :focus-visible for focus", () => {
    expect(forcedPseudoClasses("hover")).toEqual(["hover"]);
    expect(forcedPseudoClasses("focus")).toEqual(["focus", "focus-visible"]);
  });

  it("forces nothing for a state the markup draws", () => {
    expect(forcedPseudoClasses("disabled")).toEqual([]);
  });
});

describe("restingTwin", () => {
  it("keeps every axis but the state, which rests", () => {
    expect(
      restingTwin({ component: "button", variant: "destructive", size: "sm", state: "focus", icon: "end" })
    ).toEqual({ component: "button", variant: "destructive", size: "sm", state: "rest", icon: "end" });
  });
});
