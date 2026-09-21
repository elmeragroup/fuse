"use client";

import { useState } from "react";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { LocaleProvider } from "@elmeragroup/fuse/theme";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

const LOCALES = [
  { code: "nb-NO", label: "Norsk" },
  { code: "sv-SE", label: "Svenska" },
] as const satisfies readonly { code: SupportedLocale; label: string }[];

export function UiProvidersLocaleSwitch() {
  const [locale, setLocale] = useState<SupportedLocale>("nb-NO");

  return (
    <LocaleProvider locale={locale}>
      <label>
        Language
        <select
          value={locale}
          onChange={(event) => {
            const next = LOCALES.find((option) => option.code === event.target.value);
            if (next !== undefined) {
              setLocale(next.code);
            }
          }}>
          {LOCALES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Pagination.Root>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous href="#previous" />
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link href="#1" isActive>
              1
            </Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next href="#next" />
          </Pagination.Item>
        </Pagination.Content>
      </Pagination.Root>
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>Invoice 1042</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    </LocaleProvider>
  );
}
