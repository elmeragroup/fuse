import type { ComponentProps, ReactElement } from "react";
import { createRef } from "react";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../dist/styles.css";
import { Frame, MOBILE, setupSidebarBrowser } from "../../test/sidebar-browser-fixtures";
import { DESCRIPTION_COPY, TITLE_COPY } from "../../test/sidebar-contract";
import { renderThemed, roleNamed, textboxNamed, textNamed } from "../../test/themed-browser-render";
import { Button } from "../components/button/button";
import type { ButtonProps } from "../components/button/button";
import { ConfirmButton } from "../components/confirm-button/confirm-button";
import { FieldSet } from "../components/field/field";
import { Input } from "../components/input/input";
import type { InputProps } from "../components/input/input";
import { TextField } from "../components/text-field/text-field";
import { TextareaField } from "../components/textarea-field/textarea-field";
import { handoff } from "./part-handoff";

// Harness parts: each renders a real Base UI part and hands consumer props to it through
// handoff, the way a Fuse module does.

function HarnessInput(props: ComponentProps<typeof InputPrimitive>): ReactElement {
  return <InputPrimitive {...handoff(props, { defaults: { "data-slot": "harness-input" } })} />;
}

function HarnessButton(props: ComponentProps<typeof ButtonPrimitive>): ReactElement {
  return <ButtonPrimitive {...handoff(props, { defaults: { "data-slot": "harness-button" } })} />;
}

function HarnessComboboxInput(props: ComponentProps<typeof ComboboxPrimitive.Input>): ReactElement {
  return <ComboboxPrimitive.Input {...handoff(props, { defaults: { disabled: false } })} />;
}

function HarnessControl({ ref, ...props }: ComponentProps<typeof FieldPrimitive.Control>): ReactElement {
  return (
    <FieldPrimitive.Control
      {...handoff(props, { as: (partProps) => <input {...partProps} data-harness-target="" /> })}
      ref={ref}
    />
  );
}

// Fuse-to-Fuse hops spread raw: the filter lives in the module that renders the Base UI part.

function WrappedInput(props: InputProps): ReactElement {
  return <Input {...props} />;
}

function WrappedButton(props: ButtonProps): ReactElement {
  return <Button {...props} />;
}

/** Field.Label's id is the control's aria-labelledby, so Field's own wiring names it. */
function expectFieldLabelled(control: HTMLElement, label: string): void {
  const labelId = textNamed(label).id;
  expect(labelId).not.toBe("");
  expect(control.getAttribute("aria-labelledby")).toBe(labelId);
  expect(control.id).not.toBe("");
}

describe("Field wiring survives a forwarded undefined", () => {
  it("keeps Field's label on a part whose consumer forwards id and aria-labelledby as undefined", () => {
    renderThemed(
      <FieldPrimitive.Root>
        <FieldPrimitive.Label>Email</FieldPrimitive.Label>
        <HarnessInput id={undefined} aria-labelledby={undefined} />
      </FieldPrimitive.Root>
    );
    expectFieldLabelled(textboxNamed("Email"), "Email");
  });

  it("keeps Field's label through a Fuse layer that spreads raw", () => {
    renderThemed(
      <FieldPrimitive.Root>
        <FieldPrimitive.Label>Email</FieldPrimitive.Label>
        <WrappedInput id={undefined} aria-labelledby={undefined} />
      </FieldPrimitive.Root>
    );
    expectFieldLabelled(textboxNamed("Email"), "Email");
  });

  it("keeps TextField's label when its consumer forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextField label="Email" id={undefined} aria-labelledby={undefined} />);
    expectFieldLabelled(textboxNamed("Email"), "Email");
  });

  it("keeps TextareaField's label when its consumer forwards id and aria-labelledby as undefined", () => {
    renderThemed(<TextareaField label="Bio" id={undefined} aria-labelledby={undefined} />);
    expectFieldLabelled(textboxNamed("Bio"), "Bio");
  });
});

