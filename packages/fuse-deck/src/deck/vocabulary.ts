/**
 * Everything a deck author can write: the layouts, the slide frontmatter, the components every
 * slide gets without an import, the deck settings and the CLI verbs. `describe` prints it, and the
 * runtime maps each layout name to its component with `satisfies Record<LayoutName, …>`, so this
 * module holds data only and never imports React or Node.
 */

/** The layouts a slide's frontmatter may name. */
export const LAYOUTS = [
  {
    name: "content",
    summary: "The default. The first heading sits at the top and the rest of the slide flows below it.",
  },
  {
    name: "cover",
    summary: "The opening slide. A large title, centered, with the content below it as a subtitle.",
  },
  {
    name: "section",
    summary: "A divider between parts of the talk. One large heading, left-aligned in the lower third.",
  },
  {
    name: "center",
    summary: "One idea in the middle of the slide, such as a quote, a number or a single image.",
  },
] as const;

/** A layout's name. */
export type LayoutName = (typeof LAYOUTS)[number]["name"];

/** The layout a slide gets when its frontmatter names none. */
export const DEFAULT_LAYOUT = "content" satisfies LayoutName;

/** Every layout name, in the order `describe` lists them. */
export const LAYOUT_NAMES = LAYOUTS.map((layout) => layout.name);

/** The keys a slide's frontmatter may hold. Any other key fails `check`. */
export const FRONTMATTER_FIELDS = [
  { name: "layout", type: "string", summary: `One of the layouts. Default: ${DEFAULT_LAYOUT}.` },
  { name: "notes", type: "string", summary: "Speaker notes. They never render on the slide." },
] as const;

/** A component every slide can use without importing it. */
export type DeckComponent = {
  /** The JSX name. */
  readonly name: string;
  /** A one-line example. */
  readonly usage: string;
  /** What it does. */
  readonly summary: string;
};

/** The components every slide can use without importing them. */
export const COMPONENTS: readonly DeckComponent[] = [
  {
    name: "Step",
    usage: "<Step>Shown on the next key press</Step>",
    summary:
      "Content revealed one key press at a time, in document order. The deck counts the steps when it compiles the slide, so deep links and keyboard navigation agree on the last one. An unrevealed step keeps its space, is hidden and is inert.",
  },
  {
    name: "Morph",
    usage: '<Morph name="logo"><img src={logo} alt="Fuse" /></Morph>',
    summary:
      "Wraps exactly one HTML element, such as <img> or <span>. When the next slide has a Morph with the same name, the element travels from its old place to its new one during the slide change. A Morph without a partner fades with the slide. Names use lowercase letters, digits and dashes, once per slide. Import an image before using it (import logo from '../logo.svg'), so the build bundles it.",
  },
];

/**
 * What a `<Morph>` name may be. It becomes part of a CSS `view-transition-name`, so it must be an
 * identifier: lowercase letters, digits and dashes, starting with a letter.
 */
export const MORPH_NAME = /^[a-z][a-z0-9-]*$/;

/** The settings `deck.json` holds besides the slide order. */
export const DECK_FIELDS = [
  { name: "title", type: "string", summary: "The deck's title, shown in the browser tab." },
  {
    name: "theme",
    type: "string",
    summary:
      "A Fuse theme slug, <identity>-<brand>-<segment>, such as neutral-elma-private. `check` validates it against Fuse.",
  },
  { name: "density", type: "string", summary: "dense or comfortable, Fuse's document density." },
  { name: "aspect", type: "string", summary: "The slide canvas, 16:9 (1920×1080) or 4:3 (1440×1080)." },
  {
    name: "order",
    type: "string[]",
    summary: "The slide ids in presentation order. Edit it through `fuse-deck slides`, never by hand.",
  },
] as const;

/** What each command does, for agents deciding which to run. */
export const VERBS = [
  { usage: "fuse-deck create <dir> [--brief <text>] [--theme <slug>]", summary: "Scaffold a new deck." },
  { usage: "fuse-deck describe", summary: "Print this vocabulary." },
  { usage: "fuse-deck slides list", summary: "List the slides in order, with each one's title and layout." },
  {
    usage: "fuse-deck slides add <id> [--after <id>] [--layout <name>] [--title <text>]",
    summary: "Create slides/<id>.mdx and add it to the order, at the end or after another slide.",
  },
  {
    usage: "fuse-deck slides move <id> (--after <id> | --before <id>)",
    summary: "Move a slide in the order.",
  },
  { usage: "fuse-deck slides remove <id>", summary: "Take a slide out of the order and delete its file." },
  {
    usage: "fuse-deck dev [--port <n>]",
    summary:
      "Serve the deck with live reload. With --json it prints one { url } document once the server listens.",
  },
  {
    usage: "fuse-deck build [--out <dir>]",
    summary:
      "Build the deck into static files, dist/ by default. The build empties --out first, so it refuses a directory that holds the deck or sits in slides/, and an existing one that is not empty unless an earlier build wrote it.",
  },
  {
    usage: "fuse-deck check",
    summary:
      "Report dangling ids, orphan files, invalid frontmatter, slides that do not compile and an invalid theme.",
  },
] as const;

/** How a deck lays out its files. Agents edit the slide files directly. */
export const FILES = [
  { path: "deck.json", summary: "Settings and slide order. Change the order through `fuse-deck slides`." },
  {
    path: "slides/<id>.mdx",
    summary:
      "One slide: optional frontmatter, then MDX. The first heading is the slide's title. Import local components and assets with relative paths.",
  },
  { path: "BRIEF.md", summary: "The brief the deck was created from, verbatim." },
  { path: "AGENTS.md", summary: "Where an agent starts." },
  { path: ".fuse-deck/", summary: "Vite's cache. Ignored by the .gitignore `create` writes." },
] as const;
