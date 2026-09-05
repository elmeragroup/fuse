# Icons, logos, illustrations, and flags

Normative asset contract for `@elmeragroup/ui`.

## 1 Public entries

- `@elmeragroup/ui/icons` exports curated Phosphor adapters, bespoke marks, logos, and `BrandLogo`. It is subpath-only and is not re-exported from the package root.
- `@elmeragroup/ui/illustrations` exports brand artwork such as `FkasMeter`; it is subpath-only.
- `@elmeragroup/ui/flags` exports the generated `flagAssets` manifest and `FlagAssetCode`. `@elmeragroup/ui/flags/<CC>.svg` exposes each static asset. The packaging and phone-country resolution details are in [architecture](architecture.md) §6a.
- There is no `Icon` namespace, SVG loader, SVGR consumer requirement, icon font, default export, Unicode-flag mode, or remote asset mode.

## 2 Phosphor adapters

`@phosphor-icons/react@2.1.10` is an exact regular dependency. Each curated icon has its own generated **server-safe** source module importing the matching per-icon ESM module from `@phosphor-icons/react/dist/ssr/<Icon>` and exporting a wrapper with this public prop type:

```ts
type ElmeraIconProps = Omit<PhosphorIconProps, "weight"> & {
  weight?: "regular" | "fill";
};
```

The wrapper defaults `weight` to `"regular"`; library components use `fill` only for a selected or active state. The wrapper exists because a direct re-export cannot narrow `weight`. Generated modules preserve `ref`, `className`, `size`, `color`, `mirrored`, SVG attributes, and the upstream `alt` behavior. They carry no `"use client"` directive: the pinned package's `dist/ssr/*` modules render without hooks or icon context and are explicitly exported for server use. They must import these exact per-icon SSR subpaths, never the upstream barrel or `dist/csr/*`.

The curated v1 roster is exhaustive and code-generated from a literal manifest:

`ArrowLeft`, `ArrowRight`, `ArrowsClockwise`, `ArrowsDownUp`, `ArrowsOut`, `ArrowSquareOut`, `Backspace`, `Bell`, `Buildings`, `Bug`, `Calculator`, `CalendarBlank`, `Camera`, `CaretDown`, `CaretLeft`, `CaretRight`, `CaretUp`, `CaretUpDown`, `ChartBar`, `ChartLine`, `ChartLineUp`, `Check`, `CheckCircle`, `Circle`, `Cloud`, `CloudArrowUp`, `Confetti`, `Copy`, `CreditCard`, `CurrencyCircleDollar`, `DeviceMobile`, `Dot`, `DotOutline`, `DotsSixVertical`, `DotsThree`, `DotsThreeVertical`, `Download`, `Envelope`, `Equals`, `Eye`, `EyeSlash`, `FileArrowUp`, `FileMagnifyingGlass`, `Files`, `Flag`, `FloppyDisk`, `Folder`, `Funnel`, `Gauge`, `Gear`, `Graph`, `HandCoins`, `Hash`, `House`, `IdentificationBadge`, `Info`, `Keyboard`, `Lifebuoy`, `Lightning`, `Link`, `List`, `ListChecks`, `ListNumbers`, `Lock`, `MagnifyingGlass`, `MapPin`, `Minus`, `Money`, `Notebook`, `NotePencil`, `Package`, `Paperclip`, `PaperPlaneTilt`, `Pencil`, `Percent`, `Phone`, `Plug`, `Plus`, `Prohibit`, `Receipt`, `Scroll`, `SealCheck`, `SealPercent`, `ShareNetwork`, `ShieldCheck`, `ShoppingCart`, `Sidebar`, `SidebarSimple`, `SignOut`, `SpinnerGap`, `Stack`, `Star`, `StopCircle`, `Storefront`, `Textbox`, `Translate`, `Trash`, `Tray`, `TrendDown`, `TrendUp`, `Truck`, `Upload`, `User`, `UserCircleGear`, `UserFocus`, `UserPlus`, `Users`, `Warning`, `WarningCircle`, `WarningOctagon`, `X`, `XCircle`.

