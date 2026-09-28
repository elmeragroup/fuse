import type { Ref } from "react";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import type { Field as FieldPrimitive } from "@base-ui/react/field";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { expectTypeOf, test } from "vitest";

import { Button } from "../components/button/button";
import { handoff } from "./part-handoff";

declare const maybeText: string | undefined;
declare const libraryRef: Ref<HTMLButtonElement>;
declare const buttonProps: ButtonPrimitive.Props;
declare const labelProps: FieldPrimitive.Label.Props;
declare const tabsListProps: TabsPrimitive.List.Props;
declare const tabProps: TabsPrimitive.Tab.Props;

test("a library default may never set Root or Field wiring", () => {
  // Each key exists on the part's props, so only the reserved-key rule rejects it.
  // @ts-expect-error Field owns the control id.
  handoff(buttonProps, { defaults: { id: "x" } });
  // @ts-expect-error Field.Label owns htmlFor.
  handoff(labelProps, { defaults: { htmlFor: "x" } });
  // @ts-expect-error Field.Label owns the labelling.
  handoff(buttonProps, { defaults: { "aria-labelledby": "x" } });
  // @ts-expect-error Field.Description owns the description.
  handoff(buttonProps, { defaults: { "aria-describedby": "x" } });
  // @ts-expect-error the Root owns the controlled popup id.
  handoff(buttonProps, { defaults: { "aria-controls": "x" } });
  // @ts-expect-error a name is never a library default.
  handoff(buttonProps, { defaults: { "aria-label": "x" } });
  // @ts-expect-error classes carry the library classes.
  handoff(buttonProps, { defaults: { className: "x" } });
  // @ts-expect-error `as` carries the library render target.
  handoff(buttonProps, { defaults: { render: <span /> } });
  // @ts-expect-error a library ref goes after the spread, since Base UI doesn't merge refs.
  handoff(buttonProps, { defaults: { ref: libraryRef } });

  handoff(buttonProps, { defaults: { "data-slot": "x", disabled: false, "aria-disabled": true } });
});

test("a reserved key is rejected outside a fresh literal too", () => {
  // Excess-property checks skip these shapes, so only the structural rule rejects them.
  const withId = { disabled: false, id: "x" };
  const withLabelledBy = { disabled: false, "aria-labelledby": "x" };
  const withControls = { disabled: false, "aria-controls": "x" };
  // @ts-expect-error Field owns the control id.
  handoff(buttonProps, { defaults: withId });
  // @ts-expect-error Field.Label owns the labelling.
  handoff(buttonProps, { defaults: withLabelledBy });
  // @ts-expect-error the Root owns the controlled popup id.
  handoff(buttonProps, { defaults: withControls });
  // @ts-expect-error Field owns the control id.
  handoff(buttonProps, { defaults: { ...withId } });
  // @ts-expect-error Field.Label owns the labelling.
  handoff(buttonProps, { defaults: { "data-slot": "x", ...withLabelledBy } });
  // @ts-expect-error the Root owns the controlled popup id.
  handoff(buttonProps, { defaults: { ...withControls } });

  const allowed = { "data-slot": "x", disabled: false };
  handoff(buttonProps, { defaults: allowed });
  handoff(buttonProps, { defaults: { ...allowed, "aria-disabled": true } });
});

test("a library default type-checks against the part's props", () => {
  // @ts-expect-error `activateOnFocus` is a boolean on Tabs.List.
  handoff(tabsListProps, { defaults: { activateOnFocus: "not-a-boolean" } });
  // @ts-expect-error a misspelled key is an excess property.
  handoff(tabsListProps, { defaults: { activateOnFcous: true } });

  handoff(tabsListProps, { defaults: { activateOnFocus: true, "data-slot": "tabs-list" } });
});

test("a required part prop stays required in the result", () => {
  const result = handoff(tabProps);
  type Value = Pick<typeof result, "value">;
  expectTypeOf<Partial<Value> extends Value ? "optional" : "required">().toEqualTypeOf<"required">();
  const tab = () => <TabsPrimitive.Tab {...handoff(tabProps)} />;
  expectTypeOf(tab).returns.toBeObject();
});

test("a className state callback cannot reach a string-only Fuse part", () => {
  const callback = (props: { children: string; className: (state: ButtonPrimitive.State) => string }) => (
    // @ts-expect-error Fuse Button takes a string className only.
    <Button {...handoff(props)} />
  );
  const string = (props: { children: string; className: string }) => <Button {...handoff(props)} />;
  expectTypeOf(callback).returns.toBeObject();
  expectTypeOf(string).returns.toBeObject();
});

test("a string className stays a string for string-only targets", () => {
  const result = handoff({ className: maybeText }, { classes: ["lib"] });
  expectTypeOf(result.className).toEqualTypeOf<string | undefined>();
});

test("the result spreads onto the part it was computed for", () => {
  const button = (props: ButtonPrimitive.Props) => <ButtonPrimitive {...handoff(props)} />;
  const withTarget = (props: CheckboxPrimitive.Root.Props) => (
    <CheckboxPrimitive.Root
      {...handoff(props, {
        as: (partProps, state: CheckboxPrimitive.Root.State) => (
          <span {...partProps} data-checked={state.checked} />
        ),
      })}
    />
  );
  expectTypeOf(button).returns.toBeObject();
  expectTypeOf(withTarget).returns.toBeObject();
});
