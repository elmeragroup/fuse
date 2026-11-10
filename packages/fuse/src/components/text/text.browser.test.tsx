import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fkasBranded,
  fkasPrivate,
  px,
  renderThemed,
  roleNamed,
  textNamed,
} from "../../../test/themed-browser-render";
import { ThemeScope } from "../../theme";
import { Text } from "./text";

const WIDGET_ROLES = ["button", "link", "textbox", "checkbox", "radio", "listitem", "heading"] as const;

describe("Text", () => {
  it("renders a p by default with data-slot=text and no widget role", () => {
    renderThemed(<Text>March usage is estimated.</Text>);
    const paragraph = textNamed("March usage is estimated.");
    expect(paragraph.tagName).toBe("P");
    expect(paragraph.getAttribute("data-slot")).toBe("text");
    expect(paragraph.getAttribute("role")).toBeNull();
    expect(paragraph.getAttribute("tabindex")).toBeNull();
    for (const role of WIDGET_ROLES) {
      expect(page.getByRole(role).query(), role).toBeNull();
    }
  });

  it('renders a span when elementType is "span"', () => {
    renderThemed(<Text elementType="span">Inline note</Text>);
    const span = textNamed("Inline note");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("text");
    expect(page.getByRole("paragraph").query()).toBeNull();
  });

  it("resolves destructive onto text-error and success onto text-success", () => {
    renderThemed(
      <>
        <Text variant="destructive">Cancelled</Text>
        <Text variant="success">Delivered</Text>
      </>
    );
    const cancelled = textNamed("Cancelled");
    expect(getComputedStyle(cancelled).color).toBe(cssVarColor(cancelled, "--error"));
    expect(getComputedStyle(textNamed("Delivered")).color).toBe(
      cssVarColor(textNamed("Delivered"), "--success")
    );
  });

  describe("descendant line height", () => {
    // Default size is 16px: snug 16 × 1.375 = 22, relaxed 16 × 1.625 = 26, and the size's own
    // line height 16 × 1.5 = 24 is what a descendant fell back to before.
    function lineHeightOf(element: HTMLElement): number {
      return px(getComputedStyle(element).lineHeight);
    }

    function fontSizeOf(element: HTMLElement): number {
      return px(getComputedStyle(element).fontSize);
    }

    it("carries the default relaxed leading to a child paragraph", () => {
      renderThemed(
        <Text elementType="div">
          <p>Relaxed child.</p>
        </Text>
      );
      expect(lineHeightOf(textNamed("Relaxed child."))).toBe(26);
    });

    it("still forces a descendant's own size class onto the Text's size", () => {
      renderThemed(
        <Text size="sm">
          Small with <span className="text-lg">a large class</span>
        </Text>
      );
      // size sm is 14px; the descendant arm wins over the child's text-lg (18px).
      expect(fontSizeOf(textNamed("a large class"))).toBe(14);
    });
  });

  /**
   * A Text's default line height comes from the theme's paragraph roles at sm, default and lg.
   * The expected heights are the design values, written by hand: the neutral relaxed ratio,
   * 1.625 × 14, 16 and 18px, and the branded paragraph styles 14/20, 16/22 and 18/24.
   * `text-without-themes.browser.test.tsx` covers a host without `themes.css`.
   */
  describe("paragraph line height", () => {
    const ROLE_SIZES = ["sm", "default", "lg"] as const;
    const PLAIN_SIZES = ["xs", "xl", "2xl"] as const;
    const NEUTRAL = { sm: 22.75, default: 26, lg: 29.25 } as const;
    const BRANDED = { sm: 20, default: 22, lg: 24 } as const;

    function SizedTexts({ prefix }: { prefix: string }) {
      return (
        <>
          {[...ROLE_SIZES, ...PLAIN_SIZES].map((size) => (
            <Text key={size} size={size}>{`${prefix} ${size}`}</Text>
          ))}
        </>
      );
    }

    function lineHeightNamed(name: string): number {
      return px(getComputedStyle(textNamed(name)).lineHeight);
    }

    it("sets sm, default and lg from the theme's role in neutral and branded themes, in light and dark", () => {
      renderThemed(
        <>
          <SizedTexts prefix="Neutral" />
          <ThemeScope theme={fkasBranded}>
            <SizedTexts prefix="Branded" />
          </ThemeScope>
          <div data-theme="dark">
            <ThemeScope theme={fkasPrivate}>
              <SizedTexts prefix="Dark neutral" />
            </ThemeScope>
            <ThemeScope theme={fkasBranded}>
              <SizedTexts prefix="Dark branded" />
            </ThemeScope>
          </div>
        </>
      );
      for (const size of ROLE_SIZES) {
        expect(lineHeightNamed(`Neutral ${size}`), size).toBe(NEUTRAL[size]);
        expect(lineHeightNamed(`Branded ${size}`), size).toBe(BRANDED[size]);
        expect(lineHeightNamed(`Dark neutral ${size}`), size).toBe(NEUTRAL[size]);
        expect(lineHeightNamed(`Dark branded ${size}`), size).toBe(BRANDED[size]);
      }
    });

    it("resets the roles in a neutral scope nested in a branded one", () => {
      renderThemed(
        <ThemeScope theme={fkasBranded}>
          <Text>Outer branded</Text>
          <ThemeScope theme={fkasPrivate}>
            <Text>Nested neutral</Text>
          </ThemeScope>
        </ThemeScope>
      );
      expect(lineHeightNamed("Outer branded")).toBe(22);
      expect(lineHeightNamed("Nested neutral")).toBe(26);
    });

    it("lets an explicit leading or a className leading replace the branded role", () => {
      renderThemed(
        <ThemeScope theme={fkasBranded}>
          <Text leading="snug" size="lg">
            Snug prop
          </Text>
          <Text leading="relaxed">Relaxed prop</Text>
          <Text className="leading-tight">Tight class</Text>
        </ThemeScope>
      );
      // snug 18 × 1.375 = 24.75, relaxed 16 × 1.625 = 26, tight 16 × 1.25 = 20.
      expect(lineHeightNamed("Snug prop")).toBe(24.75);
      expect(lineHeightNamed("Relaxed prop")).toBe(26);
      expect(lineHeightNamed("Tight class")).toBe(20);
    });

    it("gives a link and a child paragraph the branded role", () => {
      renderThemed(
        <ThemeScope theme={fkasBranded}>
          <Text size="sm">
            Read the <a href="#terms">terms</a>
          </Text>
          <Text elementType="div" size="lg">
            <p>Large child.</p>
          </Text>
        </ThemeScope>
      );
      expect(px(getComputedStyle(roleNamed("link", "terms")).lineHeight)).toBe(20);
      expect(lineHeightNamed("Large child.")).toBe(24);
    });
  });
});