describe("automatic aria-disabled survives a forwarded undefined", () => {
  it("keeps Base UI's aria-disabled on a focusable disabled part", async () => {
    renderThemed(
      <HarnessButton disabled focusableWhenDisabled aria-disabled={undefined}>
        Forwarded
      </HarnessButton>
    );
    const button = roleNamed("button", "Forwarded");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
  });

  it("keeps it through a Fuse Button layer that spreads raw", () => {
    renderThemed(
      <>
        <WrappedButton disabled focusableWhenDisabled aria-disabled={undefined}>
          Focusable
        </WrappedButton>
        <WrappedButton isPending focusableWhenDisabled aria-disabled={undefined}>
          Pending
        </WrappedButton>
        <WrappedButton render={<a href="/docs" />} nativeButton={false} disabled aria-disabled={undefined}>
          Anchor
        </WrappedButton>
        <WrappedButton disabled focusableWhenDisabled aria-disabled="false">
          Overridden
        </WrappedButton>
      </>
    );
    // WAI-ARIA: an element that is not natively disabled announces unavailability through aria-disabled.
    expect(roleNamed("button", "Focusable").getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("button", "Pending").getAttribute("aria-disabled")).toBe("true");
    expect(roleNamed("button", "Anchor").getAttribute("aria-disabled")).toBe("true");
    // A defined consumer value, false included, still wins.
    expect(roleNamed("button", "Overridden").getAttribute("aria-disabled")).toBe("false");
  });

  it("announces a focusable disabled ConfirmButton as disabled", () => {
    renderThemed(
      <ConfirmButton onConfirm={() => undefined} disabled focusableWhenDisabled>
        Delete
      </ConfirmButton>
    );
    expect(roleNamed("button", "Delete").getAttribute("aria-disabled")).toBe("true");
  });
});

describe("Root state beats a library default", () => {
  // A canary for Base UI ORing a part's own `disabled` with its Root's, not a handoff
  // regression test: a raw `disabled={false}` passes it too. Combobox's own Root and Field
  // disabled rows cover the #49 regression.
  it("canary: Base UI ORs Combobox.Root's disabled into the input's", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <ComboboxPrimitive.Root items={["Oslo"]} disabled>
          <HarnessComboboxInput aria-label="City" />
        </ComboboxPrimitive.Root>
        <button type="button">After</button>
      </>
    );
    const input = roleNamed("combobox", "City");
    expect(input).toBeDisabled();
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });
});

describe("Field state reaches a library render target", () => {
  it("disables TextareaField's textarea inside a disabled FieldSet, agreeing with Field", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <FieldSet disabled>
          <TextareaField label="Bio" />
        </FieldSet>
        <button type="button">After</button>
      </>
    );
    const textarea = textboxNamed("Bio");
    // The attribute itself, not only the native fieldset's inherited :disabled.
    expect(textarea.hasAttribute("disabled")).toBe(true);
    expect(textarea.hasAttribute("data-disabled")).toBe(true);
    roleNamed("button", "Before").focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(roleNamed("button", "After"));
  });
});

describe("library handlers run after the consumer's", () => {
  // Playwright's actionability check reads aria-disabled as disabled, so these rows
  // dispatch the native press the way the Button suite does.
  function pressDown(button: HTMLElement): MouseEvent {
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    return event;
  }

  it("runs a consumer onMouseDown before Button's visually-disabled preventDefault", () => {
    const seen: boolean[] = [];
    renderThemed(
      <Button isVisuallyDisabled onMouseDown={(event) => seen.push(event.defaultPrevented)}>
        Explain
      </Button>
    );
    const event = pressDown(roleNamed("button", "Explain"));
    expect(seen).toStrictEqual([false]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("lets a consumer skip Button's focus suppression with preventBaseUIHandler", () => {
    renderThemed(
      <Button
        isVisuallyDisabled
        onMouseDown={(event) => {
          event.preventBaseUIHandler();
        }}>
        Explain
      </Button>
    );
    expect(pressDown(roleNamed("button", "Explain")).defaultPrevented).toBe(false);
  });
});

describe("ref and focus with a library render target", () => {
  it("hands the consumer ref the DOM node and keeps Field's focus-on-label-click", async () => {
    const ref = createRef<HTMLInputElement>();
    renderThemed(
      <FieldPrimitive.Root>
        <FieldPrimitive.Label>Name</FieldPrimitive.Label>
        <HarnessControl ref={ref} />
      </FieldPrimitive.Root>
    );
    const input = textboxNamed("Name");
    expect(ref.current).toBe(input);
    expect(input.hasAttribute("data-harness-target")).toBe(true);
    await userEvent.click(page.getByText("Name", { exact: true }));
    expect(document.activeElement).toBe(input);
  });
});

describe("Sidebar mobile dialog", () => {
  setupSidebarBrowser();

  it("keeps the dialog's name, description and role when ARIA props are undefined", async () => {
    await page.viewport(MOBILE.width, MOBILE.height);
    renderThemed(
      <Frame root={{ "aria-labelledby": undefined, "aria-describedby": undefined, role: undefined }} />
    );

    await userEvent.click(roleNamed("button", "Toggle sidebar"));
    const dialog = page.getByRole("dialog", { name: TITLE_COPY["en-US"], exact: true });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription(DESCRIPTION_COPY["en-US"]);
  });
});
