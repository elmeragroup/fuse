import { useState } from "react";
import type { ReactElement } from "react";

import { DirectionProvider } from "@base-ui/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { expectFocusRing, focusRingClippers } from "../../../test/assert-focus-ring";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { assertNoAxeViolations } from "../../../test/axe";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import {
  cssVarColor,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Button } from "../button/button";
import { Dialog } from "../dialog";
import { DropdownMenu } from "../dropdown-menu";
import type { AttachmentRootProps } from "./attachment";
import { Attachment } from "./index";

/** A 4×3 picture, so a square or ratio frame shows it was the frame, not the image, that sized it. */
const PICTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'/%3E";

/** Chromium's computed value for a transparent text fill. */
const TRANSPARENT = "rgba(0, 0, 0, 0)";

/** The root around a title. It carries `data-state`, which every root writes. */
function rootOf(title: string): HTMLElement {
  const root = textNamed(title).closest("[data-state]");
  if (!(root instanceof HTMLElement)) {
    throw new Error(`expected an attachment root around ${title}`);
  }
  return root;
}

/** The scrolling viewport around a group's list, which is the list's parent. */
function viewportOf(list: HTMLElement): HTMLElement {
  const viewport = list.parentElement;
  if (viewport === null) {
    throw new Error("expected a viewport around the list");
  }
  return viewport;
}

/** A root titled `name`, with `children` after its content. */
function FileRow({ name, children, ...props }: AttachmentRootProps & { name: string }): ReactElement {
  return (
    <Attachment.Root {...props}>
      <Attachment.Content>
        <Attachment.Title>{name}</Attachment.Title>
      </Attachment.Content>
      {children}
    </Attachment.Root>
  );
}

/** A previewable file with a remove action: the trigger opens a dialog, the action removes it. */
function PreviewableFile(): ReactElement {
  const [removed, setRemoved] = useState(false);
  if (removed) {
    return <p>report.pdf removed</p>;
  }
  return (
    <Dialog.Root>
      <Attachment.Root>
        <Attachment.Content>
          <Attachment.Title>report.pdf</Attachment.Title>
          <Attachment.Description>PDF · 2.4 MB</Attachment.Description>
        </Attachment.Content>
        <Dialog.Trigger render={<Attachment.Trigger aria-label="Preview report.pdf" />} />
        <Attachment.Actions>
          <Attachment.Action
            aria-label="Remove report.pdf"
            onClick={() => {
              setRemoved(true);
            }}>
            ×
          </Attachment.Action>
        </Attachment.Actions>
      </Attachment.Root>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Title>Preview of report.pdf</Dialog.Title>
      </Dialog.Content>
    </Dialog.Root>
  );
}

describe("Attachment.Group", () => {
  it("exposes a named list whose items are the attachments", async () => {
    const { host } = renderThemed(
      <>
        <Attachment.Group aria-label="Attached files">
          <FileRow name="invoice.pdf" />
          <FileRow name="meter.jpg" />
        </Attachment.Group>
        <FileRow name="loose.txt" />
      </>
    );
    const list = roleNamed("list", "Attached files");
    const items = page.getByRole("list").getByRole("listitem").elements();
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.textContent)).toEqual(["invoice.pdf", "meter.jpg"]);
    expect(items.every((item) => item.parentElement === list)).toBe(true);
    expect(rootOf("loose.txt").getAttribute("role")).toBeNull();
    await assertNoAxeViolations(host);
  });

  it("paints a tile's keyboard focus ring whole inside the scrolling list", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <Attachment.Group aria-label="Attached files">
          <FileRow name="plan.pdf">
            <Attachment.Trigger aria-label="Open plan.pdf" render={<a href="#plan" />} />
          </FileRow>
        </Attachment.Group>
      </>
    );
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    const trigger = roleNamed("link", "Open plan.pdf");
    expect(document.activeElement).toBe(trigger);
    expectFocusRing(trigger, "a keyboard-focused trigger paints the shared ring");
    expect(focusRingClippers(trigger)).toEqual([]);
  });
});

