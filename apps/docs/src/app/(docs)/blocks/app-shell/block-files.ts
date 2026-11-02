/**
 * The app shell block's files, in its Code view's order: the shell, then the pages, then the data.
 * The docs tests check this list against the block's `demos/` directory, so a new file cannot be
 * left out of the Code view.
 */
export const BLOCK_FILES = [
  { file: "app-shell.tsx", folder: "Shell" },
  { file: "app-sidebar.tsx", folder: "Shell" },
  { file: "app-header.tsx", folder: "Shell" },
  { file: "command-menu.tsx", folder: "Shell" },
  { file: "user-menu.tsx", folder: "Shell" },
  { file: "page-header.tsx", folder: "Pages" },
  { file: "overview-page.tsx", folder: "Pages" },
  { file: "kpi-card.tsx", folder: "Pages" },
  { file: "metering-points-page.tsx", folder: "Pages" },
  { file: "invoices-page.tsx", folder: "Pages" },
  { file: "settings-page.tsx", folder: "Pages" },
  { file: "app-config.ts", folder: "Data" },
  { file: "power-data.ts", folder: "Data" },
] as const;

/**
 * The install command for the table engine the Metering points and Invoices pages build on. Fuse's
 * TanStack Table peer is optional, so the quick start's install leaves it out; the version range is
 * Fuse's own peer range, which a docs test holds this to.
 */
export const TABLE_INSTALL_COMMAND = "pnpm add @tanstack/react-table@^9.2";
