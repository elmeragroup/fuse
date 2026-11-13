import { defineConfig } from "oxlint";

import type {
  RestrictedImportsOptions,
  RestrictedModule,
} from "./tooling/oxlint-plugin-fuse/src/rules/restricted-imports.ts";

/*
 * The repo's lint config. Each import restriction is defined once below and composed into the
 * overrides that need it: an override's options replace the inherited ones, so an override that
 * keeps a restriction lists it again, and composing from one definition keeps those lists from
 * drifting apart.
 *
 * This file depends on oxlint's TypeScript config format (`oxlint.config.ts` with `defineConfig`),
 * which oxlint 1.89 marks experimental and loads only under the Node runtime (the JS plugins below
 * need Node too). Composition needs it: JSON cannot share one definition between overrides, so a
 * `.oxlintrc.json` would have to copy each restriction into every override that keeps it.
 *
 * On an oxlint upgrade, check that:
 * - `oxlint --print-config` still resolves this file, with every override's rules and options;
 * - the `defineConfig` types still accept the shapes below (`pnpm type-check:scripts`);
 * - `pnpm lint` still rejects a deep `packages/fuse/src` import from an app and a
 *   `writeSourceExports` access in `packages/fuse/scripts/build.ts`, static and dynamic.
 */

/** One `no-restricted-imports` path entry. */
type RestrictedPath = {
  readonly name: string;
  readonly message: string;
  readonly importNames?: string[];
  readonly allowTypeImports?: boolean;
};

const LOCALIZED_STRING_DICTIONARY: RestrictedPath = {
  name: "@internationalized/string",
  importNames: ["LocalizedStringDictionary"],
  allowTypeImports: true,
  message:
    "Assemble dictionaries with createStringDictionary; do not construct LocalizedStringDictionary outside the factory.",
};

const TANSTACK_TABLE: RestrictedPath = {
  name: "@tanstack/react-table",
  allowTypeImports: true,
  message:
    "Import only types from the optional TanStack peer. Plain parts render through table.FlexRender and read structural slices; only the data-table contexts, the table hook factory and their tests call into TanStack.",
};

const TANSTACK_VIRTUAL: RestrictedPath = {
  name: "@tanstack/react-virtual",
  allowTypeImports: true,
  message:
    "Import only types from the optional virtualizer peer. Only the command-virtual list calls into TanStack Virtual, so the core command entry never loads it.",
};

const BASE_UI_COMBOBOX: RestrictedPath = {
  name: "@base-ui/react/combobox",
  allowTypeImports: true,
  message:
    "Import Combobox from the @base-ui/react package root. The subpath type-checks but crashes at runtime with a null React context.",
};

const BASE_UI_AUTOCOMPLETE: RestrictedPath = {
  name: "@base-ui/react/autocomplete",
  allowTypeImports: true,
  message:
    "Import Autocomplete from the @base-ui/react package root. It shares the combobox internals, so the subpath type-checks but crashes at runtime with a null React context.",
};

const TAILWIND_VARIANTS_TV: RestrictedPath = {
  name: "tailwind-variants",
  importNames: ["tv", "createTV"],
  allowTypeImports: true,
  message:
    "Import tv from styles/tv. It shares cn's tailwind-merge extension, so a consumer's rounded-* class replaces rounded-inner in a recipe; the upstream tv keeps both.",
};

/** `styles/tv.ts` wraps `createTV`, so only the upstream `tv` stays restricted there. */
const TAILWIND_VARIANTS_TV_ONLY: RestrictedPath = { ...TAILWIND_VARIANTS_TV, importNames: ["tv"] };

/** Every library module's import restrictions. */
const LIBRARY_IMPORTS: ReadonlyArray<RestrictedPath> = [
  LOCALIZED_STRING_DICTIONARY,
  TANSTACK_TABLE,
  TANSTACK_VIRTUAL,
  BASE_UI_COMBOBOX,
  BASE_UI_AUTOCOMPLETE,
  TAILWIND_VARIANTS_TV,
];

/**
 * The package build never reaches the writer of the tracked source exports, statically or
 * dynamically, under any spelling of its module's path: the exports-map drift gate compares
 * against a fresh generation, so it cannot see a build that rewrites them.
 */
const SOURCE_EXPORT_WRITER: RestrictedModule = {
  pattern: "(?:^|/)packages/fuse/scripts/generate-exports(?:\\.[cm]?[jt]sx?)?$",
  names: ["writeSourceExports"],
  message:
    "the package build leaves the tracked package.json exports and root barrel alone; only the exports script writes them, and the exports-map drift gate cannot see a build that rewrites them.",
};