describe("Attachment.Trigger and Attachment.Actions", () => {
  it("opens a dialog from the trigger", async () => {
    renderThemed(<PreviewableFile />);
    const trigger = roleNamed("button", "Preview report.pdf");
    expect(trigger.getAttribute("type")).toBe("button");
    await userEvent.click(trigger);
    await vi.waitFor(() => {
      expect(roleNamed("dialog", "Preview of report.pdf")).toBeInstanceOf(HTMLElement);
    });
  });

  it("runs an action above the trigger without opening the dialog", async () => {
    renderThemed(<PreviewableFile />);
    await userEvent.click(roleNamed("button", "Remove report.pdf"));
    expect(textNamed("report.pdf removed")).toBeInstanceOf(HTMLElement);
    expect(page.getByRole("dialog").query()).toBeNull();
  });

  it("puts the trigger before the actions in tab order", async () => {
    renderThemed(
      <>
        <button type="button">Before</button>
        <PreviewableFile />
      </>
    );
    roleNamed("button", "Before").focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Preview report.pdf"));
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement).toBe(roleNamed("button", "Remove report.pdf"));
  });

  it("fills on hover only while its trigger is enabled, and shows a disabled trigger's cursor", async () => {
    renderThemed(
      <>
        <FileRow name="open.pdf">
          <Attachment.Trigger aria-label="Open open.pdf" />
        </FileRow>
        <FileRow name="locked.pdf">
          <Attachment.Trigger aria-label="Open locked.pdf" disabled />
        </FileRow>
        <FileRow name="gone.pdf">
          <Attachment.Trigger aria-label="Open gone.pdf" aria-disabled="true" render={<a href="#gone" />} />
        </FileRow>
      </>
    );
    const card = cssVarColor(rootOf("open.pdf"), "--card");
    const muted = cssVarColor(rootOf("open.pdf"), "--muted");
    const hovered = async (title: string, trigger: HTMLElement): Promise<string> => {
      await userEvent.hover(trigger);
      settleTransitions(rootOf(title));
      return getComputedStyle(rootOf(title)).backgroundColor;
    };
    expect(await hovered("open.pdf", roleNamed("button", "Open open.pdf"))).toBe(muted);
    expect(await hovered("locked.pdf", roleNamed("button", "Open locked.pdf"))).toBe(card);
    expect(await hovered("gone.pdf", roleNamed("link", "Open gone.pdf"))).toBe(card);
    expect(getComputedStyle(roleNamed("button", "Open locked.pdf")).cursor).toBe("not-allowed");
    expect(getComputedStyle(roleNamed("link", "Open gone.pdf")).cursor).toBe("not-allowed");
  });

  it("paints no native button face over the attachment in a host without preflight", () => {
    renderThemed(<PreviewableFile />);
    const trigger = roleNamed("button", "Preview report.pdf");
    const style = getComputedStyle(trigger);
    expect(style.backgroundColor).toBe(TRANSPARENT);
    for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
      expect(style[`border${side}Width`], `border ${side}`).toBe("0px");
      expect(style[`padding${side}`], `padding ${side}`).toBe("0px");
    }
    // Inherited type and colour equal the root's computed values.
    const root = getComputedStyle(rootOf("report.pdf"));
    for (const property of ["color", "fontFamily", "fontSize", "fontWeight", "lineHeight"] as const) {
      expect(style[property], property).toBe(root[property]);
    }
  });
});

