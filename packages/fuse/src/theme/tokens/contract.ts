export const TOKEN_NAMES = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "popover",
  "popover-foreground",
  "dialog",
  "dialog-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-hover",
  "secondary-soft",
  "secondary-soft-foreground",
  "brand",
  "brand-foreground",
  "error",
  "error-foreground",
  "error-soft",
  "error-soft-foreground",
  "info",
  "info-foreground",
  "info-soft",
  "info-soft-foreground",
  "success",
  "success-foreground",
  "success-soft",
  "success-soft-foreground",
  "warning",
  "warning-foreground",
  "warning-soft",
  "warning-soft-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "card-border",
  "card-section-divider",
  "card-shadow",
  "button-outline",
  "selection-border",
  "selection-checked-border",
  "selection-divider",
  "selection-checked-divider",
  "selection-disabled-background",
  "selection-disabled-hatch",
  "selection-disabled-foreground",
  "sidebar",
  "sidebar-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "sidebar-brand",
  "sidebar-brand-foreground",
  "right-panel",
  "right-panel-foreground",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
  "sh-identifier",
  "sh-keyword",
  "sh-string",
  "sh-class",
  "sh-property",
  "sh-entity",
  "sh-jsxliterals",
  "sh-sign",
  "sh-comment",
  "radius",
  "radius-button",
  "radius-field",
  "radius-step",
  "button-outline-width",
  "selection-title-weight",
  "paragraph-leading-sm",
  "paragraph-leading-base",
  "paragraph-leading-lg",
  "heading-1-size",
  "heading-1-leading",
  "heading-1-weight",
  "heading-2-size",
  "heading-2-leading",
  "heading-2-weight",
  "heading-3-size",
  "heading-3-leading",
  "heading-3-weight",
  "font-sans",
  "font-heading",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export type TokenContract = {
  [Name in TokenName]: string;
};

/**
 * A derived role, mixed from one composed role toward another in OKLCH. `derived-tokens.ts`
 * reads the entry twice. Composition computes the literal that the catalog, the docs and
 * design tools store, and the CSS emitter writes the matching `color-mix()`.
 */
export type OklchMixRole = {
  /** Emitted as a live `color-mix()`. */
  readonly _tag: "OklchMix";
  /** The role the mix starts from. */
  readonly from: TokenName;
  /** The role the mix moves toward. */
  readonly toward: TokenName;
  /** The share of `toward` in percent, as CSS `color-mix()` spells it. */
  readonly percent: number;
};

/**
 * A derived role that composition computes at build time from the roles it reads. Per theme,
 * composition picks either a literal color or an alias of a source, such as `var(--brand)`, and
 * theme rules declare that choice. A literal does not follow a host override of a source; an
 * alias does.
 */
export type ComposedRole = {
  /** Emitted as the composed value. */
  readonly _tag: "Composed";
  /** Every role the computation reads. */
  readonly sources: readonly TokenName[];
};

/** How the pipeline derives a role, and so how the CSS emitter declares it. */
export type DerivedRole = OklchMixRole | ComposedRole;

/**
 * The roles the pipeline computes from other composed roles instead of reading them from
 * a layer, each with the only roles it reads. The reset closure reads the same entry, so a
 * scope that resets a source always resets the derived role too.
 */
export const DERIVED_ROLES = {
  // The secondary Button hover, which the recipe used to spell as an inline color-mix().
  "secondary-hover": { _tag: "OklchMix", from: "secondary", toward: "foreground", percent: 5 },
  // The brand on the sidebar, stepped to 4.5:1 there, and the text on its fill. See
  // `sidebar-brand.ts`.
  "sidebar-brand": { _tag: "Composed", sources: ["brand", "sidebar"] },
  "sidebar-brand-foreground": {
    _tag: "Composed",
    sources: ["brand", "brand-foreground", "sidebar", "sidebar-foreground"],
  },
} as const satisfies Partial<Record<TokenName, DerivedRole>>;

/** A role the pipeline computes from other composed roles. */
export type DerivedTokenName = keyof typeof DERIVED_ROLES;

/** A role a palette, sheet, pointer or the defaults assign directly. */
export type LayerTokenName = Exclude<TokenName, DerivedTokenName>;

