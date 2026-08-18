import { expectTypeOf, test } from "vitest";

import type { ThemeInput as RootThemeInput } from "@elmeragroup/ui";
import type { ThemeInput, ThemeProviderProps } from "@elmeragroup/ui/theme";

test("workspace consumers resolve the same public subpaths as the published package", () => {
  expectTypeOf<RootThemeInput>().toEqualTypeOf<ThemeInput>();
  expectTypeOf<ThemeProviderProps["theme"]>().toEqualTypeOf<ThemeInput>();
});
