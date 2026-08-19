import { expectTypeOf, test } from "vitest";

import type {
  Button as RootButton,
  ScrollArea as RootScrollArea,
  ThemeInput as RootThemeInput,
} from "@elmeragroup/ui";
import type { Button } from "@elmeragroup/ui/button";
import { buttonVariants } from "@elmeragroup/ui/button";
import type * as Icons from "@elmeragroup/ui/icons";
import type { ElmeraIconProps } from "@elmeragroup/ui/icons";
import type { ScrollArea } from "@elmeragroup/ui/scroll-area";
import { ColorSchemeScript, colorSchemeScriptSource } from "@elmeragroup/ui/theme";
import type {
  ColorSchemeOptions,
  ColorSchemeScriptProps,
  ThemeInput,
  ThemeProviderProps,
} from "@elmeragroup/ui/theme";

test("workspace consumers resolve the same public subpaths as the published package", () => {
  expectTypeOf<RootThemeInput>().toEqualTypeOf<ThemeInput>();
  expectTypeOf<ThemeProviderProps["theme"]>().toEqualTypeOf<ThemeInput>();
  expectTypeOf<(typeof Icons)["Check"]>().toBeFunction();
  expectTypeOf<ElmeraIconProps["weight"]>().toEqualTypeOf<"regular" | "fill" | undefined>();
  expectTypeOf<typeof Button>().toEqualTypeOf<typeof RootButton>();
  expectTypeOf<typeof ScrollArea>().toEqualTypeOf<typeof RootScrollArea>();
  expectTypeOf(buttonVariants).toBeFunction();
  expectTypeOf(colorSchemeScriptSource).toBeFunction();
  expectTypeOf(colorSchemeScriptSource).returns.toEqualTypeOf<string>();
  expectTypeOf(ColorSchemeScript).toBeFunction();
  expectTypeOf<ColorSchemeScriptProps>().toMatchTypeOf<ColorSchemeOptions>();
  expectTypeOf<ColorSchemeOptions>().toHaveProperty("forcedColorScheme");
});
