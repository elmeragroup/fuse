import { createRef } from "react";

import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { declaredRole } from "../../../test/declared-role";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Button } from "../../components/button/button";
import { Toolbar } from "../../components/toolbar";
import { Tooltip } from "../../components/tooltip";
import { Focusable } from "./focusable";

describe("Focusable", () => {
  it("passes a tooltip trigger's slot, description and hover onto its child", async () => {
    renderThemed(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Focusable>
                <span role="button" aria-disabled="true">
                  Closed meter
                </span>
              </Focusable>
            }
          />
          <Tooltip.Content>The meter is already closed.</Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    );

    const trigger = roleNamed("button", "Closed meter");
    expect(trigger.getAttribute("data-slot")).toBe("tooltip-trigger");

    await userEvent.hover(trigger);
    await expect
      .element(page.getByRole("tooltip", { name: "The meter is already closed.", exact: true }))
      .toBeInTheDocument();
    const tooltip = roleNamed("tooltip", "The meter is already closed.");
    expect(trigger.getAttribute("aria-describedby")?.split(" ")).toContain(tooltip.id);
  });

  it("runs a handler the trigger passes and one on the child once each", async () => {
    const onTriggerClick = vi.fn<() => void>();
    const onChildClick = vi.fn<() => void>();
    const onTriggerFocus = vi.fn<() => void>();
    const onChildFocus = vi.fn<() => void>();
    renderThemed(
      <Tooltip.Root>
        <Tooltip.Trigger
          onClick={onTriggerClick}
          onFocus={onTriggerFocus}
          render={
            <Focusable>
              {/* oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- Focusable supplies the tab stop */}
              <span role="button" onClick={onChildClick} onFocus={onChildFocus}>
                Meter
              </span>
            </Focusable>
          }
        />
        <Tooltip.Content>Meter details</Tooltip.Content>
      </Tooltip.Root>
    );

    await userEvent.click(roleNamed("button", "Meter"));

    expect(onTriggerClick).toHaveBeenCalledTimes(1);
    expect(onChildClick).toHaveBeenCalledTimes(1);
    expect(onTriggerFocus).toHaveBeenCalledTimes(1);
    expect(onChildFocus).toHaveBeenCalledTimes(1);
  });

  it("hands its ref and the child's own ref the same element", () => {
    const outer = createRef<HTMLElement>();
    const inner = createRef<HTMLSpanElement>();
    renderThemed(
      <Focusable ref={outer}>
        <span ref={inner} role="button">
          Meter
        </span>
      </Focusable>
    );

    const button = roleNamed("button", "Meter");
    expect(outer.current).toBe(button);
    expect(inner.current).toBe(button);
  });

  it("remounts its child when the child's key changes", async () => {
    const field = (id: string) => (
      <Focusable>
        <input key={id} aria-label="Meter number" defaultValue="100" />
      </Focusable>
    );
    const { rerender } = renderThemed(field("first"));

    await userEvent.fill(roleNamed("textbox", "Meter number"), "250");
    rerender(field("second"));

    expect(roleNamed("textbox", "Meter number")).toHaveProperty("value", "100");
  });

  it("marks its child, keeping a value the child sets itself", () => {
    renderThemed(
      <>
        <Focusable>
          <span role="button">Marked</span>
        </Focusable>
        <Focusable>
          <span role="button" data-focusable-child="meter">
            Own value
          </span>
        </Focusable>
      </>
    );

    expect(roleNamed("button", "Marked").getAttribute("data-focusable-child")).toBe("");
    expect(roleNamed("button", "Own value").getAttribute("data-focusable-child")).toBe("meter");
  });

  // Inline text reads no control metric; a Button on an anchor, or a toolbar button Base UI keeps
  // focusable while disabled, still reads the control metrics.
  it("declares a tooltip trigger fixed through Focusable, and control through a Button", () => {
    renderThemed(
      <>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              <Focusable>
                <span role="button">Closed meter</span>
              </Focusable>
            }
          />
          <Tooltip.Content>The meter is already closed.</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger render={<Button nativeButton={false} render={<a href="#meters" />} />}>
            Meters
          </Tooltip.Trigger>
          <Tooltip.Content>Every meter on the account.</Tooltip.Content>
        </Tooltip.Root>
        <Toolbar.Root aria-label="Meter actions">
          <Tooltip.Root>
            <Tooltip.Trigger render={<Toolbar.Button render={<Button />} />}>Read</Tooltip.Trigger>
            <Tooltip.Content>Read the meter now.</Tooltip.Content>
          </Tooltip.Root>
        </Toolbar.Root>
      </>
    );

    expect(declaredRole(roleNamed("button", "Closed meter"))).toBe("fixed");
    expect(declaredRole(roleNamed("button", "Meters"))).toBe("control");
    expect(declaredRole(roleNamed("button", "Read"))).toBe("control");
  });
});