describe("Attachment.Action", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
  });

  it("is secondary on a vertical tile and ghost in a row, unless the consumer picks a variant", async () => {
    // Unit under test: the variant Attachment.Action picks. Oracle: the paint of a plain Button
    // of that variant, which the action forwards to.
    renderThemed(
      <>
        <Button aria-label="Secondary button" variant="secondary" size="icon-xs">
          ×
        </Button>
        <Button aria-label="Ghost button" variant="ghost" size="icon-xs">
          ×
        </Button>
        <Attachment.Root orientation="vertical">
          <Attachment.Media variant="image">
            <img src={PICTURE} alt="Tile" />
          </Attachment.Media>
          <Attachment.Actions>
            <Attachment.Action aria-label="Remove tile">×</Attachment.Action>
            <Attachment.Action aria-label="Ghost on tile" variant="ghost">
              ×
            </Attachment.Action>
          </Attachment.Actions>
        </Attachment.Root>
        <FileRow name="row.pdf">
          <Attachment.Actions>
            <Attachment.Action aria-label="Remove row">×</Attachment.Action>
            <Attachment.Action aria-label="Secondary in row" variant="secondary">
              ×
            </Attachment.Action>
          </Attachment.Actions>
        </FileRow>
      </>
    );
    // Park the pointer on a row without a trigger and let any hover fill fade, so no button
    // shows one.
    await userEvent.hover(textNamed("row.pdf"));
    const paint = (name: string): readonly [string, string] => {
      const button = roleNamed("button", name);
      settleTransitions(button);
      const style = getComputedStyle(button);
      return [style.backgroundColor, style.color];
    };
    const secondary = paint("Secondary button");
    const ghost = paint("Ghost button");
    expect(secondary).not.toEqual(ghost);
    // A ghost Button sets its text in the colour around it, so a ghost action's oracle is the plain
    // ghost Button's fill with the colour of the box the action sits in.
    const ghostIn = (name: string): readonly [string, string] => {
      const box = roleNamed("button", name).parentElement;
      if (box === null) {
        throw new Error(`Expected ${name} to sit in a box`);
      }
      return [ghost[0], getComputedStyle(box).color];
    };
    expect(paint("Remove tile")).toEqual(secondary);
    expect(paint("Ghost on tile")).toEqual(ghostIn("Ghost on tile"));
    expect(paint("Remove row")).toEqual(ghostIn("Remove row"));
    expect(paint("Secondary in row")).toEqual(secondary);
  });

  it.each([
    { size: "default", rowMedia: 40 },
    { size: "sm", rowMedia: 32 },
    { size: "xs", rowMedia: 28 },
  ] as const)(
    "spans a $size tile's media across the tile, with two actions in half of it, and keeps a $rowMedia px row media, at both densities",
    ({ size, rowMedia }) => {
      for (const density of DENSITIES) {
        stampDensity(density);
        const { unmount } = renderThemed(
          <>
            <Attachment.Root orientation="vertical" size={size}>
              <Attachment.Media variant="image">
                <img src={PICTURE} alt="Tile photo" />
              </Attachment.Media>
              <Attachment.Content>
                <Attachment.Title>photo.png</Attachment.Title>
              </Attachment.Content>
              <Attachment.Actions>
                <Attachment.Action aria-label="Download photo.png">↓</Attachment.Action>
                <Attachment.Action aria-label="Remove photo.png">×</Attachment.Action>
              </Attachment.Actions>
            </Attachment.Root>
            <Attachment.Root size={size}>
              <Attachment.Media variant="image">
                <img src={PICTURE} alt="Row photo" />
              </Attachment.Media>
            </Attachment.Root>
            <Attachment.Root orientation="vertical" size={size}>
              <Attachment.Media>
                <svg role="img" aria-label="Tile glyph" viewBox="0 0 16 16" />
              </Attachment.Media>
            </Attachment.Root>
          </>
        );
        const label = `${size} ${density}`;
        // An SVG is no HTMLElement, so the shared role helper does not return it.
        const glyph = page.getByRole("img", { name: "Tile glyph", exact: true }).element();
        expect(glyph.getBoundingClientRect().width, `${label} tile glyph`).toBe(24);
        const tileMedia = roleNamed("img", "Tile photo").parentElement;
        const rowMediaBox = roleNamed("img", "Row photo").parentElement?.getBoundingClientRect();
        const tile = tileMedia?.parentElement;
        if (!tileMedia || !tile || rowMediaBox === undefined) {
          throw new Error("expected media in a tile and in a row");
        }
        const tileStyle = getComputedStyle(tile);
        const contentBox = tile.clientWidth - px(tileStyle.paddingLeft) - px(tileStyle.paddingRight);
        const media = tileMedia.getBoundingClientRect();
        expect(media.width, `${label} tile media`).toBe(contentBox);
        // 8.5rem at the 16px root, at every size and density.
        expect(media.width, `${label} tile media width`).toBe(136);
        const first = roleNamed("button", "Download photo.png").getBoundingClientRect();
        const last = roleNamed("button", "Remove photo.png").getBoundingClientRect();
        expect(last.right - first.left, `${label} actions`).toBeLessThanOrEqual(media.width / 2);
        expect(rowMediaBox.width, `${label} row media`).toBe(rowMedia);
        unmount();
      }
    }
  );

  it("fits a full-width row to its container, padding and border included, at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderThemed(
        <div style={{ width: "300px" }}>
          <FileRow name="wide.pdf" className="w-full" />
        </div>
      );
      expect(rootOf("wide.pdf").getBoundingClientRect().width, density).toBe(300);
      unmount();
    }
  });

  it("keeps a 24px target at both densities", () => {
    for (const density of DENSITIES) {
      stampDensity(density);
      const { unmount } = renderThemed(
        <FileRow name="small.pdf" size="xs">
          <Attachment.Actions>
            <Attachment.Action aria-label="Remove small.pdf">×</Attachment.Action>
          </Attachment.Actions>
        </FileRow>
      );
      const box = roleNamed("button", "Remove small.pdf").getBoundingClientRect();
      expect(box.width, `${density} width`).toBeGreaterThanOrEqual(24);
      expect(box.height, `${density} height`).toBeGreaterThanOrEqual(24);
      unmount();
    }
  });
});

