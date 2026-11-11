import { createElement } from "react";
import type { ReactElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AlertMark,
  BankIdDna,
  BankIdSweden,
  Check,
  CollectLogo,
  Contract,
  DeviateLogo,
  ElmeraGroupLogo,
  FjordkraftLogo,
  FunnelLogo,
  GudbrandsdalEnergiLogo,
  HomeTitleIcon,
  NordicGreenEnergyLogo,
  OrderLogo,
  Signing,
  SteddiLogo,
  StromSmart,
  TelinetLogo,
  TrondelagkraftLogo,
  TrumfLogo,
  Vipps,
} from "../icons";
import { FkasMeter } from "../illustrations";
import type { LogoProps } from "./bespoke-svg";
import { TelinetLogoFull } from "./bespoke/telinet-logo-full";
import { TelinetLogoMark } from "./bespoke/telinet-logo-mark";
import type { BespokeIconName, LogoName } from "./roster";

const logosByName = {
  ElmeraGroupLogo,
  FjordkraftLogo,
  GudbrandsdalEnergiLogo,
  NordicGreenEnergyLogo,
  SteddiLogo,
  TelinetLogo,
  TrondelagkraftLogo,
  TrumfLogo,
} satisfies Record<LogoName, (props: LogoProps) => ReactElement>;

/** The naming props both icon families accept; each satisfies this structurally. */
type NamedSvg = (props: {
  title?: string;
  role?: "img";
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}) => ReactElement;

const svgFamilies: ReadonlyArray<readonly [string, NamedSvg]> = [
  ["Vipps", Vipps],
  ["Check", Check],
];

/** Every bespoke asset; the record type makes a roster addition a decision here. */
const bespokeIcons = {
  AlertMark,
  BankIdDna,
  BankIdSweden,
  CollectLogo,
  Contract,
  DeviateLogo,
  FunnelLogo,
  HomeTitleIcon,
  OrderLogo,
  Signing,
  StromSmart,
  Vipps,
} satisfies Record<BespokeIconName, NamedSvg>;

function definedIds(text: string): string[] {
  return [...text.matchAll(/\bid="([^"]+)"/g)].flatMap((match) => match[1] ?? []);
}

/** The decorative half of the bespoke SVG contract: hidden, unfocusable, no role, no title. */
function expectDecorative(markup: string, label?: string) {
  expect(markup, label).toContain('aria-hidden="true"');
  expect(markup, label).toContain('focusable="false"');
  expect(markup, label).not.toContain('role="img"');
  expect(markup, label).not.toContain("<title>");
}

/** The titled half: announced as an image with the title element and never hidden. */
function expectTitled(markup: string, title: string, label?: string) {
  expect(markup, label).toContain('role="img"');
  expect(markup, label).toContain(`<title>${title}</title>`);
  expect(markup, label).not.toContain("aria-hidden");
}

/**
 * Every bespoke asset as it renders, once: each roster icon, each logo in both variants (so every
 * full, mark and glyph file draws), and the illustrations. A logo whose two variants draw the same
 * file, such as Steddi's glyph, renders identical markup and counts once.
 */
function renderedAssets(): Array<readonly [string, string]> {
  const rendered = [
    ...Object.entries(bespokeIcons).map(
      ([name, Icon]) => [name, renderToStaticMarkup(createElement(Icon))] as const
    ),
    ...Object.entries(logosByName).flatMap(([name, Logo]) =>
      (["full", "mark"] as const).map(
        (variant) => [`${name} ${variant}`, renderToStaticMarkup(createElement(Logo, { variant }))] as const
      )
    ),
    ["FkasMeter", renderToStaticMarkup(createElement(FkasMeter))] as const,
  ];
  const seen = new Set<string>();
  return rendered.filter(([, markup]) => {
    if (seen.has(markup)) return false;
    seen.add(markup);
    return true;
  });
}