/** Every role a layer can assign, each with a value. It is a composed theme before derivation. */
export type LayerTokens = Pick<TokenContract, LayerTokenName>;

/**
 * The roles one layer assigns. A derived role is not assignable, so a layer cannot set a
 * value that composition would overwrite.
 */
export type TokenLayer = Partial<LayerTokens>;

/**
 * Whether the pipeline computes this role rather than reading it from a layer.
 *
 * @param name - A contract token name.
 * @returns `true` for a derived role.
 */
export function isDerivedTokenName(name: TokenName): name is DerivedTokenName {
  return Object.hasOwn(DERIVED_ROLES, name);
}

function isLayerTokenName(name: TokenName): name is LayerTokenName {
  return !isDerivedTokenName(name);
}

/**
 * The roles a derived role reads, straight from its `DERIVED_ROLES` entry.
 *
 * @param name - A derived role.
 * @returns The roles its value is computed from.
 */
export function derivedRoleSources(name: DerivedTokenName): readonly LayerTokenName[] {
  const role = DERIVED_ROLES[name];
  return role._tag === "OklchMix" ? [role.from, role.toward] : role.sources;
}

/** Every role a layer can assign, in `TOKEN_NAMES` order. */
const LAYER_TOKEN_NAMES: readonly LayerTokenName[] = TOKEN_NAMES.filter(isLayerTokenName);

/** What a token's CSS value holds, which decides how exporters translate it. */
export type TokenKind = "color" | "dimension" | "fontFamily" | "fontWeight";

/**
 * The kind of every token. A new token without a kind fails to compile, so no exporter
 * can file it under a default.
 */
export const TOKEN_KINDS = {
  background: "color",
  foreground: "color",
  card: "color",
  "card-foreground": "color",
  "card-soft": "color",
  "card-soft-foreground": "color",
  popover: "color",
  "popover-foreground": "color",
  dialog: "color",
  "dialog-foreground": "color",
  muted: "color",
  "muted-foreground": "color",
  accent: "color",
  "accent-foreground": "color",
  feature: "color",
  "feature-bright": "color",
  "feature-foreground": "color",
  primary: "color",
  "primary-foreground": "color",
  "primary-soft": "color",
  "primary-soft-foreground": "color",
  secondary: "color",
  "secondary-foreground": "color",
  "secondary-hover": "color",
  "secondary-soft": "color",
  "secondary-soft-foreground": "color",
  brand: "color",
  "brand-foreground": "color",
  error: "color",
  "error-foreground": "color",
  "error-soft": "color",
  "error-soft-foreground": "color",
  info: "color",
  "info-foreground": "color",
  "info-soft": "color",
  "info-soft-foreground": "color",
  success: "color",
  "success-foreground": "color",
  "success-soft": "color",
  "success-soft-foreground": "color",
  warning: "color",
  "warning-foreground": "color",
  "warning-soft": "color",
  "warning-soft-foreground": "color",
  destructive: "color",
  "destructive-foreground": "color",
  border: "color",
  input: "color",
  ring: "color",
  "card-border": "color",
  "card-section-divider": "color",
  "card-shadow": "color",
  "button-outline": "color",
  "selection-border": "color",
  "selection-checked-border": "color",
  "selection-divider": "color",
  "selection-checked-divider": "color",
  "selection-disabled-background": "color",
  "selection-disabled-hatch": "color",
  "selection-disabled-foreground": "color",
  sidebar: "color",
  "sidebar-foreground": "color",
  "sidebar-accent": "color",
  "sidebar-accent-foreground": "color",
  "sidebar-border": "color",
  "sidebar-ring": "color",
  "sidebar-brand": "color",
  "sidebar-brand-foreground": "color",
  "right-panel": "color",
  "right-panel-foreground": "color",
  "chart-1": "color",
  "chart-2": "color",
  "chart-3": "color",
  "chart-4": "color",
  "chart-5": "color",
  "chart-6": "color",
  "chart-7": "color",
  "chart-8": "color",
  "sh-identifier": "color",
  "sh-keyword": "color",
  "sh-string": "color",
  "sh-class": "color",
  "sh-property": "color",
  "sh-entity": "color",
  "sh-jsxliterals": "color",
  "sh-sign": "color",
  "sh-comment": "color",
  radius: "dimension",
  "radius-button": "dimension",
  "radius-field": "dimension",
  "radius-step": "dimension",
  "button-outline-width": "dimension",
  "selection-title-weight": "fontWeight",
  "paragraph-leading-sm": "dimension",
  "paragraph-leading-base": "dimension",
  "paragraph-leading-lg": "dimension",
  "heading-1-size": "dimension",
  "heading-1-leading": "dimension",
  "heading-1-weight": "fontWeight",
  "heading-2-size": "dimension",
  "heading-2-leading": "dimension",
  "heading-2-weight": "fontWeight",
  "heading-3-size": "dimension",
  "heading-3-leading": "dimension",
  "heading-3-weight": "fontWeight",
  "font-sans": "fontFamily",
  "font-heading": "fontFamily",
} as const satisfies Record<TokenName, TokenKind>;

