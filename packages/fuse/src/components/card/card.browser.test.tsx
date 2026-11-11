import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectActivationCancelled, resetHashAroundEach } from "../../../test/aria-disabled-activation";
import { ringLayers, settleTransitions } from "../../../test/assert-invalid-ring";
import { RADIUS_LG } from "../../../test/inner-corner-specimens";
import {
  headingNamed,
  renderThemed,
  textNamed,
  cssVarColor,
  px,
  roleNamed,
} from "../../../test/themed-browser-render";
import { Card } from "./card";

describe("Card", () => {
  it("renders the title as a level-3 heading by default and honours level", () => {
    renderThemed(
      <>
        <Card.Root>
          <Card.Header>
            <Card.Title>March usage</Card.Title>
          </Card.Header>
        </Card.Root>
        <Card.Root>
          <Card.Header>
            <Card.Title level={2}>April usage</Card.Title>
          </Card.Header>
        </Card.Root>
      </>
    );
    const defaultTitle = headingNamed("March usage", 3);
    expect(defaultTitle.tagName).toBe("H3");
    const levelTwo = headingNamed("April usage", 2);
    expect(levelTwo.tagName).toBe("H2");
  });

  it("renders default title type larger than the description", () => {
    renderThemed(
      <Card.Root>
        <Card.Header>
          <Card.Title>March usage</Card.Title>
          <Card.Description>Estimated consumption.</Card.Description>
        </Card.Header>
      </Card.Root>
    );
    const title = headingNamed("March usage", 3);
    const description = textNamed("Estimated consumption.");
    expect(Number.parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(description).fontSize)
    );
  });
});