These names were checked against the pinned package tarball. Adding or removing one is a public API change and updates the manifest snapshot, generated modules, export-name test, docs roster, and changeset together. `DotsSixVertical` was added 2026-09-02 for the GridList drag handle.

### Reference-name migration

The old namespace is not reproduced. When porting reference code, use these canonical substitutions; concepts not listed use an identically named curated export.

| Reference concept             | Public export             |
| ----------------------------- | ------------------------- |
| `AlertCircle`                 | `WarningCircle`           |
| `AlertTriangle`               | `Warning`                 |
| `BadgeCheck`                  | `SealCheck`               |
| `BadgePercent`                | `SealPercent`             |
| `Ban`                         | `Prohibit`                |
| `Banknote`                    | `Money`                   |
| `Blocks`                      | `Stack`                   |
| `Box`                         | `Package`                 |
| `Building2`                   | `Buildings`               |
| `Calendar`                    | `CalendarBlank`           |
| `ChartBarIncreasing`          | `ChartLineUp`             |
| `ChartNetwork`                | `Graph`                   |
| `ChevronDown/Left/Right/Up`   | `CaretDown/Left/Right/Up` |
| `ChevronsUpDown`              | `CaretUpDown`             |
| `CircleDollarSign`            | `CurrencyCircleDollar`    |
| `CloudUpload`                 | `CloudArrowUp`            |
| `Delete`                      | `Backspace`               |
| `Ellipsis` / `MoreHorizontal` | `DotsThree`               |
| `EllipsisVertical`            | `DotsThreeVertical`       |
| `Expand`                      | `ArrowsOut`               |
| `ExternalLink`                | `ArrowSquareOut`          |
| `EyeOff`                      | `EyeSlash`                |
| `FileStack`                   | `Files`                   |
| `FileUp`                      | `FileArrowUp`             |
| `GaugeCircle`                 | `Gauge`                   |
| `History`                     | `ArrowsClockwise`         |
| `Home`                        | `House`                   |
| `Languages`                   | `Translate`               |
| `LineChart`                   | `ChartLine`               |
| `ListOrdered`                 | `ListNumbers`             |
| `Loader2`                     | `SpinnerGap`              |
| `LogOut`                      | `SignOut`                 |
| `Mail`                        | `Envelope`                |
| `MapPinHouse`                 | `MapPin`                  |
| `NotebookPen`                 | `Notebook`                |
| `PencilLine`                  | `NotePencil`              |
| `RefreshCw`                   | `ArrowsClockwise`         |
| `Save`                        | `FloppyDisk`              |
| `Search`                      | `MagnifyingGlass`         |
| `Send`                        | `PaperPlaneTilt`          |
| `Settings`                    | `Gear`                    |
| `ShoppingCart`                | `ShoppingCart`            |
| `Smartphone`                  | `DeviceMobile`            |
| `Store`                       | `Storefront`              |
| `TextSearch`                  | `FileMagnifyingGlass`     |
| `Trash2`                      | `Trash`                   |
| `TrendingDown/Up`             | `TrendDown/Up`            |
| `TrendingUpDown`              | `ArrowsDownUp`            |
| `Zap`                         | `Lightning`               |

No compatibility aliases are exported. A port must choose the semantic result explicitly instead of mechanically preserving a legacy glyph name.

## 3 Bespoke icon roster

These are hand-authored SVG React components under `/icons`, copied from the pinned references with provenance and applicable notices retained:

- payment/signing: `BankIdDna`, `BankIdSweden`, `Vipps`, `Signing`, `Contract`, `StromSmart`, `AlertMark`, `HomeTitleIcon`;
- product: `OrderLogo`, `CollectLogo`, `DeviateLogo`, `FunnelLogo`, `DoubleCheck`.

The source-to-export mapping is exact:

