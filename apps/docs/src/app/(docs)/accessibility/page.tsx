import type { ReactElement } from "react";

import Link from "next/link";

import { DocsPage, pageMetadata } from "../../../components/docs-page";
import { DocsTable } from "../../../components/docs-table";

const HREF = "/accessibility";

export const metadata = pageMetadata(HREF);

export default function AccessibilityPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="conformance-target">Conformance target</h2>
      <p>
        The library <strong>targets WCAG 2.2 AA</strong>. That is a design target, documented per component —{" "}
        <strong>not a conformance claim</strong>. Conformance is a property of a page, and only the app that
        assembles the page can achieve it. The Norwegian and EU legal baseline (EN 301 549) tracks WCAG 2.1
        AA, which 2.2 AA is a strict superset of, so meeting the target keeps a consuming app ahead of the
        legal floor.
      </p>

      <h2 id="responsibility-split">Responsibility split</h2>
      <p>The line between what the library owns and what your app owns is fixed:</p>
      <DocsTable.Wrap>
        <DocsTable.Root>
          <thead>
            <tr>
              <DocsTable.HeaderCell scope="col">The library owns</DocsTable.HeaderCell>
              <DocsTable.HeaderCell scope="col">Your app owns</DocsTable.HeaderCell>
            </tr>
          </thead>
          <tbody>
            <tr>
              <DocsTable.BodyCell>Widget semantics and roles</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Page structure: landmarks, heading order, skip links (see{" "}
                <Link href="/quick-start">Quick start</Link>)
              </DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>Keyboard behaviour and roving focus</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                <code>lang</code> attributes
              </DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>Focus visibility</DocsTable.BodyCell>
              <DocsTable.BodyCell>Focus management across route changes</DocsTable.BodyCell>
            </tr>
            <tr>
              <DocsTable.BodyCell>Correct-language built-in strings</DocsTable.BodyCell>
              <DocsTable.BodyCell>
                Final contrast when composing tokens in non-default pairings
              </DocsTable.BodyCell>
            </tr>
          </tbody>
        </DocsTable.Root>
      </DocsTable.Wrap>

      <h2 id="keyboard-and-focus">Keyboard &amp; focus</h2>
      <ul>
        <li>
          Focus rings render on <code>:focus-visible</code> only, never bare <code>:focus</code>, always
          through one shared recipe: a flush two-pixel ring in the <code>--ring</code> role, a neutral grey by
          default. Status Toasts, the warning and info Alerts and the default Accordion item rebind{" "}
          <code>--ring</code> to their soft surface&apos;s foreground, as the accepted deviations below
          explain. A keyboard-focused invalid control draws a one-pixel <code>--error</code> line inside its
          error halo instead. No component suppresses or redefines either recipe.
        </li>
        <li>
          Keyboard behaviour follows base-ui, with the documented component defaults: arrow-key roving with
          roving tabindex in composites, typeahead where base-ui provides it, <code>Escape</code> dismissing
          the topmost open overlay only, modal overlays trapping focus and returning it to the trigger on
          close. DropdownMenu submenus close the whole tree on Escape by default;{" "}
          <code>closeParentOnEsc=false</code> limits dismissal to the submenu. Tabs activate on arrow-key
          focus by default; set <code>activateOnFocus=false</code> for manual activation.
        </li>
        <li>
          No component sets a positive <code>tabindex</code>; <code>tabindex={"{-1}"}</code> appears only for
          programmatic focus targets.
        </li>
      </ul>

      <h2 id="labeling">Labeling</h2>
      <p>
        <Link href="/components/field">Field</Link> is the canonical labeling mechanism: it wires{" "}
        <code>id</code>/<code>htmlFor</code>, <code>aria-describedby</code> for the description and error, and
        the error announcement. No control invents its own label wiring.
      </p>
      <p>
        The rule is that <strong>every interactive element has a programmatic name</strong> — via Field,
        visible text content, or an explicit <code>aria-label</code>. Where that is mechanically expressible
        it is enforced in the types: an icon-only <code>Button</code> will not typecheck without an{" "}
        <code>aria-label</code>. There are no dev-mode runtime label warnings.
      </p>

      <h2 id="motion">Motion</h2>
      <p>
        One central <code>prefers-reduced-motion: reduce</code> block in the library stylesheet removes
        transform, translate and scale motion while retaining opacity fades — comprehension-aiding transitions
        survive, movement does not. No component opts out. UI transitions sit in a 150–300 ms ease-out band
        and normally animate <code>transform</code> and <code>opacity</code>. Reviewed layout transitions are
        accordion and collapsible height, accordion trigger padding, the height and top padding of an{" "}
        <code>Item.Footer</code> switching between <code>hidden</code> and <code>visible</code> (the
        sub-section of <code>RadioItem</code> and <code>CheckboxItem</code>), sidebar width and meter fill.
        The central reduced-motion rule disables those exceptions too.
      </p>

      <h2 id="target-size">Target size</h2>
      <p>
        Interactive controls meet WCAG 2.2 AA 2.5.8 Target Size (Minimum): at least{" "}
        <strong>24 × 24 CSS pixels</strong>, through the rendered box or a documented hit-area expansion.
        Density does not change this floor: the <code>xs</code> control height is floored at it at both
        densities, and comfortable only grows it.
      </p>

      <h2 id="accepted-deviations">Accepted deviations</h2>
      <p>Documented honestly rather than quietly fixed away:</p>
      <ul>
        <li>
          The neutral <code>--ring</code> is held to 3:1 against the page, card and muted surfaces in both
          color schemes. Muted is the Tabs list track. Status Toasts and the warning and info Alerts redraw
          the ring in their soft surface&apos;s foreground, because the neutral grey falls under 3:1 on the
          dark status soft fills. A default <code>Accordion</code> item does the same, because the grey falls
          under 3:1 on its <code>--primary-soft</code> fill in some brands. The ring sits flush against the
          control, so against a strong fill it can measure below 3:1 against that fill. The external secondary
          button carries the brand color in every brand except Nordic Green Energy, and in light mode the ring
          measures 1.62–1.79:1 against it. Against the light Telinet and Nordic Green Energy primary buttons
          it measures under 2.7:1. A brand can tune its ring in its palette.
        </li>
        <li>
          Light <code>--input</code>, the border of Input, Textarea, Select and the other field boxes,
          measures 1.08–1.70:1 against the page and card surfaces, under the 3:1 non-text floor. The interim
          GridList selection box draws its unchecked edge in <code>--border</code>, which measures only
          1.19–1.70:1 on the same surfaces. A field border of at least 3:1 is a design decision on the
          roadmap. <code>Checkbox</code>, <code>Radio</code> and <code>Switch</code> do not depend on it: the
          unchecked Checkbox and Radio edge and the unchecked Switch edge and thumb are{" "}
          <code>--muted-foreground</code>, held to 3:1 against the page, card, card-soft and modal surfaces in
          both color schemes.
        </li>
        <li>
          External themes draw no outer edge around a <code>RadioItem</code> or <code>CheckboxItem</code> row:{" "}
          <code>--selection-border</code> is transparent, checked or not, so it has no contrast floor. Stacked
          rows keep a decorative <code>--border</code> divider between them, which has no floor either. The
          row is not the control boundary. The <code>Checkbox</code> or <code>Radio</code> inside it carries
          the state with its own edge, held to 3:1 as above, and its checked fill. On a <code>card</code>
          -coloured surface, such as a white <code>Card</code> or a dark <code>Dialog</code> or{" "}
          <code>Sheet</code>, the row has no outline. External light modals fill with the page tint, so rows
          inside them keep the separation they have on the page.
        </li>
        <li>
          A default <code>Accordion</code> item fills with <code>--primary-soft</code>. Its own text takes{" "}
          <code>--primary-soft-foreground</code>, but muted copy inside it, such as a field description,
          measures under 4.5:1 in light mode: 4.43:1 on the internal themes, 3.84:1 on Fjordkraft and 4.17:1
          on Telinet. Dark mode holds 4.5:1 in every theme.
        </li>
        <li>
          <code>feature-foreground</code> is reclassified as accent/decorative. Text on <code>feature</code>{" "}
          panels uses white; body text on feature panels is out of contract.
        </li>
      </ul>
      <p>
        Contrast snapshots cover all twenty-four themes. Text pairs hold 4.5:1 in both color schemes,
        including <code>--muted-foreground</code> on the page, <code>--muted</code>, card, card-soft and modal
        surfaces, so muted descriptions can carry required information. Additional tests cover dark panel
        text, dark input boundaries, the selection-control edge and focus colors. Decorative dark borders
        cannot be the sole control boundary. These checks do not establish whole-page conformance; review
        states, artwork and charts in their product context.
      </p>
      <p>
        A chart palette test measures the chart roles on the page, card, card-soft and modal surfaces of all
        twenty-four themes in both color schemes. Every categorical slot, <code>--chart-other</code> and the
        two sentiment roles hold 3:1 on each surface. Neighbouring slots, including slot 8 beside slot 1, and
        slots two apart stay distinguishable in normal vision and under simulated protanopia and deuteranopia,
        so any start offset and any three consecutive slots keep their series apart. The sequential ramp and
        each diverging arm step in lightness, and their least step holds 2:1. Each{" "}
        <code>--chart-N-foreground</code> holds 4.5:1 on its slot. <code>--chart-other</code> is a grey that
        stays apart from every slot in normal vision only, so draw the folded series last and label it. Pair
        color with a legend or a direct label, and keep a status series' icon and label.
      </p>
    </DocsPage>
  );
}
