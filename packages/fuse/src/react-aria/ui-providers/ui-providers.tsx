"use client";

import type { ReactNode } from "react";

import { I18nProvider, RouterProvider } from "react-aria-components";

import { FuseProvider } from "../../theme/fuse";
import type { SupportedLocale } from "../../theme/fuse";

export type UiProvidersProps = {
  /**
   * App tree that receives the permanent locale context plus RAC i18n and
   * client-side routing. `UiProviders` renders no DOM of its own.
   */
  children: ReactNode;
  /**
   * The app router's navigate (for example Next.js `router.push`). RAC
   * link-capable components call this and keep the real `<a href>`.
   */
  navigate: (url: string) => void;
  /**
   * Required locale forwarded to `FuseProvider` and RAC
   * `I18nProvider`. One of the four shipped `SupportedLocale` values.
   */
  locale: SupportedLocale;
};

/**
 * Interim RAC convenience: permanent locale provider, then RAC i18n, then
 * RAC routing. Dies with the react-aria tier.
 */
export function UiProviders({ children, navigate, locale }: UiProvidersProps) {
  return (
    <FuseProvider locale={locale}>
      <I18nProvider locale={locale}>
        <RouterProvider navigate={navigate}>{children}</RouterProvider>
      </I18nProvider>
    </FuseProvider>
  );
}

UiProviders.displayName = "UiProviders";
