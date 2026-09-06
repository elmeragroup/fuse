import type { FocusableOptions as RacFocusableOptions } from "react-aria";
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof identity needs a value binding
import { useFocusable as useRacFocusable } from "react-aria";
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof identity needs a value binding
import { Focusable as RacFocusable } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as FocusableApi from "@elmeragroup/ui/react-aria/focusable";
import type { FocusableOptions } from "@elmeragroup/ui/react-aria/focusable";
import { Focusable, useFocusable } from "@elmeragroup/ui/react-aria/focusable";

test("Focusable and useFocusable are absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("Focusable");
  expectTypeOf<typeof RootApi>().not.toHaveProperty("useFocusable");
});

test("the public value surface is exactly Focusable and useFocusable", () => {
  expectTypeOf(Focusable).toBeFunction();
  expectTypeOf(useFocusable).toBeFunction();
  expectTypeOf<typeof FocusableApi.Focusable>().toEqualTypeOf<typeof Focusable>();
  expectTypeOf<typeof FocusableApi.useFocusable>().toEqualTypeOf<typeof useFocusable>();
});

test("the re-exports keep the RAC names as functions and FocusableOptions as the RAC type", () => {
  expectTypeOf(Focusable).toBeFunction();
  expectTypeOf(useFocusable).toBeFunction();
  expectTypeOf(Focusable).toEqualTypeOf<typeof RacFocusable>();
  expectTypeOf(useFocusable).toEqualTypeOf<typeof useRacFocusable>();
  expectTypeOf<FocusableOptions>().toEqualTypeOf<RacFocusableOptions>();
});

test("FocusableOptions is a public type and not a value export", () => {
  expectTypeOf<FocusableOptions>().toHaveProperty("isDisabled");
  expectTypeOf<FocusableOptions>().toHaveProperty("autoFocus");
  expectTypeOf<FocusableOptions>().toHaveProperty("excludeFromTabOrder");
  expectTypeOf<typeof FocusableApi>().not.toHaveProperty("FocusableOptions");
});

test("RAC-only names stay off the public surface", () => {
  expectTypeOf<typeof FocusableApi>().not.toHaveProperty("FocusableContext");
  expectTypeOf<typeof FocusableApi>().not.toHaveProperty("FocusableProvider");
  expectTypeOf<typeof FocusableApi>().not.toHaveProperty("FocusableAria");
  // @ts-expect-error RAC FocusableContext is not a public export
  type _NoContext = FocusableApi.FocusableContext;
  // @ts-expect-error RAC FocusableProvider is not a public export
  type _NoProvider = FocusableApi.FocusableProvider;
  // @ts-expect-error RAC FocusableAria is not a public export
  type _NoAria = FocusableApi.FocusableAria;
  // @ts-expect-error RAC FocusableProps is not a public export
  type _NoProps = FocusableApi.FocusableProps;
});

test("the elements take the public props", () => {
  const _focusable = (
    <Focusable isDisabled autoFocus excludeFromTabOrder onFocus={() => undefined}>
      <span>Offline</span>
    </Focusable>
  );
  const _options: FocusableOptions = {
    isDisabled: false,
    autoFocus: true,
    excludeFromTabOrder: true,
  };
});

test("there is no bare focusable entry", () => {
  // @ts-expect-error quarantined path only — never a bare focusable entry
  // oxlint-disable-next-line typescript/consistent-type-imports -- missing specifier is the assertion
  type _Bare = typeof import("@elmeragroup/ui/focusable");
});
