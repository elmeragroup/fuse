/**
 * The Sidebar's published contract as data: the copy it renders per locale, and the slots
 * it stamps. Driver-free on purpose — the unit suite (`sidebar.test.ts`) and the browser
 * suite both assert against these tables, and only the browser side may import
 * `vitest/browser`, so the shared expectation cannot live in `sidebar-browser-fixtures`.
 */

export const TOGGLE_COPY = {
  "nb-NO": "Vis eller skjul sidepanelet",
  "sv-SE": "Visa eller dölj sidopanelen",
  "en-US": "Toggle sidebar",
  "fi-FI": "Näytä tai piilota sivupalkki",
} as const;

export const TITLE_COPY = {
  "nb-NO": "Sidepanel",
  "sv-SE": "Sidopanel",
  "en-US": "Sidebar",
  "fi-FI": "Sivupalkki",
} as const;

export const DESCRIPTION_COPY = {
  "nb-NO": "Viser sidepanelet.",
  "sv-SE": "Visar sidopanelen.",
  "en-US": "Displays the sidebar.",
  "fi-FI": "Näyttää sivupalkin.",
} as const;