| Public export   | Pinned source                                                        |
| --------------- | -------------------------------------------------------------------- |
| `BankIdDna`     | `.ref/OrderModuleWeb/packages/ui/src/icons/bankid-dna.svg`           |
| `BankIdSweden`  | `.ref/OrderModuleWeb/packages/ui/src/icons/bankid-sweden.svg`        |
| `Vipps`         | `.ref/OrderModuleWeb/packages/ui/src/icons/vipps.svg`                |
| `Signing`       | `.ref/OrderModuleWeb/packages/ui/src/icons/signing.tsx`              |
| `Contract`      | `.ref/OrderModuleWeb/packages/ui/src/icons/contract.svg`             |
| `StromSmart`    | `.ref/OrderModuleWeb/packages/ui/src/icons/strom-smart.svg`          |
| `AlertMark`     | `.ref/OrderModuleWeb/packages/ui/src/icons/alert.svg`                |
| `HomeTitleIcon` | `.ref/OrderModuleWeb/packages/ui/src/icons/home-title-icon.svg`      |
| `OrderLogo`     | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/order-logo.tsx`   |
| `CollectLogo`   | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/collect-logo.tsx` |
| `DeviateLogo`   | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/deviate-logo.tsx` |
| `FunnelLogo`    | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/funnel-logo.tsx`  |
| `DoubleCheck`   | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/double-check.tsx` |

The generic external `Alert` asset is named `AlertMark` to avoid collision with the `Alert` component. Every component accepts `ComponentPropsWithoutRef<"svg"> & { title?: string }`. With `title`, it renders `role="img"` and an associated `<title>`; without one it renders `aria-hidden="true"` and `focusable="false"`. Decorative uses must not acquire an accessible name accidentally.

Raw `.svg` inputs are converted to ordinary React source modules while vendoring the assets. Published entries expose components only; consumers never need an SVG loader or SVGR configuration.

`Signing` is the one theme-aware bespoke source. Its four legacy Material classes are renamed exactly while porting: `fill-secondary-container` → `fill-secondary-soft`, `fill-surface-bright` → `fill-card-soft`, `fill-on-surface-variant` → `fill-feature-foreground`, and `fill-on-surface` → `fill-foreground`. All other bespoke paint is copied unchanged: fixed hex artwork stays fixed and existing `currentColor` artwork remains consumer-colorable. No legacy token class may survive in the package.

## 4 Logos and illustrations

Logo exports are `FjordkraftLogo`, `TrondelagkraftLogo`, `GudbrandsdalEnergiLogo`, `TelinetLogo`, `ElmeraGroupLogo`, `SteddiLogo`, and `TrumfLogo`. The official trade spelling is **TrøndelagKraft**; `TrondelagkraftLogo` remains the locked ASCII component identifier and does not define customer-visible casing. Each logo accepts SVG props plus `variant?: "full" | "mark"` (default `"full"`); this replaces every legacy `Small`/`Mini` export. NGE Sweden is dropped.

```ts
type LogoProps = ComponentPropsWithoutRef<"svg"> & {
  title?: string;
  variant?: "full" | "mark";
};

type BrandLogoProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  brand: ThemeInput["brand"];
  variant?: "full" | "mark";
  title?: string;
};
```

The variant-to-source mapping is exact and prefers the internal snapshot where both references contain an asset:

| Public export            | `full` source                                                                    | `mark` source                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `FjordkraftLogo`         | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/fjordkraft-logo.tsx`          | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/fjordkraft-logo-small.tsx`          |
| `TrondelagkraftLogo`     | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/trondelagkraft-logo.tsx`      | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/trondelagkraft-logo-small.tsx`      |
| `GudbrandsdalEnergiLogo` | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/gudbrandsdal-energi-logo.tsx` | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/gudbrandsdal-energi-logo-small.tsx` |
| `TelinetLogo`            | `.ref/OrderModuleWeb/packages/ui/src/icons/telinet-logo.tsx`                     | `.ref/OrderModuleWeb/packages/ui/src/icons/telinet-logo-mini.tsx`                      |
| `ElmeraGroupLogo`        | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/elmera-group-logo.tsx`        | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/elmera-group-logo-small.tsx`        |
| `SteddiLogo`             | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/steddi-logo.tsx`              | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/steddi-logo.tsx`                    |
| `TrumfLogo`              | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/trumf-logo.tsx`               | `.ref/OrderModuleInternalWeb/packages/ui/src/icons/trumf-logo-small.tsx`               |

