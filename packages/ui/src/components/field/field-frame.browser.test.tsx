import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import { renderThemed, textboxNamed } from "../../../test/themed-browser-render";
import { Input } from "../input/input";
import { FieldFrame } from "./field-frame";

function fieldRootFrom(name: string): HTMLElement {
  const root = textboxNamed(name).closest("[data-slot=field]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected field root around ${name}`);
  }
  return root;
}

function statusSvgs(root: HTMLElement): SVGElement[] {
  return [...root.querySelectorAll("svg")];
}

describe("FieldFrame", () => {
  it("names the control and links the description and the error", () => {
    renderThemed(
      <FieldFrame label="Email" description="Work address preferred." errorMessage="Required" invalid>
        <Input />
      </FieldFrame>
    );

    const input = textboxNamed("Email");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const described = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("Work address preferred.");
    expect(page.getByRole("alert").element().textContent).toBe("Required");
  });

  it("omits the error when the message is falsy", () => {
    renderThemed(
      <FieldFrame label="Email">
        <Input />
      </FieldFrame>
    );
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("omits the label row entirely when there is no label, status, or crossfade", () => {
    renderThemed(
      <FieldFrame description="Only a description.">
        <Input aria-label="Bare" />
      </FieldFrame>
    );
    expect(fieldRootFrom("Bare").querySelector("label")).toBeNull();
    expect(page.getByText("Only a description.").query()).toBeTruthy();
  });

  it("renders a component-owned status face in the label row and forces the row to exist", () => {
    renderThemed(
      <FieldFrame status={<span>3/10</span>}>
        <Input aria-label="Counted" />
      </FieldFrame>
    );
    const counter = page.getByText("3/10").element();
    expect(fieldRootFrom("Counted").contains(counter)).toBe(true);
  });

  it("crossfades the pending and success faces, success winning", () => {
    renderThemed(
      <>
        <FieldFrame isPending>
          <Input aria-label="Pending" />
        </FieldFrame>
        <FieldFrame isPending isSuccess>
          <Input aria-label="Done" />
        </FieldFrame>
      </>
    );

    const pending = statusSvgs(fieldRootFrom("Pending"));
    expect(pending).toHaveLength(2);
    const pendingShown = pending.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(pendingShown).toHaveLength(1);
    expect(pendingShown[0]?.classList.contains("animate-spin")).toBe(true);

    const done = statusSvgs(fieldRootFrom("Done"));
    expect(done).toHaveLength(2);
    const doneShown = done.filter((svg) => getComputedStyle(svg).opacity === "1");
    expect(doneShown).toHaveLength(1);
    expect(doneShown[0]?.classList.contains("animate-spin")).toBe(false);
  });

  it("groups the control with the description when a content wrapper is asked for", () => {
    renderThemed(
      <FieldFrame label="Email" description="Grouped." contentClassName="flex flex-row">
        <Input />
      </FieldFrame>
    );
    const description = page.getByText("Grouped.").element();
    const wrapper = description.parentElement;
    if (!(wrapper instanceof HTMLElement)) {
      throw new Error("expected a content wrapper");
    }
    expect(wrapper.contains(textboxNamed("Email"))).toBe(true);
  });

  it("leaves the control and the description as siblings without a content wrapper", () => {
    renderThemed(
      <FieldFrame label="Email" description="Ungrouped.">
        <Input />
      </FieldFrame>
    );
    const description = page.getByText("Ungrouped.").element();
    expect(description.parentElement).toBe(fieldRootFrom("Email"));
  });
});
