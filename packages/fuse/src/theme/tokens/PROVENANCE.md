# Dark palette provenance

The 2026-09-15 palette mapping used the Figma sources below. Prefer the named
custom Dark collections over suggested schematics; use schematics only for
missing roles. Token modules own the resulting values.

| Source         | Supplied reference                                                                                                                                                                                               | Custom palette used                                                                                                | Evidence / caveat                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fjordkraft     | [Pages](https://www.figma.com/design/NSsyvuE7xs3CcbbJggoN1b/Fjordkraft?node-id=34-17555)                                                                                                                         | [Farger / Dark, 4351:35911](https://www.figma.com/design/NSsyvuE7xs3CcbbJggoN1b/Fjordkraft?node-id=4351-35911)     | Fjordkraft - Colors, collection 4006:10608, Dark mode 4006:8.                                                                                                              |
| Bedrift        | [Suggested schematics](https://www.figma.com/design/UF9t0CyeKAwPEypCW3S41m/Bedrift?node-id=129-12419)                                                                                                            | [Farger / Dark, 2106:18317](https://www.figma.com/design/UF9t0CyeKAwPEypCW3S41m/Bedrift?node-id=2106-18317)        | Business - Colors. Applies only to `fkas-company`.                                                                                                                         |
| TrøndelagKraft | [Suggested schematics](https://www.figma.com/design/EcXXxqai6Q52s68FEvhdN8/Trondelagkraft?node-id=129-12419)                                                                                                     | [Farger / Dark, 2106:18317](https://www.figma.com/design/EcXXxqai6Q52s68FEvhdN8/Trondelagkraft?node-id=2106-18317) | Trøndelagkraft - Colors. Same values for both segments.                                                                                                                    |
| Telinet        | [Suggested schematics](https://www.figma.com/design/D7lEoOkBR6wOOHhJig30WZ/Telinet?node-id=129-12419)                                                                                                            | Telinet - Tokens, collection 4006:10608, Dark mode 4006:8                                                          | The [older dark sheet](https://www.figma.com/design/D7lEoOkBR6wOOHhJig30WZ/Telinet?node-id=2106-18317) disagrees with live variables for surfaces. Live custom values win. |
| Elmera         | [Suggested schematics](https://www.figma.com/design/dWv89e4X0DXeCKMsJwD5zL/Elmera?node-id=129-12419)                                                                                                             | [Farger / Dark, 2106:18317](https://www.figma.com/design/dWv89e4X0DXeCKMsJwD5zL/Elmera?node-id=2106-18317)         | Elmera - Colors. Same values for both segments.                                                                                                                            |
| GE             | [Variant, 27:2](https://www.figma.com/design/NQXVCgZ9HVC6TVhUIXxw8h/GE-fargepalett?node-id=27-2) and [image 73, 115:35788](https://www.figma.com/design/NQXVCgZ9HVC6TVhUIXxw8h/GE-fargepalett?node-id=115-35788) | Sampled image palette                                                                                              | No local color variables or paint styles. The repeated 115:35788 URL is one source, not independent confirmation.                                                          |

## External mappings and unresolved choices

- Surface and On Surface map to background and foreground. Primary Container
  maps to card, Surface Bright to card-soft, and Surface Variant to feature.
  Primary-soft uses Secondary Container with On Primary Container. Status
  containers map to the matching `*-soft` pair. Code copied from a reference
  uses the same mapping.
- Telinet's live Dark variables override its older neutral dark sheet. Telinet
  card-soft falls back to background; Telinet and Elmera feature-bright use card
  because those aliases are absent. Confirm Telinet's collection with design.
- Bedrift applies only to fkas-company. The permanent fkab alias uses Fjordkraft
  private, even though fkab is company-only. Other segments share their brand base.
- GE has no local color variables or paint styles. Every semantic assignment is
  provisional. The explicit strip in image 73 wins over nearby screenshot pixels:
  N-5 supplies background/sidebar, N-15 supplies card/popover/right-panel, and the
  navy strip supplies soft surfaces. The app callout supplies feature-bright.
  Orange actions are inferred from navigation/accents. Both segments share this
  provisional palette; screenshots do not establish interaction-state semantics.
- Keep feature-foreground decorative. A dark feature-bright alias can be neutral;
  its name does not promise higher luminance. Unresolved tertiary aliases in
  Elmera and TrøndelagKraft are outside the current token contract.
- Support roles are inferred. Popover/right-panel use card, accent uses primary-soft,
  sidebar uses background, and sidebar-accent uses card. Muted foreground, border
  and input come from the custom neutral ramp. Error uses the shared M3 error ramp;
  info uses Telinet schematic secondary, success its tertiary, and ring Elmera
  schematic tertiary. Warning, chart ordering and syntax assignments remain
  provisional shared choices. Contrast checks do not prove series distinction.
- Rebind destructive/error and sidebar-ring aliases in each scope. Keep brand
  pointers, fonts and radii from light identity. Review disabled/hover states,
  fixed-color artwork and charts in product screens before claiming acceptance.

## Internal mapping

The internal palette came from the user-supplied shadcn neutral dark values,
with the [shadcn pairing convention](https://ui.shadcn.com/docs/theming).
All internal themes share it while retaining their own sidebar brand accent;
the supplied blue sidebar-primary pair was deliberately unused.

Destructive remains an alias to error. Its supplied red uses dark foreground,
since white fails the text contrast floor. Missing soft and feature roles use
neutral card/soft values; right-panel uses card. Status, syntax and remaining
chart slots use shared defaults, except the supplied internal error red.

The user approved raising input white opacity from 15% to 40% and lightening
chart-4 and chart-5 while retaining hue/chroma. Decorative borders stay at 10%
white and cannot be the only control boundary. The three brighter chart greens
remain supplied values; slots 6–8 are fallback colors. The complete chart sequence
and inferred roles still need design review. Tests beside the theme pipeline own
contrast measurements and nested-scope checks.