/** Apps consume Fuse through its package exports, never its source. */
const APP_DEEP_IMPORT: RestrictedModule = {
  pattern: "(?:^|/)packages/fuse/src(?:/|$)",
  message:
    "apps consume @elmeragroup/fuse through its package exports, the way a consumer does; a deep import of packages/fuse/src skips the build and its exports map.",
};

const DOCS_CHROME_SIDEBAR_MESSAGE =
  "docs chrome never composes the library Sidebar; only the Sidebar page's demos, the landing's app-shell demo and the blocks' demos demonstrate it.";

/** Docs chrome never composes the library Sidebar. */
const DOCS_CHROME_SIDEBAR: ReadonlyArray<RestrictedModule> = [
  { pattern: "^@elmeragroup/fuse/sidebar$", message: DOCS_CHROME_SIDEBAR_MESSAGE },
  { pattern: "^@elmeragroup/fuse$", names: ["Sidebar"], message: DOCS_CHROME_SIDEBAR_MESSAGE },
];

const TEMPORAL_POLYFILL: RestrictedModule = {
  pattern: "(?:^|/)temporal-polyfill(?:\\.[cm]?[jt]sx?)?(?:/|$)",
  message:
    "the polyfill replaces Intl.DateTimeFormat when it installs, so only the opt-in temporal-polyfill entry loads it.",
};

const COLOR_PACKAGE: RestrictedModule = {
  pattern: "^@elmeragroup/color(?:/|$)",
  message:
    "the Temporal core's declarations stay self-contained; @elmeragroup/color is a dev dependency published files may not import.",
};

/** The curated icons import Phosphor's per-icon SSR modules only. */
const PHOSPHOR_SSR_ONLY: ReadonlyArray<RestrictedModule> = [
  {
    pattern: "^@phosphor-icons/react(?:/ssr)?$",
    message:
      "the package root and its ssr barrel load every icon. Import the one icon's module from @phosphor-icons/react/dist/ssr/<Name>, so /icons stays server-safe and per-icon.",
  },
  {
    pattern: "^@phosphor-icons/react/dist/csr(?:/|$)",
    message:
      "csr modules run only on the client. Import from @phosphor-icons/react/dist/ssr/<Name>, so a server component can render the icon.",
  },
  {
    pattern: "^lucide-react(?:/|$)",
    message: "the curated icons are Phosphor's, through the generated per-icon adapters.",
  },
];

/** A path list with one restriction left out, for the module that owns what it restricts. */
function without(paths: ReadonlyArray<RestrictedPath>, owned: RestrictedPath): RestrictedPath[] {
  return paths.filter((path) => path !== owned);
}

/** The `no-restricted-imports` setting for a set of paths. */
function restrictImports(paths: ReadonlyArray<RestrictedPath>): ["error", { paths: RestrictedPath[] }] {
  return ["error", { paths: [...paths] }];
}

/**
 * The `fuse/restricted-imports` setting for a set of modules. Library overrides skip test files,
 * which may import what they check; app overrides check them too.
 */
function restrictModules(
  modules: RestrictedImportsOptions["modules"],
  tests: NonNullable<RestrictedImportsOptions["tests"]> = "skip"
): ["error", RestrictedImportsOptions] {
  return ["error", { modules, tests }];
}