/** A contract token whose value is a color. */
export type ColorTokenName = {
  [Name in TokenName]: (typeof TOKEN_KINDS)[Name] extends "color" ? Name : never;
}[TokenName];

/**
 * Where a color is painted. A `surface` fills an area, such as a card or a badge. An `ink`
 * colors text and the icons that take the text color through `currentColor`. A `line` draws a
 * border, ring, outline or divider.
 */
export type TokenPaint = "surface" | "ink" | "line";

/**
 * Where Fuse paints each color role. Exporters read it to offer a role only where it belongs,
 * such as the Figma sync's picker scopes. The source contract in `source-contracts.test.ts`
 * requires every color utility the library writes on a role to fall inside the role's paints.
 * A role no component paints takes the paints its name and the docs demos give it. A new color
 * token without an entry fails to compile.
 */
export const TOKEN_PAINTS = {
  background: ["surface", "ink", "line"],
  foreground: ["surface", "ink", "line"],
  card: ["surface"],
  "card-foreground": ["ink"],
  "card-soft": ["surface"],
  "card-soft-foreground": ["ink"],
  popover: ["surface"],
  "popover-foreground": ["ink"],
  dialog: ["surface"],
  "dialog-foreground": ["ink"],
  // GridList draws a disabled checkbox edge in it through its `--checkbox-color` route.
  muted: ["surface", "line"],
  "muted-foreground": ["surface", "ink", "line"],
  accent: ["surface"],
  "accent-foreground": ["ink"],
  feature: ["surface"],
  "feature-bright": ["surface"],
  // Not text-grade, so Fuse fills accent shapes with it and never sets text in it.
  "feature-foreground": ["surface"],
  primary: ["surface", "ink", "line"],
  "primary-foreground": ["surface", "ink"],
  "primary-soft": ["surface"],
  // This and the four status soft foregrounds also draw the focus ring on their fill, routed into
  // `--ring` by the default Accordion item, status Toasts and the info and warning Alerts.
  "primary-soft-foreground": ["ink", "line"],
  secondary: ["surface", "line"],
  "secondary-foreground": ["ink"],
  "secondary-hover": ["surface"],
  "secondary-soft": ["surface"],
  "secondary-soft-foreground": ["ink"],
  brand: ["surface", "ink"],
  "brand-foreground": ["ink"],
  error: ["surface", "ink", "line"],
  "error-foreground": ["ink"],
  "error-soft": ["surface"],
  "error-soft-foreground": ["ink", "line"],
  info: ["surface", "ink", "line"],
  "info-foreground": ["ink"],
  "info-soft": ["surface"],
  "info-soft-foreground": ["ink", "line"],
  success: ["surface", "ink", "line"],
  "success-foreground": ["ink"],
  "success-soft": ["surface"],
  "success-soft-foreground": ["ink", "line"],
  warning: ["surface", "ink", "line"],
  "warning-foreground": ["ink"],
  "warning-soft": ["surface"],
  "warning-soft-foreground": ["ink", "line"],
  // No component reads it. The docs demos fill and outline with it.
  destructive: ["surface", "line"],
  "destructive-foreground": ["ink"],
  border: ["surface", "line"],
  input: ["surface", "line"],
  ring: ["line"],
  "card-border": ["line"],
  "card-section-divider": ["line"],
  // Card casts it in a shadow, and no paint names an effect, so the Figma sync offers it in no
  // picker.
  "card-shadow": [],
  "button-outline": ["line"],
  "selection-border": ["line"],
  "selection-checked-border": ["line"],
  "selection-divider": ["line"],
  "selection-checked-divider": ["line"],
  "selection-disabled-background": ["surface"],
  // The stripes are 8px bands of a background gradient, not hairlines.
  "selection-disabled-hatch": ["surface"],
  "selection-disabled-foreground": ["ink"],
  sidebar: ["surface"],
  "sidebar-foreground": ["ink"],
  // The outline Sidebar button draws a 1px shadow ring in it on hover, which the paint
  // contract cannot read, because no paint names a shadow.
  "sidebar-accent": ["surface", "line"],
  "sidebar-accent-foreground": ["ink"],
  "sidebar-border": ["surface", "line"],
  "sidebar-ring": ["line"],
  "sidebar-brand": ["surface", "ink"],
  "sidebar-brand-foreground": ["ink"],
  "right-panel": ["surface"],
  "right-panel-foreground": ["ink"],
  "chart-1": ["surface"],
  "chart-2": ["surface"],
  "chart-3": ["surface"],
  "chart-4": ["surface"],
  "chart-5": ["surface"],
  "chart-6": ["surface"],
  "chart-7": ["surface"],
  "chart-8": ["surface"],
  "sh-identifier": ["ink"],
  "sh-keyword": ["ink"],
  "sh-string": ["ink"],
  "sh-class": ["ink"],
  "sh-property": ["ink"],
  "sh-entity": ["ink"],
  "sh-jsxliterals": ["ink"],
  "sh-sign": ["ink"],
  "sh-comment": ["ink"],
} as const satisfies Record<ColorTokenName, readonly TokenPaint[]>;

