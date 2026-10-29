import { createRef } from "react";

import type { FocusableOptions as RacFocusableOptions } from "react-aria";
// oxlint-disable-next-line typescript/consistent-type-imports -- typeof identity needs a value binding
import { useFocusable as useRacFocusable } from "react-aria";
import { expectTypeOf, test } from "vitest";

import type * as FocusableApi from "@elmeragroup/fuse/react-aria/focusable";
import type { FocusableOptions } from "@elmeragroup/fuse/react-aria/focusable";
import { Focusable, useFocusable } from "@elmeragroup/fuse/react-aria/focusable";

test("useFocusable and FocusableOptions keep the RAC types, and Focusable is a function", () => {
  expectTypeOf(Focusable).toBeFunction();
  expectTypeOf(useFocusable).toBeFunction();
  expectTypeOf(useFocusable).toEqualTypeOf<typeof useRacFocusable>();
  expectTypeOf<FocusableOptions>().toEqualTypeOf<RacFocusableOptions>();
});

test("Focusable takes the focus options, a ref and the DOM props a trigger passes its render element", () => {
  const _focusable = (
    <Focusable
      ref={createRef<HTMLElement>()}
      isDisabled={false}
      excludeFromTabOrder
      onFocusChange={() => undefined}
      onKeyDown={() => undefined}
      id="meter"
      className="cursor-help"
      data-slot="tooltip-trigger"
      aria-describedby="meter-hint"
      onPointerEnter={() => undefined}>
      <span role="button">Closed meter</span>
    </Focusable>
  );
  // @ts-expect-error the child is one element, not text
  const _text = <Focusable>Closed meter</Focusable>;
  const _children = (
    // @ts-expect-error the child is one element, not several
    <Focusable>
      <span role="button">Closed</span>
      <span role="button">meter</span>
    </Focusable>
  );
});

test("Focusable takes an SVG ref and an SVG child, as RAC Focusable does", () => {
  const _svg = (
    <Focusable ref={createRef<SVGSVGElement>()}>
      <svg role="img" aria-label="Meter" />
    </Focusable>
  );
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
