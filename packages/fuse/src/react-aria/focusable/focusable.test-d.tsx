import type { FocusableOptions as RacFocusableOptions } from "react-aria";
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof identity needs a value binding
import { useFocusable as useRacFocusable } from "react-aria";
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof identity needs a value binding
import { Focusable as RacFocusable } from "react-aria-components";
import { expectTypeOf, test } from "vitest";

import type * as FocusableApi from "@elmeragroup/fuse/react-aria/focusable";
import type { FocusableOptions } from "@elmeragroup/fuse/react-aria/focusable";
import { Focusable, useFocusable } from "@elmeragroup/fuse/react-aria/focusable";

test("the re-exports keep the RAC names as functions and FocusableOptions as the RAC type", () => {
  expectTypeOf(Focusable).toBeFunction();
  expectTypeOf(useFocusable).toBeFunction();
  expectTypeOf(Focusable).toEqualTypeOf<typeof RacFocusable>();
  expectTypeOf(useFocusable).toEqualTypeOf<typeof useRacFocusable>();
  expectTypeOf<FocusableOptions>().toEqualTypeOf<RacFocusableOptions>();
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
