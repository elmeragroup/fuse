import { expectTypeOf, test } from "vitest";

import type {
  ColorSchemeOptions,
  ColorSchemeScriptElementProps,
  ColorSchemeScriptProps,
  ElmeraGroupUiProviderProps,
  SupportedLocale,
  ThemeInput,
  ThemeSlug,
  ThemeProviderProps,
} from "../theme";
import { ColorSchemeScript, colorSchemeScriptSource } from "../theme";
import type * as ThemeApi from "../theme";

test("ThemeInput and ThemeSlug reject illegal pinned-brand permutations", () => {
  expectTypeOf<{
    variant: "internal";
    brand: "fkab";
    segment: "company";
  }>().toExtend<ThemeInput>();
  expectTypeOf<{
    variant: "external";
    brand: "fkse";
    segment: "private";
  }>().toExtend<ThemeInput>();

  expectTypeOf<{
    variant: "internal";
    brand: "fkab";
    segment: "private";
  }>().not.toExtend<ThemeInput>();
  expectTypeOf<{
    variant: "external";
    brand: "fkse";
    segment: "company";
  }>().not.toExtend<ThemeInput>();

  expectTypeOf<"internal-fkab-company">().toExtend<ThemeSlug>();
  expectTypeOf<"external-fkse-private">().toExtend<ThemeSlug>();
  expectTypeOf<"internal-fkab-private">().not.toExtend<ThemeSlug>();
  expectTypeOf<"external-fkse-company">().not.toExtend<ThemeSlug>();
});

test("SupportedLocale is the four shipped locales and locale is required", () => {
  expectTypeOf<SupportedLocale>().toEqualTypeOf<"nb-NO" | "sv-SE" | "en-US" | "fi-FI">();
  expectTypeOf<ElmeraGroupUiProviderProps>().toHaveProperty("locale");
  expectTypeOf<ElmeraGroupUiProviderProps["locale"]>().toEqualTypeOf<SupportedLocale>();
  expectTypeOf<ThemeProviderProps["theme"]>().toEqualTypeOf<ThemeInput>();

  // @ts-expect-error locale is required
  const _missingLocale: ElmeraGroupUiProviderProps = { children: null };

  // @ts-expect-error locale must be one of the four shipped values
  const _badLocale: ElmeraGroupUiProviderProps = { locale: "nn-NO", children: null };

  const _fkabPrivate: ThemeProviderProps = {
    // @ts-expect-error fkab cannot be private
    theme: { variant: "internal", brand: "fkab", segment: "private" },
    children: null,
  };

  const _fkseCompany: ThemeProviderProps = {
    // @ts-expect-error fkse cannot be company
    theme: { variant: "external", brand: "fkse", segment: "company" },
    children: null,
  };
});

test("UserAgentParserResult is not a public theme export", () => {
  expectTypeOf<typeof ThemeApi>().not.toHaveProperty("UserAgentParserResult");
});

test("color-scheme bootstrap exports share ColorSchemeOptions including document force", () => {
  expectTypeOf(colorSchemeScriptSource).parameter(0).toMatchTypeOf<ColorSchemeOptions | undefined>();
  expectTypeOf(colorSchemeScriptSource).returns.toEqualTypeOf<string>();
  expectTypeOf<ColorSchemeOptions>().toHaveProperty("forcedColorScheme");
  expectTypeOf<ColorSchemeScriptProps>().toMatchTypeOf<ColorSchemeOptions>();
  expectTypeOf<ColorSchemeScriptProps>().toHaveProperty("nonce");
  expectTypeOf<ColorSchemeScriptProps>().toHaveProperty("scriptProps");
  expectTypeOf<ColorSchemeScriptElementProps>().toHaveProperty("data-cfasync");
  expectTypeOf<ColorSchemeScriptElementProps>().not.toHaveProperty("type");
  expectTypeOf<ColorSchemeScriptElementProps>().not.toHaveProperty("src");
  expectTypeOf<ColorSchemeScriptElementProps>().not.toHaveProperty("children");
  expectTypeOf<ColorSchemeScriptElementProps>().not.toHaveProperty("dangerouslySetInnerHTML");

  const _script = (
    <ColorSchemeScript forcedColorScheme="dark" nonce="csp" scriptProps={{ "data-cfasync": "false" }} />
  );

  // @ts-expect-error type cannot replace the classic script
  const _type: ColorSchemeScriptElementProps = { type: "module" };
  // @ts-expect-error src cannot replace the generated body
  const _src: ColorSchemeScriptElementProps = { src: "/theme.js" };
  // @ts-expect-error children cannot replace the generated body
  const _children: ColorSchemeScriptElementProps = { children: "alert(1)" };
  // @ts-expect-error inner HTML cannot replace the generated body
  const _html: ColorSchemeScriptElementProps = { dangerouslySetInnerHTML: { __html: "alert(1)" } };
});
