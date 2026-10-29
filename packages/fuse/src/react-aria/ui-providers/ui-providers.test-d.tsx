import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { UiProvidersProps } from "@elmeragroup/fuse/react-aria/ui-providers";
import { UiProviders } from "@elmeragroup/fuse/react-aria/ui-providers";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

// theme-api.test-d.tsx pins SupportedLocale itself to the four shipped locales.
test("locale, navigate and children are required, and locale is a SupportedLocale", () => {
  expectTypeOf<UiProvidersProps["locale"]>().toEqualTypeOf<SupportedLocale>();
  expectTypeOf<UiProvidersProps["navigate"]>().toEqualTypeOf<(url: string) => void>();
  expectTypeOf<UiProvidersProps["children"]>().toEqualTypeOf<ReactNode>();
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
