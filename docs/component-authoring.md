# Component authoring

Component behavior lives in the implementation, public JSDoc, authored docs pages, and co-located tests. Update them together. The library-wide contracts remain in [spec/](spec/README.md); record architectural decisions in [ADRs](adr/). Add a changeset when the published package changes, following [release guidance](spec/release.md).

## API and composition

- Use namespace parts such as `Field.Root` and `InputGroup.Addon`. Polymorphism uses Base UI's `render` prop and `useRender`, with `mergeProps`; do not add an `as` prop.
- Primitives keep Base UI names such as `disabled`, `invalid`, and `readOnly`. Labeled composites use `isDisabled`, `isInvalid`, `isReadOnly`, `isRequired`, `isPending`, and `isSuccess`, value-based `onChange`, `minValue`/`maxValue`/`formatOptions`, and `errorMessage: ReactNode`.
- Overlays accept `container?: HTMLElement | RefObject<HTMLElement | null>` and default to the nearest `ThemeScope`. Follow the lifecycle rules in [theming](spec/theming.md#74-themescope).
- Parts inheriting a Base UI `className` state callback evaluate it with the current state and merge the result after library classes through `mergeClassName`. DOM parts and deliberately narrowed APIs such as `Button`, `Toggle`, and `Combobox.Input` stay string-only. Never pass a callback to `cn`.
- Boolean aria attributes use `x || undefined`. Guard conditional spreads so `mergeProps` cannot overwrite an automatically wired aria attribute with `undefined`.
- Keep helpers and shared recipes package-private. Export a recipe or hook from its component entry only when consumers need it. Bare entries and the root barrel cover the permanent components; interim React Aria entries remain under `react-aria/*`. See [architecture](spec/architecture.md).

## Styling

- Use role-token colors, including `error`, `info`, `success`, and `warning`. Input-like surfaces use `bg-card`. Raw palette colors and `dark:` variants are forbidden in library styles; themes own color values.
- Merge classes through the shared `cn` helper. Use typed `tv` recipes for any class map with an axis or at least two slots, and `cn` for a single axis-less string. Recipes with axes declare `variants` and `defaultVariants`; axis-less recipes omit them. `spanVariants` retains an empty `variants` object to preserve inherited-axis extraction.
- Put shared recipes in their own modules. A part's independent type scale gets a separate recipe so another slot variant cannot overwrite it through Tailwind merging. Card's title and description recipes demonstrate the merge order.
- State classes belong on the element that emits the state. Bare `data-open:` and related variants are self-scoped. Ancestor state requires an explicit named group, peer, or `in-data-*` variant.
- Use the shared focus constants in `styles/utils` for fixed `self`, `within`, and `state` targets. A `within` group marks only its owned focus receiver with `data-focus-ring-control`; addon buttons retain their own rings. React Aria Link is the sole dynamic `focusRing` caller. Invalid rings and popup hairlines are separate from focus indicators.
- Reuse `disabledHatch` and the icon crossfade constants from `styles/utils`, and `isTextNode`/`isTextValueNode` from `internal/is-text-node` for ReactNode text checks.
- Derive radii from the brand radius variables. Import curated Phosphor icons from `@elmeragroup/ui/icons`. Use regular weight normally and fill for selected or active states. Asset licenses and provenance remain required by [architecture](spec/architecture.md) and [icons](spec/icons.md).

## Density

Control boxes use the `xs`, `sm`, `md`, and `lg` rungs of the library-owned `--control-*` variables. Height, inline padding, icon-edge padding, and gap follow density on every rung. `xs` and `sm` retain their size-owned `text-xs` and `text-sm`; `md` and `lg` use `--control-text` and `--control-leading`.

Pin the default control height. Fixed-height recipes own `box-sizing: border-box` and have no positive vertical padding; retain zero resets where native controls need them. Composed inputs fit inside their group's border. Textarea retains content height and `py-2`.

Single-height field boxes pin the `md` rung without adding a `size` prop. Type scales, overlay widths, decorative sizes, layout spacing, glyph dimensions, shadows, transitions, and table-cell padding are outside the control-box ladder. Document optical or shell-specific exceptions beside the code and retain a reason on each lint suppression.

Density retargets variables on `:root[data-density="comfortable"]`. Nested density attributes and ThemeScope variants do not rescope them. Values live in `ui.css`; do not introduce literal metric ladders or density variants. These variables are implementation details, not consumer override tokens. See [theming](spec/theming.md) and [ADR 0001](adr/0001-canonical-token-contract.md).

## Tests and demos

- Co-locate unit tests in `*.test.ts`, browser tests in `*.browser.test.tsx`, and public type contracts in `*.test-d.tsx`. Unit tests assert recipe output and pure logic. Browser tests exercise real components, including keyboard behavior, labels, focus, disabled states, and localized copy. See [accessibility](spec/accessibility.md) and [testing strategy](spec/tooling.md#7-testing-strategy).
- Locate elements by role or label. DOM structure checks may use slots or document queries when a nearby `DOM audit:` comment explains the contract that needs inspection. The shared browser-helper gate requires the comment on the query line or within the previous 16 lines.
- Import shared queries and density helpers from `packages/ui/test/themed-browser-render.tsx` and focus assertions from `packages/ui/test/assert-focus-ring.ts`. Test computed metrics at both document density stamps and prove nested stamps do not rescope them. Token-color assertions need an element inside ThemeScope and `dist/themes.css`.
- Demos are runnable client `.tsx` modules beside their authored page in `apps/docs/src/app/(docs)/components/<slug>/demos/`. Each page imports the same file displayed as source. Use public package imports, subject to the three documented exceptions in [docs-site](spec/docs-site.md#6-demo-pipeline).
- Maintain `apps/docs/test/fixtures/component-demo-requirements.json` as the reviewed coverage list. It is independent of the page and generated manifest; update expectations deliberately when adding or changing scenarios. A sibling demo reference belongs to the component named in the filename.
- The docs site's SideNav and QuickNav compose docs-local navigation over ScrollArea. They do not import the library Sidebar.

`pnpm gen component <name>` creates intentionally failing implementation and test placeholders, a public entry, and a docs page with a demo. It also registers the new name and an unmeasured budget. Existing, reserved, interim React Aria, and deferred names are rejected before files are written.

Choose the anatomy, public props, accessibility behavior, and variants before replacing the placeholders. Add the independent RSC expectation and public type checks, measure the entry's budget, and follow the generator's steps to regenerate exports and docs artifacts. Finish with `pnpm ci:checks`. [Tooling](spec/tooling.md#6-scaffolding) describes the complete workflow.
