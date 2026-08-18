import { expectTypeOf, test } from "vitest";

import type { ThemeInput as RootThemeInput } from "@elmeragroup/ui";
import type * as Icons from "@elmeragroup/ui/icons";
import type { ElmeraIconProps } from "@elmeragroup/ui/icons";
import type { ThemeInput, ThemeProviderProps } from "@elmeragroup/ui/theme";

test("workspace consumers resolve the same public subpaths as the published package", () => {
  expectTypeOf<RootThemeInput>().toEqualTypeOf<ThemeInput>();
  expectTypeOf<ThemeProviderProps["theme"]>().toEqualTypeOf<ThemeInput>();
  expectTypeOf<(typeof Icons)["Check"]>().toBeFunction();
  expectTypeOf<ElmeraIconProps["weight"]>().toEqualTypeOf<"regular" | "fill" | undefined>();
});
