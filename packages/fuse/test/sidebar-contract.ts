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

export const SLOT_ROSTER = [
  "sidebar-wrapper",
  "sidebar",
  "sidebar-gap",
  "sidebar-container",
  "sidebar-inner",
  "sidebar-trigger",
  "sidebar-rail",
  "sidebar-inset",
  "sidebar-input",
  "sidebar-header",
  "sidebar-footer",
  "sidebar-separator",
  "sidebar-content",
  "sidebar-group",
  "sidebar-group-label",
  "sidebar-group-action",
  "sidebar-group-content",
  "sidebar-menu",
  "sidebar-menu-item",
  "sidebar-menu-button",
  "sidebar-menu-action",
  "sidebar-menu-badge",
  "sidebar-menu-skeleton",
  "sidebar-menu-skeleton-icon",
  "sidebar-menu-skeleton-text",
  "sidebar-menu-sub",
  "sidebar-menu-sub-item",
  "sidebar-menu-sub-button",
  "sidebar-icon",
] as const;
