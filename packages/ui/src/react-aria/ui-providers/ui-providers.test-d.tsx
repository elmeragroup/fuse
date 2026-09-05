import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type * as RootApi from "@elmeragroup/ui";
import type * as UiProvidersApi from "@elmeragroup/ui/react-aria/ui-providers";
import type { UiProvidersProps } from "@elmeragroup/ui/react-aria/ui-providers";
import { UiProviders } from "@elmeragroup/ui/react-aria/ui-providers";
import type { SupportedLocale } from "@elmeragroup/ui/theme";

test("UiProviders is absent from the root barrel", () => {
  expectTypeOf<typeof RootApi>().not.toHaveProperty("UiProviders");
});

test("UserAgentParserResult is not a public ui-providers export", () => {
  // @ts-expect-error UserAgentParserResult is not a public type export
  type _NotExported = UiProvidersApi.UserAgentParserResult;
});

test("SupportedLocale is the four shipped locales and locale is required", () => {
  expectTypeOf<SupportedLocale>().toEqualTypeOf<"nb-NO" | "sv-SE" | "en-US" | "fi-FI">();
  expectTypeOf<UiProvidersProps["locale"]>().toEqualTypeOf<SupportedLocale>();
  expectTypeOf<UiProvidersProps["navigate"]>().toEqualTypeOf<(url: string) => void>();
  expectTypeOf<UiProvidersProps["children"]>().toEqualTypeOf<ReactNode>();
  expectTypeOf<UiProvidersProps>().toHaveProperty("locale");
  expectTypeOf<UiProvidersProps>().toHaveProperty("navigate");
  expectTypeOf<UiProvidersProps>().toHaveProperty("children");
  expectTypeOf<UiProvidersProps>().not.toHaveProperty("userAgent");

  const _ok: UiProvidersProps = {
    locale: "nb-NO",
    navigate: (url) => url,
    children: "child",
  };

  // @ts-expect-error locale is required
  const _missingLocale: UiProvidersProps = { navigate: (url) => url, children: "child" };

  // @ts-expect-error navigate is required
  const _missingNavigate: UiProvidersProps = { locale: "nb-NO", children: "child" };

  // @ts-expect-error children is required
  const _missingChildren: UiProvidersProps = { locale: "nb-NO", navigate: (url) => url };

  const _badLocale: UiProvidersProps = {
    // @ts-expect-error locale must be one of the four shipped values
    locale: "nn-NO",
    navigate: (url) => url,
    children: "child",
  };

  const _userAgent: UiProvidersProps = {
    locale: "en-US",
    navigate: (url) => url,
    children: "child",
    // @ts-expect-error userAgent was deleted from the public API
    userAgent: { os: "iOS" },
  };

  const _tree = (
    <UiProviders locale="nb-NO" navigate={(url) => url}>
      child
    </UiProviders>
  );
});
