import { expectTypeOf, test } from "vitest";

import type {
  Button as RootButton,
  ScrollArea as RootScrollArea,
  ThemeInput as RootThemeInput,
} from "@elmeragroup/fuse";
import type { Button } from "@elmeragroup/fuse/button";
import { buttonVariants } from "@elmeragroup/fuse/button";
import type * as Icons from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import type { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import {
  ColorSchemeScript,
  colorSchemeScriptSource,
  ForceColorScheme,
  useColorScheme,
} from "@elmeragroup/fuse/theme";
import type {
  ColorSchemeOptions,
  ColorSchemeScriptProps,
  ForceColorSchemeProps,
  ThemeInput,
  ThemeProviderProps,
  UseColorSchemeResult,
} from "@elmeragroup/fuse/theme";

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
  expectTypeOf(ForceColorScheme).toBeFunction();
  expectTypeOf<ForceColorSchemeProps>().toHaveProperty("value");
  expectTypeOf(useColorScheme).parameters.toEqualTypeOf<[]>();
  expectTypeOf(useColorScheme).returns.toEqualTypeOf<UseColorSchemeResult>();
  expectTypeOf<ThemeProviderProps>().toHaveProperty("injectColorSchemeScript");
  expectTypeOf<ThemeProviderProps>().not.toHaveProperty("enableColorScheme");
});