describe("bespoke icons", () => {
  // One contract for both icon families, every bespoke asset and the Phosphor adapter
  // (Check), and for the illustrations (FkasMeter).
  it.each<readonly [string, NamedSvg]>([
    ["Check", Check],
    ...Object.entries(bespokeIcons),
    ["FkasMeter", FkasMeter],
  ])("renders a titled %s as role=img and an untitled or empty-titled one as aria-hidden", (_, Icon) => {
    expectTitled(renderToStaticMarkup(createElement(Icon, { title: "Done" })), "Done");
    expectDecorative(renderToStaticMarkup(createElement(Icon)));
    expectDecorative(renderToStaticMarkup(createElement(Icon, { title: "" })));
    // Nonempty means meaningful: whitespace-only is still a titled image, not decorative.
    expectTitled(renderToStaticMarkup(createElement(Icon, { title: " " })), " ");
  });

  // Each logo spells the guard twice — `decorativeSvgProps(title)` and its own
  // `{title ? <title>…</title> : null}` — so the two can only stay in step by being
  // checked together, for every logo, rather than for whichever one a case names.
  // Both variants, so every full and mark asset renders its title only from the prop.
  it.each(Object.entries(logosByName))("keeps %s's title guard and props in step", (name, Logo) => {
    for (const variant of ["full", "mark"] as const) {
      const label = `${name} ${variant}`;
      for (const title of ["", undefined]) {
        expectDecorative(renderToStaticMarkup(createElement(Logo, { variant, title })), label);
      }
      expectTitled(renderToStaticMarkup(createElement(Logo, { variant, title: name })), name, label);
      // Nonempty means meaningful: whitespace-only is still a titled image, not decorative.
      expectTitled(renderToStaticMarkup(createElement(Logo, { variant, title: " " })), " ", label);
    }
  });

  it.each(svgFamilies)("lets caller SVG attributes override %s's naming defaults", (_, Icon) => {
    const hiddenWhileTitled = renderToStaticMarkup(
      createElement(Icon, { title: "Done", "aria-hidden": true })
    );
    expect(hiddenWhileTitled).toContain('role="img"');
    expect(hiddenWhileTitled).toContain('aria-hidden="true"');

    const visibleWhileDecorative = renderToStaticMarkup(createElement(Icon, { "aria-hidden": false }));
    expect(visibleWhileDecorative).toContain('aria-hidden="false"');

    // aria-label is not a naming prop: an untitled icon stays hidden even when labelled.
    const labeledUntitled = renderToStaticMarkup(createElement(Icon, { "aria-label": "Done", role: "img" }));
    expect(labeledUntitled).toContain('role="img"');
    expect(labeledUntitled).toContain('aria-label="Done"');
    expect(labeledUntitled).toContain('aria-hidden="true"');
  });

  it("uses canonical Signing fill classes and rejects Material leftovers", () => {
    const html = renderToStaticMarkup(createElement(Signing));
    expect(html).toContain("fill-secondary-soft");
    expect(html).toContain("fill-card-soft");
    expect(html).toContain("fill-feature-foreground");
    expect(html).toContain("fill-foreground");
    expect(html).not.toContain("fill-secondary-container");
    expect(html).not.toContain("fill-surface-bright");
    expect(html).not.toContain("fill-on-surface-variant");
    expect(html).not.toContain('className="fill-on-surface"');
  });

  it("namespaces defs ids per asset so no id is defined by two assets", () => {
    // The next Figma/Sketch intake with generic ids (mask0_1_353, linearGradient-1)
    // must fail here instead of colliding with another asset's defs in the DOM.
    const owners = new Map<string, string>();
    let definitions = 0;
    for (const [file, source] of renderedAssets()) {
      const defined = definedIds(source);
      definitions += defined.length;
      for (const id of defined) {
        const owner = owners.get(id);
        expect(owner, `id "${id}" is defined in both ${owner} and ${file}`).toBeUndefined();
        owners.set(id, file);
      }
      for (const [, ref] of source.matchAll(/url\(#([^)]+)\)/g)) {
        expect(defined, `${file} references #${ref}`).toContain(ref);
      }
    }
    expect(definitions).toBeGreaterThan(0);
  });

  it("renders the same asset twice as duplicate-but-identical defs", () => {
    // Two instances of one asset share identical namespaced defs by construction,
    // so the first definition in the DOM wins harmlessly. Cross-asset collisions
    // are what the per-asset id namespace above prevents.
    for (const Component of [Signing, Contract, TelinetLogo]) {
      const html = renderToStaticMarkup(
        createElement("div", null, createElement(Component), createElement(Component))
      );
      const ids = definedIds(html);
      expect(ids.length, Component.name).toBeGreaterThan(0);
      const counts = new Map<string, number>();
      for (const id of ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const [id, count] of counts) {
        expect(count, `${Component.name} defines ${id}`).toBe(2);
      }
      for (const [, ref] of html.matchAll(/url\(#([^)]+)\)/g)) {
        expect(ids, `${Component.name} references #${ref}`).toContain(ref);
      }
    }
  });

  it("routes logo variant switching through createLogo", () => {
    // Oracles: the Mark/Full fixtures, independent of createLogo (the unit under test).
    expect(renderToStaticMarkup(createElement(TelinetLogo, { variant: "mark", title: "Telinet" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoMark, { title: "Telinet" }))
    );
    expect(renderToStaticMarkup(createElement(TelinetLogo, { title: "Telinet" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoFull, { title: "Telinet" }))
    );
    expect(renderToStaticMarkup(createElement(TelinetLogo, { variant: "full" }))).toBe(
      renderToStaticMarkup(createElement(TelinetLogoFull))
    );
    for (const [name, Logo] of Object.entries(logosByName)) {
      // SAFETY: displayName is stamped by createLogo; the public prop type does not carry it.
      expect((Logo as { displayName?: string }).displayName, name).toBe(name);
    }
  });
});