/**
 * Whether a name is a contract token that holds a color.
 *
 * @param name - Any name, such as a custom property without its `--`.
 * @returns `true` when the name is a contract token whose kind is `color`.
 */
export function isColorTokenName(name: string): name is ColorTokenName {
  return Object.hasOwn(TOKEN_PAINTS, name);
}

/**
 * What each contract token is for, in one or two sentences for a designer picking a variable.
 * Each names the rule a designer could break, where the code states one, such as a pair that
 * is not text-grade or a value that turns transparent in a variant. Exporters, such as the
 * Figma sync, and the docs token list show it. A new token without one fails to compile. No
 * description holds `& < > " '`, which the Figma sync refuses (`descriptionProblem` in
 * `packages/fuse-figma/src/variable-set.ts`).
 */
// oxlint-disable-next-line elmera/no-raw-class-map -- the values are prose for designers, not classes; "text-grade" reads as a text- utility
export const TOKEN_DESCRIPTIONS = {
  background:
    "The page fill. External light themes tint it with the brand, so a card stands out on it by its fill.",
  foreground:
    "Body text and icons on the page, text-grade on background, card and muted. Tooltips fill with it and set their text in background.",
  card: "The fill of Card, a card Accordion item, selection rows, checkboxes, field boxes, the active Tabs trigger and raised controls such as a resting outline Button. Set text on it in card-foreground. foreground and muted-foreground also stay text-grade on it.",
  "card-foreground": "Text and icons on card, text-grade on it.",
  "card-soft":
    "A softer card fill. Set text on it in card-soft-foreground, and muted-foreground also stays text-grade on it.",
  "card-soft-foreground": "Text and icons on card-soft, text-grade on it.",
  popover:
    "The fill of anchored popups, such as Popover, Select and menu lists. Set text on it in popover-foreground.",
  "popover-foreground": "Text and icons in anchored popups, on popover.",
  dialog:
    "The fill of Dialog, AlertDialog and Sheet. External light themes fill it with the page tint, and internal and dark themes use popover.",
  "dialog-foreground": "Text and icons in Dialog, AlertDialog and Sheet, text-grade on dialog.",
  muted:
    "A quiet fill for hover tints, the Tabs list track, Skeleton and Kbd, and the edge of a disabled GridList checkbox. Text on it takes foreground or muted-foreground.",
  "muted-foreground":
    "Secondary text, such as descriptions, placeholders and captions, text-grade on background, muted, card, card-soft and dialog. It also draws the edge of an unchecked Checkbox, Radio and Switch.",
  accent: "The fill of a highlighted row in menus, Select, Combobox and Command, one step off popover.",
  "accent-foreground": "Text and icons on a highlighted accent row.",
  feature: "The fill of promo and hero panels. Use accent for a subtle hover tint instead.",
  "feature-bright": "A second fill for promo and hero panels, beside feature.",
  "feature-foreground":
    "Accent shapes and illustration details on a feature panel. It is not text-grade, so Fuse never sets text in it.",
  primary:
    "The main action color: the default Button, checked Checkbox, Radio and Switch, selected calendar days and link text. Set text on it in primary-foreground.",
  "primary-foreground":
    "Text and icons on primary, text-grade on it. It also fills the dot of a checked Radio.",
  "primary-soft": "The fill of a default Accordion item. Set text on it in primary-soft-foreground.",
  "primary-soft-foreground":
    "Text and icons on primary-soft, text-grade on it. A default Accordion item also draws its focus ring in it.",
  secondary: "The fill of the secondary Button and Badge. Set text on it in secondary-foreground.",
  "secondary-foreground": "Text and icons on secondary and secondary-hover, text-grade on both.",
  "secondary-hover":
    "The hover fill of the secondary Button, secondary mixed toward foreground. Fuse computes it, so no theme sets it.",
  "secondary-soft": "The soft companion of secondary. Set text on it in secondary-soft-foreground.",
  "secondary-soft-foreground": "Text and icons on secondary-soft, text-grade on it.",
  brand:
    "The brand accent of the theme, which points at the brand-* primitive of the theme brand. Fill brand shapes with it and set text on them in brand-foreground. For brand-colored text on the Sidebar, use sidebar-brand, which Fuse steps to 4.5:1 there.",
  "brand-foreground":
    "Text and icons on a brand fill, which points at the brand-*-foreground primitive of the theme brand.",
  error:
    "The error status color: field errors, the invalid field border and ring, and destructive buttons and badges. It is text-grade on background, card and card-soft.",
  "error-foreground": "Text and icons on an error fill, text-grade on it.",
  "error-soft": "The tinted error fill of a Badge and a Toast. Set text on it in error-soft-foreground.",
  "error-soft-foreground":
    "Text and icons on error-soft, text-grade on it. An error Toast also draws its focus ring in it.",
  info: "The info status color for text, borders and fills of Alert and Badge. It is text-grade on background, card and card-soft.",
  "info-foreground": "Text and icons on an info fill, text-grade on it.",
  "info-soft":
    "The tinted info fill of an Alert, a Badge and a Toast. Set text on it in info-soft-foreground.",
  "info-soft-foreground":
    "Text and icons on info-soft, text-grade on it. Info Alerts and Toasts also draw their focus ring in it.",
  success:
    "The success status color for text, borders and fills of Alert, Badge, Button and Meter. It is text-grade on background, card and card-soft.",
  "success-foreground": "Text and icons on a success fill, text-grade on it.",
  "success-soft":
    "The tinted success fill of a Badge and a Toast. Set text on it in success-soft-foreground.",
  "success-soft-foreground":
    "Text and icons on success-soft, text-grade on it. A success Toast also draws its focus ring in it.",
  warning:
    "The warning status color for text, borders and fills of Alert, Badge and Meter. It is text-grade on background, card and card-soft.",
  "warning-foreground": "Text and icons on a warning fill, text-grade on it.",
  "warning-soft":
    "The tinted warning fill of an Alert, a Badge and a Toast. Set text on it in warning-soft-foreground.",
  "warning-soft-foreground":
    "Text and icons on warning-soft, text-grade on it. Warning Alerts and Toasts also draw their focus ring in it.",
  destructive:
    "An alias of error that no Fuse component reads. Destructive buttons and badges draw in error, so bind error instead.",
  "destructive-foreground":
    "An alias of error-foreground that no Fuse component reads. Bind error-foreground instead.",
  border:
    "Hairline borders, separators and dividers, such as the edges of Popover, Table and Kbd and the Separator line.",
  input:
    "The border of text fields, Select, NumberField and Toggle, and the fill of a disabled field at reduced alpha. Light input can fall under 3:1 on the page, so selection controls draw their edge in muted-foreground.",
  ring: "The focus ring, a neutral grey that holds 3:1 on the page, cards, dialog and muted. Status Toasts, the info and warning Alerts and default Accordion items swap in their soft foreground.",
  "card-border":
    "The edge of a Card and a card Accordion item. Internal themes draw it in border, and external themes make it transparent.",
  "card-section-divider":
    "The 1px line between stacked Card.Section parts, edge to edge. Internal themes draw it in border, and external themes in the page background, so a white card reads as segments.",
  "card-shadow":
    "The color of the small shadow under a Card. Internal themes cast it in black at 5%, and external themes make it transparent.",
  "button-outline":
    "The border of the outline Button, at button-outline-width. Internal themes draw it in border, and external themes in foreground.",
  "selection-border":
    "The resting edge of a selection row, RadioItem or CheckboxItem. Internal themes draw it in border, and external themes make it transparent.",
  "selection-checked-border":
    "The edge of a checked selection row. Internal themes draw it in primary, and external themes keep the resting edge, so the control alone shows the choice.",
  "selection-divider":
    "The line between two stacked selection rows. Internal themes draw the edge of the row itself, and external themes a border line.",
  "selection-checked-divider": "The line above and below a checked row in a stack of selection rows.",
  "selection-disabled-background":
    "The fill of a disabled selection row. Internal themes fill it with muted, and external themes keep the card fill.",
  "selection-disabled-hatch":
    "The stripe color of the hatch on a disabled selection row. Internal themes stripe it in a faint black, and external themes make it transparent.",
  "selection-disabled-foreground":
    "The label text of a disabled selection row. It is not text-grade. Internal themes set it in foreground, and external themes in muted-foreground.",
  sidebar: "The fill of the Sidebar. Set text on it in sidebar-foreground.",
  "sidebar-foreground": "Text and icons on the Sidebar.",
  "sidebar-accent":
    "The fill of a hovered or active Sidebar item. Set text on it in sidebar-accent-foreground.",
  "sidebar-accent-foreground": "Text and icons on a hovered or active Sidebar item.",
  "sidebar-border": "The edge and separators of the Sidebar, and the line its rail shows on hover.",
  "sidebar-ring": "The focus ring inside the Sidebar, an alias of ring.",
  "sidebar-brand":
    "The brand on the Sidebar, stepped until it holds 4.5:1 there. Use it for brand text on the Sidebar and for fills behind text. Fuse computes it, so no theme sets it.",
  "sidebar-brand-foreground":
    "Text and icons on a sidebar-brand fill, text-grade on it. Fuse computes it, so no theme sets it.",
  "right-panel": "The fill of a right-hand app panel. No Fuse component reads it.",
  "right-panel-foreground": "Text and icons on right-panel. No Fuse component reads it.",
  "chart-1": "The first chart series color. No Fuse component reads it yet.",
  "chart-2": "The second chart series color. No Fuse component reads it yet.",
  "chart-3": "The third chart series color. No Fuse component reads it yet.",
  "chart-4": "The fourth chart series color. No Fuse component reads it yet.",
  "chart-5": "The fifth chart series color. No Fuse component reads it yet.",
  "chart-6": "The sixth chart series color. No Fuse component reads it yet.",
  "chart-7": "The seventh chart series color. No Fuse component reads it yet.",
  "chart-8": "The eighth chart series color. No Fuse component reads it yet.",
  "sh-identifier": "The color of identifiers in the syntax highlighting of Code.",
  "sh-keyword": "The color of keywords in the syntax highlighting of Code.",
  "sh-string": "The color of strings in the syntax highlighting of Code.",
  "sh-class": "The color of class names in the syntax highlighting of Code.",
  "sh-property": "The color of properties in the syntax highlighting of Code.",
  "sh-entity": "The color of entities in the syntax highlighting of Code.",
  "sh-jsxliterals": "The color of JSX text in the syntax highlighting of Code.",
  "sh-sign": "The color of punctuation and operators in the syntax highlighting of Code.",
  "sh-comment": "The color of comments in the syntax highlighting of Code.",
  radius:
    "The corner radius of the theme, the corner of cards, selection rows and fields. The radius-xs to radius-xl rungs step around it.",
  "radius-button":
    "The corner of Button. Internal themes use radius, and external brands can set their own, as external Fjordkraft does.",
  "radius-field":
    "The corner of every field box, such as Input, Select and Textarea. It follows radius in every variant.",
  "radius-step":
    "The spacing of the radius rungs, which differs between internal and external themes. It switches the corner rules between the variants, so no layer rounds with it.",
  "button-outline-width":
    "The border width of the outline Button, which differs between internal and external themes.",
  "selection-title-weight":
    "The font weight of a selection row title, which differs between internal and external themes.",
  "paragraph-leading-sm":
    "The line height of a small Text (size sm, 14px). Internal themes keep the relaxed 1.625 ratio, and external themes set the 14/20 paragraph style.",
  "paragraph-leading-base":
    "The line height of a default-size Text (16px). Internal themes keep the relaxed 1.625 ratio, and external themes set the 16/22 paragraph style.",
  "paragraph-leading-lg":
    "The line height of a large Text (size lg, 18px). Internal themes keep the relaxed 1.625 ratio, and external themes set the 18/24 paragraph style.",
  "heading-1-size":
    "The font size of a level 1 Heading without a size prop. Internal themes keep 24px, and external themes set the 24/32 heading small style.",
  "heading-1-leading":
    "The line height of a level 1 Heading without a size prop. Internal themes keep the snug 1.375 ratio, and external themes set the 24/32 heading small style.",
  "heading-1-weight":
    "The font weight of a level 1 Heading without a font prop. Internal themes keep 500, and external themes set the bold heading small style.",
  "heading-2-size":
    "The font size of a level 2 Heading without a size prop. Internal themes keep 18px, and external themes set the 20/32 heading xsmall style.",
  "heading-2-leading":
    "The line height of a level 2 Heading without a size prop. Internal themes keep the snug 1.375 ratio, and external themes set the 20/32 heading xsmall style.",
  "heading-2-weight":
    "The font weight of a level 2 Heading without a font prop. Internal themes keep 500, and external themes set the bold heading xsmall style.",
  "heading-3-size":
    "The font size of a level 3 Heading without a size prop. Internal themes keep 16px, and external themes set the 20/32 heading xsmall style.",
  "heading-3-leading":
    "The line height of a level 3 Heading without a size prop. Internal themes keep the snug 1.375 ratio, and external themes set the 20/32 heading xsmall style.",
  "heading-3-weight":
    "The font weight of a level 3 Heading without a font prop. Internal themes keep 500, and external themes set the bold heading xsmall style.",
  "font-sans": "The body font stack, with Roboto first.",
  "font-heading":
    "The heading font. It follows font-sans unless the theme sets its own, such as Neo Sans in external Fjordkraft themes.",
} as const satisfies Record<TokenName, string>;

