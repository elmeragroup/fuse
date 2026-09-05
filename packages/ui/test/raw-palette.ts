/**
 * The canonical raw-palette guard. Recipes must resolve to role tokens only — a literal
 * Tailwind palette color (`bg-zinc-*`, `text-red-*`, …) on a component recipe is a
 * retokenization defect. Every suite that asserts "no raw palette" shares this one
 * pattern so the colour list cannot fork per component.
 *
 * The deliberate exceptions live behind their own named constants (e.g. the overlay
 * scrim's allowlisted `bg-black/10`, dialog.md §5) and are asserted where they are owned.
 */
export const RAW_PALETTE_RE =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|gray|zinc|slate|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b/;
