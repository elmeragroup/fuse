import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { HOSTS, centreY, firstLineCentreY, hostCss } from "../../../test/first-line";
import type { Host } from "../../../test/first-line";
import { renderThemed, roleNamed, stampDensity, textNamed } from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Button } from "../button/button";
import { Item } from "./index";

const ITEM_SIZES = ["default", "sm", "xs"] as const;

/** A glyph of a given square size, named so a test finds it by role. */
function Glyph({ size }: { size: number }) {
  return <svg role="img" aria-label="Spike" viewBox="0 0 16 16" style={{ width: size, height: size }} />;
}

function glyphCentreY(): number {
  return centreY(page.getByRole("img", { name: "Spike", exact: true }).element());
}

/** Wraps in the 240px column, so the row grows well past the title's line. */
const WRAPPING_DESCRIPTION = "Consumption doubled overnight across every metering point.";

/** Stays on one line, so tall media is taller than the content. */
const SHORT_DESCRIPTION = "Doubled.";

/** Media beside a title and an optional description, in a 240px column. */
function MediaRow({
  host,
  size,
  media,
  description,
  actions,
}: {
  host: Host;
  size: (typeof ITEM_SIZES)[number];
  media: ReactNode;
  description: string | null;
  actions?: ReactNode;
}) {
  return (
    <div style={{ width: "240px" }}>
      <style>{hostCss(host)}</style>
      <Item.Root size={size} variant="outline">
        {media}
        <Item.Content>
          <Item.Title>Usage spike</Item.Title>
          {description === null ? null : <Item.Description>{description}</Item.Description>}
        </Item.Content>
        {actions}
      </Item.Root>
    </div>
  );
}

/** The element's parent, which a media child or a title has by construction. */
function parentOf(element: Element): HTMLElement {
  const parent = element.parentElement;
  if (parent === null) {
    throw new Error("expected a parent element");
  }
  return parent;
}