describe("card sections", () => {
  /** An element's four paddings in px, top, right, bottom, left. */
  function paddings(element: HTMLElement): readonly [number, number, number, number] {
    const style = getComputedStyle(element);
    return [px(style.paddingTop), px(style.paddingRight), px(style.paddingBottom), px(style.paddingLeft)];
  }

  /** An element's four border radii in px, top-left, top-right, bottom-right, bottom-left. */
  function corners(element: HTMLElement): readonly number[] {
    const style = getComputedStyle(element);
    return [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map(px);
  }

  describe("Card.Section", () => {
    it("forms the body under a Card.Header: a divider runs under the header and only the last section rounds", () => {
      renderThemed(
        <Card.Root role="group" aria-label="Order">
          <Card.Header role="group" aria-label="Header">
            <Card.Title>Your order</Card.Title>
          </Card.Header>
          <Card.Section role="group" aria-label="First">
            First
          </Card.Section>
          <Card.Section role="group" aria-label="Last">
            Last
          </Card.Section>
        </Card.Root>
      );
      const corner = RADIUS_LG.neutral - 1;
      const header = roleNamed("group", "Header");
      const first = roleNamed("group", "First");
      expect(px(getComputedStyle(first).borderTopWidth), "divider under the header").toBe(1);
      expect(getComputedStyle(first).borderTopColor).toBe(cssVarColor(first, "--border"));
      expect(corners(first), "first under a header").toEqual([0, 0, 0, 0]);
      expect(corners(roleNamed("group", "Last")), "last").toEqual([0, 0, corner, corner]);
      // The header keeps its tier on every side, and the first section starts right below it.
      const pad = paddings(header)[0];
      expect(pad).toBeGreaterThan(0);
      expect(paddings(header)).toEqual([pad, pad, pad, pad]);
      expect(first.getBoundingClientRect().top).toBe(header.getBoundingClientRect().bottom);
    });

    it.each([
      ["with no type", {}],
      ["with a forwarded undefined type", { type: undefined }],
    ] as const)("does not submit the form it sits in %s", async (_label, typeProps) => {
      let submits = 0;
      renderThemed(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submits += 1;
          }}>
          <Card.Root>
            <Card.SectionButton {...typeProps}>Change plan</Card.SectionButton>
          </Card.Root>
        </form>
      );
      await userEvent.click(roleNamed("button", "Change plan"));
      expect(submits).toBe(0);
    });

    it("keeps a disabled button section unfilled on hover, with the not-allowed cursor", async () => {
      renderThemed(
        <Card.Root>
          <Card.SectionButton disabled>Unavailable</Card.SectionButton>
        </Card.Root>
      );
      const button = roleNamed("button", "Unavailable");
      await userEvent.hover(button);
      settleTransitions(button);
      const style = getComputedStyle(button);
      expect(style.cursor).toBe("not-allowed");
      expect(style.opacity).toBe("0.5");
      expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    });

    it("draws a keyboard focus ring inside a middle button section, so the sections around it cannot cover it", async () => {
      renderThemed(
        <Card.Root>
          <Card.Section>Above</Card.Section>
          <Card.SectionButton>Change plan</Card.SectionButton>
          <Card.Section role="group" aria-label="Below">
            Below
          </Card.Section>
        </Card.Root>
      );
      await userEvent.keyboard("{Tab}");
      const button = roleNamed("button", "Change plan");
      expect(document.activeElement).toBe(button);
      // One inset 2px ring in --ring: drawn inside the section's own border box on all four sides,
      // which the next section, painted after it, does not reach.
      settleTransitions(button);
      expect(ringLayers(button)).toEqual([
        { spread: "2px", color: cssVarColor(button, "--ring"), inset: true },
      ]);
      expect(button.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        roleNamed("group", "Below").getBoundingClientRect().top
      );
    });

    it("renders a link section as a native link with no button type", () => {
      renderThemed(
        <Card.Root>
          <Card.SectionButton render={<a href="#terms" />}>Read the terms</Card.SectionButton>
        </Card.Root>
      );
      const link = roleNamed("link", "Read the terms");
      expect(link.getAttribute("href")).toBe("#terms");
      expect(link.hasAttribute("type")).toBe(false);
      expect(getComputedStyle(link).cursor).toBe("pointer");
      expect(getComputedStyle(link).display).toBe("block");
      expect(getComputedStyle(link).textDecorationLine).toBe("none");
    });

    describe("an aria-disabled link section", () => {
      // A link takes no native `disabled`, so a link section announced unavailable cancels its
      // own activation.
      resetHashAroundEach();

      it("neither follows the link nor runs its onClick", async () => {
        const clicks: string[] = [];
        renderThemed(
          <Card.Root>
            <Card.SectionButton
              render={<a href="#terms" aria-disabled="true" />}
              onClick={() => clicks.push("terms")}>
              Read the terms
            </Card.SectionButton>
          </Card.Root>
        );

        await expectActivationCancelled(roleNamed("link", "Read the terms"), clicks);
      });

      it("dims with the not-allowed cursor and stays unfilled on hover", async () => {
        renderThemed(
          <Card.Root>
            <Card.SectionButton render={<a href="#terms" aria-disabled="true" />}>
              Read the terms
            </Card.SectionButton>
          </Card.Root>
        );
        const link = roleNamed("link", "Read the terms");
        await userEvent.hover(link);
        settleTransitions(link);
        const style = getComputedStyle(link);
        expect(style.opacity).toBe("0.5");
        expect(style.cursor).toBe("not-allowed");
        expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
      });

      it("follows the link and runs its onClick once aria-disabled is false", async () => {
        const clicks: string[] = [];
        renderThemed(
          <Card.Root>
            <Card.SectionButton
              render={<a href="#terms" aria-disabled="false" />}
              onClick={() => clicks.push("terms")}>
              Read the terms
            </Card.SectionButton>
          </Card.Root>
        );

        await userEvent.click(roleNamed("link", "Read the terms"));
        expect(location.hash).toBe("#terms");
        expect(clicks).toEqual(["terms"]);
      });
    });
  });
});