describe("Attachment hidden", () => {
  it("hides the root, the group and every part that sets a display, but leaves until-found to the browser", () => {
    const { host } = renderThemed(
      <>
        <Attachment.Root hidden>
          <Attachment.Content>
            <Attachment.Title>hidden-root.pdf</Attachment.Title>
          </Attachment.Content>
        </Attachment.Root>
        <Attachment.Group hidden aria-label="Hidden group" />
        <Attachment.Root>
          <Attachment.Media hidden />
          <Attachment.Content hidden />
          <Attachment.Content>
            <Attachment.Title hidden>hidden-title.pdf</Attachment.Title>
            <Attachment.Description hidden>Hidden description</Attachment.Description>
            <Attachment.Title>found.pdf</Attachment.Title>
          </Attachment.Content>
          <Attachment.Actions hidden />
        </Attachment.Root>
      </>
    );
    // DOM audit: a hidden element has no accessible role or name, so each one is found by its slot.
    const hiddenParts = [...host.querySelectorAll("[hidden]")];
    expect(
      hiddenParts
        .map((element) => element.getAttribute("data-slot") ?? "")
        .toSorted((left, right) => left.localeCompare(right))
    ).toEqual([
      "attachment",
      "attachment-actions",
      "attachment-content",
      "attachment-description",
      "attachment-group",
      "attachment-media",
      "attachment-title",
    ]);
    for (const element of hiddenParts) {
      expect(getComputedStyle(element).display, element.getAttribute("data-slot") ?? "").toBe("none");
    }
    // React types `hidden` as a boolean, so the until-found value goes on as an attribute.
    const found = textNamed("found.pdf");
    found.setAttribute("hidden", "until-found");
    expect(getComputedStyle(found).display).toBe("block");
  });
});