describe("Item media alignment", () => {
  // Icon media centres a glyph of any size on the title's first line beside a description.
  const iconGlyphs = [16, 20, 24] as const;
  // Without a description the row centres any media on the title's line.
  const titleOnlyGlyphs = [
    { media: "icon", glyph: 16 },
    { media: "icon", glyph: 24 },
    { media: "default", glyph: 16 },
  ] as const;

  describe.each(HOSTS)("in a %s host", (host) => {
    it.each(iconGlyphs)(
      "centres a %i px glyph in icon media on the title's first line beside a description",
      (glyph) => {
        for (const density of DENSITIES) {
          stampDensity(density);
          for (const size of ITEM_SIZES) {
            const { unmount } = renderThemed(
              <MediaRow
                host={host}
                size={size}
                description={WRAPPING_DESCRIPTION}
                media={
                  <Item.Media variant="icon">
                    <Glyph size={glyph} />
                  </Item.Media>
                }
              />
            );
            const line = firstLineCentreY(textNamed("Usage spike"));
            expect(Math.abs(glyphCentreY() - line), `${size} at ${density}`).toBeLessThanOrEqual(0.5);
            unmount();
          }
        }
      }
    );

    it.each(titleOnlyGlyphs)(
      "centres a $glyph px glyph in $media media on a title-only row's line",
      ({ media, glyph }) => {
        for (const size of ITEM_SIZES) {
          const { unmount } = renderThemed(
            <MediaRow
              host={host}
              size={size}
              description={null}
              media={
                <Item.Media variant={media}>
                  <Glyph size={glyph} />
                </Item.Media>
              }
            />
          );
          const line = firstLineCentreY(textNamed("Usage spike"));
          expect(Math.abs(glyphCentreY() - line), size).toBeLessThanOrEqual(0.5);
          unmount();
        }
      }
    );

    it("tops image media flush with the content beside a description", () => {
      for (const size of ITEM_SIZES) {
        const { unmount } = renderThemed(
          <MediaRow
            host={host}
            size={size}
            description={WRAPPING_DESCRIPTION}
            media={
              <Item.Media variant="image">
                <img alt="Meter" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
              </Item.Media>
            }
          />
        );
        const image = roleNamed("img", "Meter").parentElement;
        const content = textNamed("Usage spike").parentElement;
        if (image === null || content === null) {
          throw new Error("expected the image media and the content column");
        }
        expect(image.getBoundingClientRect().top - content.getBoundingClientRect().top, size).toBeCloseTo(
          0,
          2
        );
        unmount();
      }
    });

    it.each([
      { media: "default", className: "size-10", px: 40 },
      { media: "icon", className: "size-10", px: 40 },
      { media: "default", className: "size-4", px: 16 },
      { media: "icon", className: "size-4", px: 16 },
    ] as const)(
      "lets $className on $media media beside a description set its box",
      ({ media, className, px }) => {
        for (const density of DENSITIES) {
          stampDensity(density);
          const { unmount } = renderThemed(
            <MediaRow
              host={host}
              size="default"
              description={SHORT_DESCRIPTION}
              media={
                <Item.Media variant={media} className={className}>
                  <Glyph size={12} />
                </Item.Media>
              }
            />
          );
          const box = parentOf(
            page.getByRole("img", { name: "Spike", exact: true }).element()
          ).getBoundingClientRect();
          // Tailwind's spacing step is 0.25rem, 4px at the default 16px root: `size-10` is 40px, `size-4` 16px.
          expect([box.width, box.height], density).toEqual([px, px]);
          unmount();
        }
      }
    );

    it("tops a glyph in default media flush with the content beside a description", () => {
      for (const density of DENSITIES) {
        stampDensity(density);
        for (const size of ITEM_SIZES) {
          const { unmount } = renderThemed(
            <MediaRow
              host={host}
              size={size}
              description={WRAPPING_DESCRIPTION}
              media={
                <Item.Media>
                  <Glyph size={16} />
                </Item.Media>
              }
            />
          );
          const glyph = page
            .getByRole("img", { name: "Spike", exact: true })
            .element()
            .getBoundingClientRect();
          const content = parentOf(textNamed("Usage spike")).getBoundingClientRect();
          expect(glyph.top - content.top, `${size} at ${density}`).toBeCloseTo(0, 2);
          unmount();
        }
      }
    });

    it.each([
      { size: "xs", px: 40 },
      { size: "default", px: 64 },
    ] as const)(
      "tops $px px default media and the content together inside a $size row beside a one-line description",
      ({ size, px }) => {
        for (const density of DENSITIES) {
          stampDensity(density);
          const { unmount } = renderThemed(
            <MediaRow
              host={host}
              size={size}
              description={SHORT_DESCRIPTION}
              media={
                <Item.Media>
                  <div role="img" aria-label="Avatar" style={{ width: `${px}px`, height: `${px}px` }} />
                </Item.Media>
              }
            />
          );
          const avatar = roleNamed("img", "Avatar").getBoundingClientRect();
          const content = parentOf(textNamed("Usage spike"));
          const contentBox = content.getBoundingClientRect();
          const rowBox = parentOf(content).getBoundingClientRect();
          // The fixture reaches the case it names only while the media outgrows the content.
          expect(contentBox.height, `${size} at ${density}`).toBeLessThan(px);
          expect(avatar.top - contentBox.top, `${size} at ${density}`).toBeCloseTo(0, 2);
          expect(contentBox.top, `${size} at ${density}`).toBeGreaterThanOrEqual(rowBox.top);
          expect(contentBox.bottom, `${size} at ${density}`).toBeLessThanOrEqual(rowBox.bottom);
          unmount();
        }
      }
    );

    it("keeps Item.Actions centred on the row beside a description", () => {
      for (const density of DENSITIES) {
        stampDensity(density);
        const { unmount } = renderThemed(
          <MediaRow
            host={host}
            size="default"
            description={SHORT_DESCRIPTION}
            media={
              <Item.Media>
                <div role="img" aria-label="Avatar" style={{ width: "64px", height: "64px" }} />
              </Item.Media>
            }
            actions={
              <Item.Actions>
                <Button size="sm">Open</Button>
              </Item.Actions>
            }
          />
        );
        const row = parentOf(parentOf(textNamed("Usage spike")));
        expect(Math.abs(centreY(roleNamed("button", "Open")) - centreY(row)), density).toBeLessThanOrEqual(
          0.5
        );
        unmount();
      }
    });

    it("spaces the description from the title by the content gap and ends the content with it", () => {
      // The content column's gap: 0.25rem, 4px at the default 16px root, and none at `xs`.
      const contentGap = { default: 4, sm: 4, xs: 0 } as const;
      for (const size of ITEM_SIZES) {
        const { unmount } = renderThemed(
          <MediaRow host={host} size={size} description={WRAPPING_DESCRIPTION} media={null} />
        );
        const title = textNamed("Usage spike");
        const description = textNamed(WRAPPING_DESCRIPTION);
        const content = title.parentElement;
        if (content === null) {
          throw new Error("expected the content column");
        }
        const gap = description.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
        expect(gap, size).toBeCloseTo(contentGap[size], 2);
        expect(
          content.getBoundingClientRect().bottom - description.getBoundingClientRect().bottom,
          size
        ).toBeCloseTo(0, 2);
        unmount();
      }
    });
  });
});
