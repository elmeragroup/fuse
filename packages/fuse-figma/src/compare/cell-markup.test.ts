import { describe, expect, it } from "vitest";

import { cellMarkup, restingTwin } from "./cell-markup";

describe("cellMarkup", () => {
  it("renders a plain label Button at rest", () => {
    expect(
      cellMarkup({ component: "button", variant: "default", size: "default", state: "rest", icon: "none" })
    ).toEqual({
      props: { kind: "label", variant: "default", size: "default", disabled: false, isPending: false },
      children: [{ kind: "label", text: "Button" }],
      forced: [],
    });
  });

  it("puts a start icon before the label with the inline-start marker", () => {
    expect(
      cellMarkup({ component: "button", variant: "outline", size: "sm", state: "rest", icon: "start" })
        .children
    ).toEqual([
      { kind: "icon", icon: "Plus", dataIcon: "inline-start" },
      { kind: "label", text: "Button" },
    ]);
  });

  it("puts an end icon after the label with the inline-end marker", () => {
    expect(
      cellMarkup({ component: "button", variant: "outline", size: "sm", state: "rest", icon: "end" }).children
    ).toEqual([
      { kind: "label", text: "Button" },
      { kind: "icon", icon: "ArrowRight", dataIcon: "inline-end" },
    ]);
  });

  it("disables a disabled cell and leaves it unforced", () => {
    const markup = cellMarkup({
      component: "button",
      variant: "ghost",
      size: "lg",
      state: "disabled",
      icon: "none",
    });
    expect(markup.props).toEqual({
      kind: "label",
      variant: "ghost",
      size: "lg",
      disabled: true,
      isPending: false,
    });
    expect(markup.forced).toEqual([]);
  });

  it("marks a pending cell isPending, not disabled, and keeps its own icon", () => {
    const markup = cellMarkup({
      component: "button",
      variant: "success",
      size: "xs",
      state: "pending",
      icon: "start",
    });
    expect(markup.props).toEqual({
      kind: "label",
      variant: "success",
      size: "xs",
      disabled: false,
      isPending: true,
    });
    expect(markup.children[0]).toEqual({ kind: "icon", icon: "Plus", dataIcon: "inline-start" });
  });

  it("forces :hover for hover, and :focus with :focus-visible for focus", () => {
    const at = (state: "hover" | "focus") =>
      cellMarkup({ component: "button", variant: "link", size: "default", state, icon: "none" }).forced;
    expect(at("hover")).toEqual(["hover"]);
    expect(at("focus")).toEqual(["focus", "focus-visible"]);
  });

  it("renders an icon button as a bare Plus named by aria-label", () => {
    expect(
      cellMarkup({ component: "icon-button", variant: "secondary", size: "icon-sm", state: "hover" })
    ).toEqual({
      props: {
        kind: "icon",
        variant: "secondary",
        size: "icon-sm",
        disabled: false,
        isPending: false,
        ariaLabel: "Button",
      },
      children: [{ kind: "icon", icon: "Plus", dataIcon: undefined }],
      forced: ["hover"],
    });
  });
});

describe("restingTwin", () => {
  it("keeps every axis but the state, which rests", () => {
    expect(
      restingTwin({ component: "button", variant: "destructive", size: "sm", state: "focus", icon: "end" })
    ).toEqual({ component: "button", variant: "destructive", size: "sm", state: "rest", icon: "end" });
  });
});