describe("Attachment.Root in a menu", () => {
  it("keeps an xs attachment's row padding inside DropdownMenu.Content", async () => {
    renderThemed(
      <DropdownMenu.Root defaultOpen>
        <DropdownMenu.Trigger>Files</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <FileRow name="menu.pdf" size="xs" />
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    );
    await expect.element(page.getByText("menu.pdf", { exact: true })).toBeInTheDocument();
    // Dense row metrics at the 16px root: --row-px is 0.5rem and --row-py is 0.375rem.
    const style = getComputedStyle(rootOf("menu.pdf"));
    expect([style.paddingLeft, style.paddingRight]).toEqual(["8px", "8px"]);
    expect([style.paddingTop, style.paddingBottom]).toEqual(["6px", "6px"]);
  });
});

describe("Attachment state", () => {
  afterEach(async () => {
    await emulateReducedMotion("no-preference");
  });

  it("writes data-state from the prop, done by default", () => {
    const states = ["idle", "uploading", "processing", "error", "done"] as const;
    const { rerender } = renderThemed(<FileRow name="file.pdf" />);
    expect(rootOf("file.pdf").getAttribute("data-state")).toBe("done");
    for (const state of states) {
      rerender(<FileRow name="file.pdf" state={state} />);
      expect(rootOf("file.pdf").getAttribute("data-state")).toBe(state);
    }
  });

  it("dashes an idle border and tints a failed description with the error role", () => {
    renderThemed(
      <>
        <FileRow name="draft.pdf" />
        <FileRow name="empty.pdf" state="idle" />
        <Attachment.Root state="error">
          <Attachment.Content>
            <Attachment.Title>broken.pdf</Attachment.Title>
            <Attachment.Description>Upload failed</Attachment.Description>
          </Attachment.Content>
        </Attachment.Root>
      </>
    );
    expect(getComputedStyle(rootOf("draft.pdf")).borderTopStyle).toBe("solid");
    expect(getComputedStyle(rootOf("empty.pdf")).borderTopStyle).toBe("dashed");
    const description = textNamed("Upload failed");
    expect(getComputedStyle(description).color).toBe(cssVarColor(description, "--error"));
  });

  it.each(["uploading", "processing"] as const)("sweeps the title while %s", (state) => {
    renderThemed(<FileRow name="busy.pdf" state={state} />);
    const title = textNamed("busy.pdf");
    expect(title.getAnimations()).toHaveLength(1);
    expect(getComputedStyle(title).webkitTextFillColor).toBe(TRANSPARENT);
  });

  it("keeps a finished title as plain text", () => {
    renderThemed(<FileRow name="done.pdf" />);
    const title = textNamed("done.pdf");
    expect(title.getAnimations()).toEqual([]);
    expect(getComputedStyle(title).webkitTextFillColor).toBe(getComputedStyle(title).color);
  });

  it("renders an uploading title as solid, still text under reduced motion", async () => {
    await emulateReducedMotion("reduce");
    renderThemed(<FileRow name="still.pdf" state="uploading" />);
    const title = textNamed("still.pdf");
    expect(title.getAnimations()).toEqual([]);
    expect(getComputedStyle(title).animationName).toBe("none");
    expect(getComputedStyle(title).backgroundImage).toBe("none");
    expect(getComputedStyle(title).webkitTextFillColor).toBe(getComputedStyle(title).color);
  });
});