/**
 * The roles a light theme rule resets. They are every key the external variant layer, an
 * external palette or a segment delta can assign, plus each derived role computed from them
 * and each alias that reads one of them. `--sidebar-ring` defaults to `var(--ring)`, so the
 * rule restates it and the alias resolves against the scope's own ring.
 */
export const EXTERNAL_RESET_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "dialog",
  "dialog-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-hover",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "border",
  "input",
  "ring",
  "card-border",
  "card-section-divider",
  "card-shadow",
  "button-outline",
  "selection-border",
  "selection-checked-border",
  "selection-divider",
  "selection-checked-divider",
  "selection-disabled-background",
  "selection-disabled-hatch",
  "selection-disabled-foreground",
  "sidebar-ring",
  "radius",
  "radius-button",
  "radius-field",
  "radius-step",
  "button-outline-width",
  "selection-title-weight",
  "paragraph-leading-sm",
  "paragraph-leading-base",
  "paragraph-leading-lg",
  "heading-1-size",
  "heading-1-leading",
  "heading-1-weight",
  "heading-2-size",
  "heading-2-leading",
  "heading-2-weight",
  "heading-3-size",
  "heading-3-leading",
  "heading-3-weight",
  "font-heading",
] as const;

export type ExternalResetKey = (typeof EXTERNAL_RESET_KEYS)[number];

