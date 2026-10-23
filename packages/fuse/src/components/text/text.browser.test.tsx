import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import {
  cssVarColor,
  fkasExternal,
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

  it("renders the provided render element with merged recipe classes", () => {
    renderThemed(
      <Text variant="muted" size="sm" render={<span />}>
        Continue as a span
      </Text>
    );
    const span = textNamed("Continue as a span");
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("data-slot")).toBe("text");
    expect(getComputedStyle(span).color).toBe(cssVarColor(span, "--muted-foreground"));
    expect(px(getComputedStyle(span).fontSize)).toBe(14);
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

  it("lets a className override win over the recipe", () => {
    renderThemed(<Text className="text-muted-foreground">Override</Text>);
    const element = textNamed("Override");
    expect(getComputedStyle(element).color).toBe(cssVarColor(element, "--muted-foreground"));
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

    it("gives inline children and deeper descendants the Text's line height and size", () => {
      renderThemed(
        <Text leading="snug">
          Read more <a href="#billing">here</a> and <strong>this</strong> or{" "}
          <a href="#deep">
            <strong>deeper</strong>
          </a>
        </Text>
      );
      const host = textNamed("Read more here and this or deeper");
      expect(lineHeightOf(host)).toBe(22);
      for (const descendant of [roleNamed("link", "here"), textNamed("this"), textNamed("deeper")]) {
        expect(lineHeightOf(descendant), descendant.textContent).toBe(22);
        expect(fontSizeOf(descendant), descendant.textContent).toBe(16);
      }
    });

    it("gives child paragraphs of a div Text its line height", () => {
      renderThemed(
        <Text elementType="div" leading="snug">
          <p>First paragraph.</p>
          <p>Second paragraph.</p>
        </Text>
      );
      const first = textNamed("First paragraph.");
      const host = first.parentElement;
      if (!(host instanceof HTMLElement)) throw new Error("expected the Text host");
      expect(lineHeightOf(host)).toBe(22);
      expect(lineHeightOf(first)).toBe(22);
      expect(lineHeightOf(textNamed("Second paragraph."))).toBe(22);
    });

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

    it("keeps a descendant's own leading class", () => {
      renderThemed(
        <Text elementType="div" leading="snug">
          <p className="leading-tight">Tight child.</p>
        </Text>
      );
      // leading-tight: 16 × 1.25 = 20.
      expect(lineHeightOf(textNamed("Tight child."))).toBe(20);
    });
  });

  /**
   * A Text's default line height comes from the theme's paragraph roles at sm, default and lg.
   * The expected heights are the design values, written by hand: the internal relaxed ratio,
   * 1.625 × 14, 16 and 18px, and the external paragraph styles 14/20, 16/22 and 18/24.
   * `text-without-themes.browser.test.tsx` covers a host without `themes.css`.
   */
  describe("paragraph line height", () => {
    const ROLE_SIZES = ["sm", "default", "lg"] as const;
    const PLAIN_SIZES = ["xs", "xl", "2xl"] as const;
    const INTERNAL = { sm: 22.75, default: 26, lg: 29.25 } as const;
    const EXTERNAL = { sm: 20, default: 22, lg: 24 } as const;
    // relaxed 1.625 × 12, 20 and 24px, in every theme.
    const RELAXED = { xs: 19.5, xl: 32.5, "2xl": 39 } as const;

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

    it("sets sm, default and lg from the theme's role in internal and external themes, in light and dark", () => {
      renderThemed(
        <>
          <SizedTexts prefix="Internal" />
          <ThemeScope theme={fkasExternal}>
            <SizedTexts prefix="External" />
          </ThemeScope>
          <div data-theme="dark">
            <ThemeScope theme={fkasPrivate}>
              <SizedTexts prefix="Dark internal" />
            </ThemeScope>
            <ThemeScope theme={fkasExternal}>
              <SizedTexts prefix="Dark external" />
            </ThemeScope>
          </div>
        </>
      );
      for (const size of ROLE_SIZES) {
        expect(lineHeightNamed(`Internal ${size}`), size).toBe(INTERNAL[size]);
        expect(lineHeightNamed(`External ${size}`), size).toBe(EXTERNAL[size]);
        expect(lineHeightNamed(`Dark internal ${size}`), size).toBe(INTERNAL[size]);
        expect(lineHeightNamed(`Dark external ${size}`), size).toBe(EXTERNAL[size]);
      }
    });

    it("keeps xs, xl and 2xl relaxed in internal and external themes", () => {
      renderThemed(
        <>
          <SizedTexts prefix="Internal" />
          <ThemeScope theme={fkasExternal}>
            <SizedTexts prefix="External" />
          </ThemeScope>
        </>
      );
      for (const size of PLAIN_SIZES) {
        expect(lineHeightNamed(`Internal ${size}`), size).toBe(RELAXED[size]);
        expect(lineHeightNamed(`External ${size}`), size).toBe(RELAXED[size]);
      }
    });

    it("resets the roles in an internal scope nested in an external one", () => {
      renderThemed(
        <ThemeScope theme={fkasExternal}>
          <Text>Outer external</Text>
          <ThemeScope theme={fkasPrivate}>
            <Text>Nested internal</Text>
          </ThemeScope>
        </ThemeScope>
      );
      expect(lineHeightNamed("Outer external")).toBe(22);
      expect(lineHeightNamed("Nested internal")).toBe(26);
    });

    it("lets an explicit leading or a className leading replace the external role", () => {
      renderThemed(
        <ThemeScope theme={fkasExternal}>
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

    it("gives a link and a child paragraph the external role", () => {
      renderThemed(
        <ThemeScope theme={fkasExternal}>
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