describe("Attachment in right-to-left text", () => {
  /** Four 160px rows in a 200px group, so the list overflows by far more than the fade. */
  function OverflowingGroup({ dir }: { dir: "ltr" | "rtl" }): ReactElement {
    return (
      <DirectionProvider direction={dir}>
        <div dir={dir} style={{ width: "200px" }}>
          <Attachment.Group aria-label={`Files ${dir}`}>
            {["a.pdf", "b.pdf", "c.pdf", "d.pdf"].map((name) => (
              <FileRow key={name} name={`${name} ${dir}`} />
            ))}
          </Attachment.Group>
        </div>
      </DirectionProvider>
    );
  }

  it.each([
    { dir: "ltr", toward: "to right" },
    { dir: "rtl", toward: "to left" },
  ] as const)(
    "fades only the $dir group's end edge until it scrolls, then only its start",
    async ({ dir, toward }) => {
      renderThemed(<OverflowingGroup dir={dir} />);
      const viewport = viewportOf(roleNamed("list", `Files ${dir}`));
      await vi.waitFor(() => {
        expect(getComputedStyle(viewport).maskImage).toBe(
          `linear-gradient(${toward}, rgba(0, 0, 0, 0) 0px, rgb(0, 0, 0) 0px, rgb(0, 0, 0) calc(100% - 40px), rgba(0, 0, 0, 0) 100%)`
        );
      });
      // Scroll to the inline end: positive in LTR, negative in RTL.
      viewport.scrollLeft = (dir === "ltr" ? 1 : -1) * viewport.scrollWidth;
      await vi.waitFor(() => {
        expect(getComputedStyle(viewport).maskImage).toBe(
          `linear-gradient(${toward}, rgba(0, 0, 0, 0) 0px, rgb(0, 0, 0) 40px, rgb(0, 0, 0) 100%, rgba(0, 0, 0, 0) 100%)`
        );
      });
    }
  );

  it.each(["ltr", "rtl"] as const)(
    "floats a vertical tile's actions 4px inside the media's top %s end corner",
    (dir) => {
      renderThemed(
        <div dir={dir}>
          <Attachment.Root orientation="vertical">
            <Attachment.Media variant="image">
              <img src={PICTURE} alt={`Photo ${dir}`} />
            </Attachment.Media>
            <Attachment.Actions>
              <Attachment.Action aria-label={`Remove ${dir}`}>×</Attachment.Action>
            </Attachment.Actions>
          </Attachment.Root>
        </div>
      );
      const media = roleNamed("img", `Photo ${dir}`).parentElement?.getBoundingClientRect();
      const action = roleNamed("button", `Remove ${dir}`).getBoundingClientRect();
      if (media === undefined) {
        throw new Error("expected media around the photo");
      }
      expect(action.top - media.top).toBe(4);
      const endGap = dir === "ltr" ? media.right - action.right : action.left - media.left;
      expect(endGap).toBe(4);
    }
  );
});

describe("Attachment.Media", () => {
  function Tile({ alt, ratio }: { alt: string; ratio?: "3:4" | "16:9" }): ReactElement {
    const image = <img className="size-full object-cover" src={PICTURE} alt={alt} />;
    return (
      <Attachment.Root orientation="vertical" style={{ width: "150px" }}>
        <Attachment.Media variant="image">
          {ratio === undefined ? (
            image
          ) : (
            <Attachment.AspectRatio ratio={ratio}>{image}</Attachment.AspectRatio>
          )}
        </Attachment.Media>
      </Attachment.Root>
    );
  }

  function mediaBox(alt: string): DOMRect {
    // The image sits directly in the media, or in an AspectRatio inside it.
    const image = roleNamed("img", alt);
    const media = image.parentElement?.closest("[data-variant=image]");
    if (!(media instanceof HTMLElement)) {
      throw new Error(`expected image media around ${alt}`);
    }
    return media.getBoundingClientRect();
  }

  it("frames an image in a square", () => {
    renderThemed(<Tile alt="Square" />);
    const box = mediaBox("Square");
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBe(box.width);
  });

  it.each([
    { ratio: "3:4", heightPerWidth: 4 / 3 },
    { ratio: "16:9", heightPerWidth: 9 / 16 },
  ] as const)("takes the $ratio of an AspectRatio inside it", ({ ratio, heightPerWidth }) => {
    renderThemed(<Tile alt={ratio} ratio={ratio} />);
    const box = mediaBox(ratio);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeCloseTo(box.width * heightPerWidth, 0);
    expect(px(getComputedStyle(roleNamed("img", ratio)).width)).toBeCloseTo(box.width, 0);
  });
});