export default defineConfig({
  plugins: ["typescript", "oxc", "import", "unicorn"],
  jsPlugins: [
    "eslint-plugin-turbo",
    "@shadcn/lint",
    {
      name: "elmera",
      specifier: "@elmeragroup/internal/oxlint",
    },
    {
      name: "anti-slop",
      specifier: "@elmeragroup/internal/oxlint/anti-slop",
    },
    {
      name: "fuse",
      specifier: "./tooling/oxlint-plugin-fuse/src/plugin.ts",
    },
  ],
  categories: {
    correctness: "error",
  },
  rules: {
    "turbo/no-undeclared-env-vars": "error",
    "fuse/require-disable-reason": "error",
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "typescript/no-unnecessary-parameter-property-assignment": "off",
    "typescript/no-misused-promises": [
      "error",
      {
        checksVoidReturn: {
          attributes: false,
        },
      },
    ],
    "typescript/no-unnecessary-condition": [
      "error",
      {
        allowConstantLoopConditions: true,
      },
    ],
    "typescript/no-non-null-assertion": "error",
    "typescript/dot-notation": "error",
    "typescript/prefer-find": "error",
    "typescript/prefer-regexp-exec": "error",
    "typescript/prefer-string-starts-ends-with": "error",
    "typescript/prefer-optional-chain": "error",
    "typescript/prefer-nullish-coalescing": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-empty-object-type": "error",
    "typescript/no-empty-function": "error",
    "typescript/require-await": "error",
    "typescript/promise-function-async": "off",
    "typescript/non-nullable-type-assertion-style": "error",
    "typescript/only-throw-error": "error",
    "typescript/restrict-template-expressions": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-unused-expressions": "error",
    "typescript/consistent-type-definitions": ["warn", "type"],
    "typescript/consistent-type-imports": [
      "warn",
      {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
      },
    ],
    "typescript/array-type": "off",
    "typescript/ban-types": "off",
    "typescript/prefer-readonly": "off",
    "typescript/no-duplicate-enum-values": "off",
    "typescript/no-misused-spread": "error",
    "typescript/no-meaningless-void-operator": "off",
    "typescript/require-array-sort-compare": "error",
    "no-constant-binary-expression": "error",
    "typescript/no-redundant-type-constituents": "error",
    "import/consistent-type-specifier-style": ["warn", "prefer-top-level"],
    "import/no-cycle": "error",
    "unicorn/filename-case": [
      "error",
      {
        case: "kebabCase",
        ignore: ["^[a-z]{2}-[A-Z]{2}\\."],
      },
    ],
    "unicorn/no-await-in-promise-methods": "off",
    "unicorn/no-empty-file": "off",
    "unicorn/no-invalid-fetch-options": "off",
    "unicorn/no-invalid-remove-event-listener": "off",
    "unicorn/no-new-array": "off",
    "unicorn/no-single-promise-in-promise-methods": "off",
    "unicorn/no-thenable": "off",
    "unicorn/no-unnecessary-await": "off",
    "unicorn/no-useless-fallback-in-spread": "off",
    "unicorn/no-useless-length-check": "off",
    "unicorn/no-useless-spread": "off",
    "unicorn/prefer-set-size": "off",
    "unicorn/prefer-string-starts-ends-with": "off",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "warn",
    "anti-slop/no-runtime-typeof": "warn",
    "anti-slop/no-shape-in-symbol-names": "warn",
    "anti-slop/no-slop-comments": [
      "warn",
      {
        ticketPattern: "ELM-\\d+",
      },
    ],
    "anti-slop/no-narration-comments": "warn",
  },
  env: {
    builtin: true,
  },
  settings: {
    react: {
      version: "19",
    },
    shadcn: {
      ui: "@elmeragroup/fuse",
      ignoreImports: [
        "^@elmeragroup/fuse/(icons|emoji|illustrations|flags|theme)(/|$)",
        "^@elmeragroup/fuse/react-aria/ui-providers$",
      ],
      mergeFunctions: ["mergeClassName"],
    },
  },
  ignorePatterns: [
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/.next/**",
    "apps/docs/src/generated/**",
    "plop-templates/**",
    "**/.artifacts/**",
    "**/.cache/**",
    "**/node_modules/**",
    ".ref/**",
    "packages/fuse/scripts/*.mjs",
    ".agent/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".continue/**",
    ".cursor/**",
    ".gemini/**",
    ".opencode/**",
    ".pi/**",
    ".roo/**",
    ".windsurf/**",
  ],
  options: {
    typeAware: true,
  },
  overrides: [
    {
      files: ["apps/**/*.{ts,tsx}", "packages/fuse/**/*.{ts,tsx}"],
      globals: {
        React: "writable",
      },
      plugins: ["typescript", "oxc", "react", "unicorn", "jsx-a11y"],
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/no-children-prop": "off",
        "react/exhaustive-deps": "error",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error",
        "react/no-unstable-nested-components": "error",
        "jsx-a11y/prefer-tag-over-role": "off",
        "jsx-a11y/control-has-associated-label": "off",
        "jsx-a11y/heading-has-content": "off",
        "jsx-a11y/no-autofocus": "off",
        "jsx-a11y/anchor-has-content": "off",
        "jsx-a11y/label-has-associated-control": "off",
        "jsx-a11y/aria-proptypes": "off",
        "jsx-a11y/no-noninteractive-tabindex": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/no-aria-hidden-on-focusable": "off",
        "jsx-a11y/img-redundant-alt": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/aria-role": "off",
        "jsx-a11y/anchor-is-valid": "off",
      },
    },
    {
      files: ["packages/fuse/src/**/*.{ts,tsx}"],
      rules: {
        "elmera/no-primitive-colors": "error",
        "elmera/no-tailwind-dark-variant": "error",
        "elmera/enforce-variant-standard": "error",
        "elmera/no-local-focus-ring": "error",
        "elmera/restrict-focus-ring-call": "error",
        "elmera/restrict-browser-helper-copy": "error",
        "elmera/no-field-part-jsx": "error",
        "elmera/require-icon-button-label": "error",
        "elmera/restrict-process-env": "error",
        "elmera/no-internal-dynamic-import": "error",
        "elmera/facade-reexport-grammar": "error",
        "elmera/no-rac-outside-quarantine": "error",
        "elmera/no-hardcoded-density-metrics": "warn",
        "elmera/no-raw-class-map": "error",
        "no-restricted-imports": restrictImports(LIBRARY_IMPORTS),
        "shadcn/no-raw-colors": "error",
        "shadcn/no-inline-styles": "error",
        "shadcn/no-unknown-classes": "error",
        "fuse/defined-props-wiring": "error",
        "fuse/declared-density-role": [
          "error",
          {
            roles: "packages/fuse/src/theme/tokens/density-roles.ts",
          },
        ],
        "fuse/motion-safe-transform": "error",
        "fuse/no-base-ui-preview-menu": "error",
        "fuse/overlay-root-override-last": "error",
        "fuse/owned-class-tokens": [
          "error",
          {
            owner: "components/overlay/overlay-classes.ts",
            spellings: [
              "z-50",
              "z-60",
              "origin-(--transform-origin)",
              "text-xl font-medium",
              "bg-popover text-popover-foreground",
              "bg-dialog text-dialog-foreground",
              "shadow-md ring-1 ring-foreground/10",
            ],
            superseded: [
              {
                spelling: "pointer-events-none absolute right-2 flex items-center justify-center",
                replacement: "menuItemIndicatorClass from components/overlay/menu-row-classes.ts",
              },
              {
                spelling: "-mx-1 my-1 h-px bg-border",
                replacement: "menuSeparatorClass from components/overlay/menu-row-classes.ts",
              },
            ],
          },
        ],
        "fuse/restricted-imports": restrictModules([TEMPORAL_POLYFILL]),
        "fuse/state-face": "error",
        "fuse/surface-muted-foreground": "error",
      },
    },
    {
      files: ["apps/docs/src/**/*.{ts,tsx}"],
      rules: {
        "fuse/surface-muted-foreground": "error",
        "elmera/no-primitive-colors": "error",
        "elmera/no-raw-class-map": "error",
        "shadcn/no-restyle": [
          "error",
          {
            allow: ["layout"],
            contracts: [
              {
                pattern: "^Collapsible(Trigger|Content)$",
                allow: ["layout", "color", "typography", "spacing", "shape", "effects", "motion"],
                message:
                  "Collapsible is a headless passthrough (collapsible.tsx) apart from Content's height transition; style it freely or render a Button via `render`.",
              },
              {
                pattern: "^Card(Content|Header|Footer)$|^Dialog(Header|Footer)$|^Field(Root|Item|Set)$",
                allow: ["layout", "spacing"],
              },
              {
                pattern: "^Skeleton$",
                allow: ["layout", "rounded"],
                message:
                  "Skeleton is a shape-only placeholder: size and radius are yours, colour and motion are its own.",
              },
              {
                pattern: "^ScrollAreaRoot$",
                allow: ["layout", "rounded", "border-w", "border-color"],
              },
            ],
          },
        ],
        "shadcn/no-arbitrary-values": [
          "error",
          {
            allow: ["layout", "rounded-[inherit]"],
          },
        ],
      },
    },
    {
      files: ["apps/docs/src/**/*.{ts,tsx}", "apps/static-theme/src/**/*.{ts,tsx}"],
      rules: {
        "shadcn/no-raw-colors": "error",
        "shadcn/no-inline-styles": "error",
        "shadcn/no-unknown-classes": [
          "error",
          {
            allow: ["not-prose"],
          },
        ],
      },
    },
    {
      files: ["apps/docs/src/og/**/*.{ts,tsx}", "apps/docs/src/app/og/**/*.{ts,tsx}"],
      rules: {
        "shadcn/no-inline-styles": "off",
      },
    },
    {
      files: [
        "packages/fuse/src/icons/**",
        "packages/fuse/src/illustrations/**",
        "packages/fuse/src/components/emoji/**",
      ],
      rules: {
        "shadcn/no-raw-colors": "off",
        "shadcn/no-inline-styles": [
          "error",
          {
            allow: ["maskType"],
          },
        ],
      },
    },
    {
      files: ["apps/docs/src/components/docs-inline-code.tsx"],
      rules: {
        "shadcn/no-arbitrary-values": [
          "error",
          {
            allow: ["py-[0.1em]", "px-[0.35em]"],
          },
        ],
      },
    },
    {
      files: ["apps/docs/src/components/token-swatch-list.tsx"],
      rules: {
        "shadcn/no-arbitrary-values": [
          "error",
          {
            allow: [
              "layout",
              "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_3px,color-mix(in_oklab,var(--foreground)_14%,transparent)_6px)]",
            ],
          },
        ],
        "shadcn/no-inline-styles": [
          "error",
          {
            allow: ["backgroundColor"],
          },
        ],
      },
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/*.test-d.{ts,tsx}"],
      rules: {
        "shadcn/no-inline-styles": "off",
        "shadcn/no-unknown-classes": "off",
        "shadcn/no-restyle": "off",
        "shadcn/no-arbitrary-values": "off",
      },
    },
    {
      files: ["packages/fuse/test/**/*.{ts,tsx}"],
      rules: {
        "elmera/restrict-browser-helper-copy": "error",
      },
    },
    {
      files: ["packages/fuse/scripts/**"],
      rules: {
        "elmera/restrict-package-root-from-script": "error",
      },
    },
    {
      files: ["packages/fuse/src/styles/tv.ts"],
      rules: {
        "no-restricted-imports": restrictImports([
          ...without(LIBRARY_IMPORTS, TAILWIND_VARIANTS_TV),
          TAILWIND_VARIANTS_TV_ONLY,
        ]),
      },
    },
    {
      files: ["packages/fuse/src/intl/create-string-dictionary.ts"],
      rules: {
        "no-restricted-imports": restrictImports(without(LIBRARY_IMPORTS, LOCALIZED_STRING_DICTIONARY)),
      },
    },
    {
      files: [
        "packages/fuse/src/components/data-table/data-table-contexts.ts",
        "packages/fuse/src/components/data-table/create-fuse-table-hook.ts",
        "packages/fuse/src/components/data-table/*.test*.{ts,tsx}",
        "packages/fuse/src/components/data-table-filter/*.test*.{ts,tsx}",
      ],
      rules: {
        "no-restricted-imports": restrictImports(without(LIBRARY_IMPORTS, TANSTACK_TABLE)),
      },
    },
    {
      files: ["packages/fuse/src/components/command-virtual/command-virtual.tsx"],
      rules: {
        "no-restricted-imports": restrictImports(without(LIBRARY_IMPORTS, TANSTACK_VIRTUAL)),
      },
    },
    {
      files: ["plopfile.mjs"],
      rules: {
        "typescript/no-unsafe-assignment": "off",
        "typescript/no-unsafe-member-access": "off",
        "typescript/no-unsafe-call": "off",
        "typescript/no-unsafe-return": "off",
        "typescript/no-unsafe-argument": "off",
      },
    },
    {
      files: ["packages/fuse/src/temporal/**/*.ts"],
      rules: {
        "fuse/restricted-imports": restrictModules([TEMPORAL_POLYFILL, COLOR_PACKAGE]),
      },
    },
    {
      files: ["packages/fuse/src/temporal-polyfill.ts"],
      rules: {
        "fuse/restricted-imports": "off",
      },
    },
    {
      files: ["packages/fuse/src/components/overlay/overlay-classes.ts"],
      rules: {
        "fuse/owned-class-tokens": "off",
      },
    },
    {
      files: ["packages/fuse/src/styles/state-face.ts"],
      rules: {
        "fuse/state-face": "off",
      },
    },
    {
      files: ["packages/fuse/src/components/data-table-filter/searchable-menu.ts"],
      rules: {
        "fuse/no-base-ui-preview-menu": "off",
      },
    },
    {
      files: ["packages/fuse/src/components/**/*.tsx"],
      rules: {
        "fuse/render-element-wiring": "error",
      },
    },
    {
      files: [
        "packages/fuse/src/components/*/index.ts",
        "packages/fuse/src/components/chart/*-namespace.ts",
        "packages/fuse/src/components/chart/*-parts.ts",
        "packages/fuse/src/components/chart/format/**/*.ts",
        "packages/fuse/src/components/chart/layout/**/*.ts",
        "packages/fuse/src/components/checkbox/checkbox-item.tsx",
        "packages/fuse/src/components/radio-group/radio-item.tsx",
        "packages/fuse/src/components/selection-item/selection-item-sub-section.tsx",
      ],
      rules: {
        "fuse/no-use-client": "error",
      },
    },
    {
      files: ["packages/fuse/src/components/*/index.ts"],
      rules: {
        "fuse/namespace-index-exports": "error",
      },
    },
    {
      files: [
        "apps/docs/src/app/(landing)/landing/app-shell/**/*.{ts,tsx}",
        "apps/docs/src/app/(landing)/landing/brand-site/**/*.{ts,tsx}",
      ],
      rules: {
        "fuse/side-overlay-state": "error",
      },
    },
    {
      files: ["packages/fuse/src/components/chart/**/*.{ts,tsx}"],
      rules: {
        "fuse/no-color-literal": "error",
        "fuse/no-display-name-assignment": "error",
        "fuse/no-theme-color-write": "error",
      },
    },
    {
      files: [
        "packages/fuse/src/icons.ts",
        "packages/fuse/src/icons/create-elmera-icon.ts",
        "packages/fuse/src/icons/generated/**/*.ts",
      ],
      rules: {
        "fuse/no-use-client": "error",
        "fuse/restricted-imports": restrictModules([TEMPORAL_POLYFILL, ...PHOSPHOR_SSR_ONLY]),
      },
    },
    {
      files: ["packages/fuse/scripts/build.ts"],
      rules: {
        "fuse/restricted-imports": restrictModules([SOURCE_EXPORT_WRITER]),
      },
    },
    {
      files: ["apps/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
      rules: {
        "fuse/restricted-imports": restrictModules([APP_DEEP_IMPORT], "check"),
      },
    },
    {
      files: ["packages/fuse/src/icons/bespoke/**/*.tsx", "packages/fuse/src/illustrations/**/*.tsx"],
      rules: {
        "fuse/no-use-client": "error",
        "fuse/no-hook-calls": "error",
      },
    },
    {
      files: ["apps/docs/src/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
      rules: {
        "fuse/restricted-imports": restrictModules([...DOCS_CHROME_SIDEBAR, APP_DEEP_IMPORT], "check"),
      },
    },
    {
      files: [
        "apps/docs/src/app/(docs)/components/sidebar/**",
        "apps/docs/src/app/(landing)/landing/app-shell/**",
        "apps/docs/src/app/(docs)/blocks/*/demos/**",
      ],
      rules: {
        "fuse/restricted-imports": restrictModules([APP_DEEP_IMPORT], "check"),
      },
    },
    {
      files: [
        "apps/docs/src/app/(docs)/components/bar-chart/demos/*.tsx",
        "apps/docs/src/app/(docs)/components/chart/demos/*.tsx",
        "apps/docs/src/app/(docs)/components/live-line-chart/demos/*.tsx",
      ],
      rules: {
        "fuse/chart-demo-table": "error",
      },
    },
    {
      files: ["**/*.test.{ts,tsx,mts,mjs}"],
      rules: {
        "fuse/no-class-assertions": "error",
        "fuse/no-fixed-delay": "error",
        "fuse/no-geometry-assertions": "error",
        "fuse/no-source-reading-tests": "error",
        "fuse/no-test-retry": "error",
        "fuse/no-wall-clock": "error",
      },
    },
    {
      // Shared test helpers wait and time on the tests' behalf, so they meet the same bar.
      files: ["**/test/**/*.{ts,tsx,mts,mjs}"],
      rules: {
        "fuse/no-fixed-delay": "error",
        "fuse/no-wall-clock": "error",
      },
    },
    {
      files: ["**/vitest.*", "**/vite.config.*", "**/playwright.config.*"],
      rules: {
        "fuse/no-test-retry": "error",
      },
    },
    {
      files: ["packages/fuse/src/**/*.browser.test.{ts,tsx}"],
      rules: {
        "fuse/one-browser-test-per-module": "error",
      },
    },
  ],
});