Steddi has only one pinned glyph, so both variants intentionally render that same source until a separately licensed wordmark is added. All logo variants use the same optional-title accessibility behavior as bespoke icons. Their SVG paint is copied unchanged: fixed official colors stay fixed, while existing `currentColor` artwork remains consumer-colorable. Neither form is remapped to theme role tokens.

`BrandLogo` maps `fkas` and `fkab` to Fjordkraft, `tkas` to TrøndelagKraft, `guen` to Gudbrandsdal Energi, and `fkse` to Telinet. Energy-brand codes render the matching SVG mark inside the same accessible `<span>` host for both `full` and `mark`. `elma` keeps the text/`displayName` fallback and invents no SVG. Public props are that host's props, not SVG attributes; advertised host props are applied on the span. The host stamps `data-variant` with the resolved `"full"` or `"mark"` value. `title` is the accessible name (`aria-label`), defaulting to the brand display name. It reads `BRANDS[brand].displayName`, is exhaustive over `BrandCode`, and reads no context; consumers pass the brand explicitly. Adding `elma` does not leave a hole in the mapping.

`@elmeragroup/ui/illustrations` initially exports `FkasMeter`, copied from `.ref/OrderModuleWeb/packages/ui/src/illustrations/fkas-meter.tsx`. Illustrations accept SVG props plus the same optional-title accessibility contract. New artwork joins only with recorded public-distribution rights.

## 5 Flags

Flags reuse the vendored two-letter SVG set described in [architecture](architecture.md) §6a. `PhoneNumberField` always uses those packaged URLs, including on macOS; this deliberately gives every OS the same artwork. The shipped 249-file subset is exactly 765,286 raw bytes (~747 KiB) at the pinned snapshot, outside JavaScript and guarded by hashes plus an 800 KiB aggregate ceiling. (`du` reports more because of filesystem block allocation; that is not package payload.) `AC`, `BQ`, `EH`, and `TA` have libphonenumber entries but no pinned SVG and are excluded from flag-bearing phone country state rather than receiving a misleading substitute. Native lazy image loading limits requests to browser-rendered/near-viewport rows. A CDN would add availability, privacy, cache-policy, CSP, and version-skew failure modes without reducing JavaScript, so remote URLs are out of scope.

## 6 Tests and gates

- Type tests reject `thin`, `light`, `bold`, and `duotone` on public Phosphor adapters and accept `regular`/`fill`.
- Export tests import every curated icon and bespoke asset by name; there is no `Icon` export.
- The Next packed fixture imports and renders both a Phosphor adapter and a bespoke logo directly in a server component; a second client-island render proves the same adapter remains usable from client code.
- Browser tests cover `BrandLogo`'s six-code mapping and both variants, including `role="img"`, the accessible name, and `data-variant`. Energy brands render SVG marks; `elma` asserts accessible text/`displayName` output and no SVG.
- Accessibility tests cover titled and decorative bespoke SVG modes.
- The `Signing` render test asserts the four canonical fill classes above and rejects every legacy class; fixed-paint and `currentColor` assets retain their source paint behavior.
- Packed fixtures resolve representative `NO.svg`, `SE.svg`, and `FI.svg` URLs and assert no manifest URL has an HTTP(S), data, or blob scheme.
- Asset checks assert exactly 249 two-letter SVGs, one manifest key and resolvable local URL per shipped filename, the generated hash manifest, and a total raw payload no larger than 800 KiB; non-country source files are absent from the tarball. The cross-dataset phone-country test and exact four-code gap are owned by [architecture](architecture.md) §6a.
