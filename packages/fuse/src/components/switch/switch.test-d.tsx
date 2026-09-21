import { expectTypeOf, test } from "vitest";

import type { Switch as RootSwitch } from "@elmeragroup/fuse";
import type { SwitchProps } from "@elmeragroup/fuse/switch";
import { Switch } from "@elmeragroup/fuse/switch";

test("Switch ships from the switch entry and the root barrel", () => {
  expectTypeOf<typeof Switch>().toEqualTypeOf<typeof RootSwitch>();
  expectTypeOf(Switch).toBeFunction();
});

test("SwitchProps is the primitive surface plus the optical size axis", () => {
  expectTypeOf<SwitchProps["size"]>().toEqualTypeOf<"sm" | "default" | undefined>();
  expectTypeOf<SwitchProps["className"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SwitchProps["checked"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps["defaultChecked"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps["disabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps["required"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps["readOnly"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps["name"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SwitchProps["value"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<SwitchProps["nativeButton"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<SwitchProps>().toHaveProperty("onCheckedChange");
  expectTypeOf<SwitchProps>().toHaveProperty("inputRef");
  expectTypeOf<SwitchProps>().toHaveProperty("render");
  expectTypeOf<SwitchProps>().not.toHaveProperty("as");
  expectTypeOf<SwitchProps>().not.toHaveProperty("onChange");
});

test("the element takes the public props and no polymorphic as prop", () => {
  const _basic = <Switch aria-label="Notifications" />;
  const _sized = <Switch size="sm" className="ms-1" aria-label="Compact" />;
  const _controlled = <Switch checked onCheckedChange={() => undefined} aria-label="Held" />;
  const _form = <Switch name="alerts" value="on" defaultChecked inputRef={null} nativeButton />;

  // @ts-expect-error sizes are sm | default only
  const _badSize = <Switch size="md" />;
  // @ts-expect-error polymorphism is never an `as` prop
  const _noAs = <Switch as="div" />;
});