export const MUST_OVERRIDE_EXTERNAL = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "card-soft",
  "card-soft-foreground",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "primary-soft",
  "primary-soft-foreground",
  "secondary",
  "secondary-foreground",
  "secondary-soft",
  "secondary-soft-foreground",
  "feature",
  "feature-bright",
  "feature-foreground",
  "border",
  "input",
  "radius",
  "radius-button",
  "brand",
  "brand-foreground",
] as const;

export const MUST_OVERRIDE_INTERNAL = ["brand", "brand-foreground"] as const;

/**
 * What a dark palette keeps from the light composition: geometry, typography, a Card's edge,
 * section divider and shadow colors, the outline Button's border color, a selection row's resting and checked border and
 * divider colors and a disabled selection row's fill, stripe and label text colors. Each color is
 * either an alias, such as `var(--border)`, `var(--muted)` or `var(--foreground)`, so it follows
 * the dark role it names, or a value that does not depend on the scheme, such as the external
 * card and row edges' zero alpha, the card shadow's black at 5% or the disabled row's black
 * stripe at 2% alpha.
 */
const LIGHT_ONLY_KEYS: ReadonlySet<TokenName> = new Set([
  "card-border",
  "card-section-divider",
  "card-shadow",
  "button-outline",
  "selection-border",
  "selection-checked-border",
  "selection-divider",
  "selection-checked-divider",
  "selection-disabled-background",
  "selection-disabled-hatch",
  "selection-disabled-foreground",
  "radius",
  "radius-button",
  "radius-field",
  "radius-step",
  "button-outline-width",
  "selection-title-weight",
  "paragraph-leading-sm",
  "paragraph-leading-base",
  "paragraph-leading-lg",
  "heading-1-size",
  "heading-1-leading",
  "heading-1-weight",
  "heading-2-size",
  "heading-2-leading",
  "heading-2-weight",
  "heading-3-size",
  "heading-3-leading",
  "heading-3-weight",
  "font-heading",
]);

/**
 * The reset keys whose default is an alias of another reset key. A palette names the target,
 * and the alias follows it, so no palette has to name the alias itself.
 */
const ALIAS_RESET_KEYS: ReadonlySet<TokenName> = new Set(["sidebar-ring"]);

/**
 * The roles every dark palette must override. The `LIGHT_ONLY_KEYS` keep their light
 * values, the `ALIAS_RESET_KEYS` follow their target, and composition computes each derived
 * role, so those are the only `EXTERNAL_RESET_KEYS` entries a dark palette need not name.
 */
export const MUST_OVERRIDE_DARK = EXTERNAL_RESET_KEYS.filter(
  (key): key is Extract<ExternalResetKey, LayerTokenName> =>
    isLayerTokenName(key) && !LIGHT_ONLY_KEYS.has(key) && !ALIAS_RESET_KEYS.has(key)
);

/**
 * The roles one layer assigns.
 *
 * @param layer - A palette, sheet, pointer or defaults layer.
 * @returns The names the layer gives a value, in `TOKEN_NAMES` order.
 */
export function assignedTokenNames(layer: TokenLayer): LayerTokenName[] {
  const names: LayerTokenName[] = [];
  for (const name of LAYER_TOKEN_NAMES) {
    if (layer[name] !== undefined) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Overlay layers on a complete base, a later layer's value replacing an earlier one's.
 *
 * @param base - A value for every layer role, such as `LAYER_DEFAULTS`.
 * @param layers - The layers in application order.
 * @returns Every layer role with its value after the overlay, before derivation.
 */
export function overlayTokenLayers(base: LayerTokens, ...layers: TokenLayer[]): LayerTokens {
  const overlaid: LayerTokens = { ...base };
  for (const layer of layers) {
    for (const name of LAYER_TOKEN_NAMES) {
      const value = layer[name];
      if (value !== undefined) {
        overlaid[name] = value;
      }
    }
  }
  return overlaid;
}
