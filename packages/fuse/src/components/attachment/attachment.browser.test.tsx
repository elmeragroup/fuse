import { useState } from "react";
import type { ReactElement } from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { assertNoAxeViolations } from "../../../test/axe";
import { withForcedColors } from "../../../test/media-emulation";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { expectTokenColor, pixelsAt } from "../../../test/screenshot-pixels";
import type { Point } from "../../../test/screenshot-pixels";
import { expectTargetBoxes } from "../../../test/target-size";
import {
  cssVarColor,
  px,
  renderThemed,
  roleNamed,
  stampDensity,
  textNamed,
} from "../../../test/themed-browser-render";
import { DENSITIES } from "../../theme/density";
import { Dialog } from "../dialog";
import type { AttachmentRootProps } from "./attachment";
import { Attachment } from "./index";

/** A 4 by 3 picture, so a square or ratio frame shows it was the frame, not the image, that sized it. */
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

  /**
   * Four 160px previewable rows in a 200px group, flush inside a parent that clips, so the list
   * overflows and any focus ring drawn outside the group's edge is cut off.
   */
  function ClippedGroup(): ReactElement {
    return (
      <>
        <button type="button">Before the group</button>
        <div style={{ width: "200px", overflow: "hidden" }}>
          <Attachment.Group aria-label="Clipped files">
            {["a.pdf", "b.pdf", "c.pdf", "d.pdf"].map((name) => (
              <FileRow key={name} name={name}>
                <Attachment.Trigger aria-label={`Preview ${name}`} />
              </FileRow>
            ))}
          </Attachment.Group>
        </div>
      </>
    );
  }

  /** The group root around its list, the element the parent clips to. */
  function groupOf(list: HTMLElement): HTMLElement {
    // The group root has no role; locate it by the mandated data-slot.
    const group = list.closest("[data-slot=attachment-group]");
    if (!(group instanceof HTMLElement)) {
      throw new Error("expected a group around the list");
    }
    return group;
  }

  type Points = Readonly<Record<string, Point>>;

  /** The outer two pixels of each of the group's four edges, halfway along that edge. */
  function edgePoints(group: HTMLElement) {
    const width = group.clientWidth;
    const height = group.clientHeight;
    const column = Math.round(width / 2);
    const row = Math.round(height / 2);
    return {
      top0: [column, 0],
      top1: [column, 1],
      bottom1: [column, height - 2],
      bottom0: [column, height - 1],
      left0: [0, row],
      left1: [1, row],
      right1: [width - 2, row],
      right0: [width - 1, row],
    } satisfies Points;
  }

  /** The colors of one screenshot of the group at each named point. */
  async function sample(group: HTMLElement, points: Points): Promise<Record<string, number[]>> {
    const pixels = await pixelsAt(group, Object.values(points));
    return Object.fromEntries(Object.keys(points).map((name, index) => [name, pixels[index] ?? []]));
  }

  describe.each(["none", "active"] as const)("with forced colors %s", (forcedColors) => {
    it("draws the keyboard focus outline on all four edges inside a parent that clips", async () => {
      await withForcedColors(forcedColors, async () => {
        renderThemed(<ClippedGroup />);
        const list = roleNamed("list", "Clipped files");
        const viewport = viewportOf(list);
        const group = groupOf(list);
        await expect.poll(() => viewport.hasAttribute("data-has-overflow-x")).toBe(true);
        roleNamed("button", "Before the group").focus();
        const before = await sample(group, edgePoints(group));
        await userEvent.tab();
        expect(document.activeElement).toBe(viewport);
        expect(viewport.matches(":focus-visible")).toBe(true);
        const after = await sample(group, edgePoints(group));
        for (const [edge, pixel] of Object.entries(after)) {
          expect(pixel, `${edge} after focus`).not.toEqual(before[edge]);
          if (forcedColors === "none") {
            expectTokenColor(pixel, group, "--ring", `${edge} after focus`);
          }
        }
      });
    });
  });

  it("paints a focused tile's own ring inside the list and leaves the group's edge unpainted", async () => {
    renderThemed(<ClippedGroup />);
    const list = roleNamed("list", "Clipped files");
    const group = groupOf(list);
    await expect.poll(() => viewportOf(list).hasAttribute("data-has-overflow-x")).toBe(true);
    roleNamed("button", "Before the group").focus();
    const edges = edgePoints(group);
    const before = await sample(group, edges);
    await userEvent.tab();
    await userEvent.tab();
    const trigger = roleNamed("button", "Preview a.pdf");
    expect(document.activeElement).toBe(trigger);
    // The ring is a 2px shadow around the trigger's box; sample both of its columns at the start side.
    const box = trigger.getBoundingClientRect();
    const origin = group.getBoundingClientRect();
    const row = Math.round(box.top - origin.top + box.height / 2);
    const start = Math.round(box.left - origin.left);
    const { ringOuter, ringInner, ...after } = await sample(group, {
      ...edges,
      ringOuter: [start - 2, row],
      ringInner: [start - 1, row],
    });
    expect(after).toEqual(before);
    expectTokenColor(ringOuter ?? [], group, "--ring", "ring outer column");
    expectTokenColor(ringInner ?? [], group, "--ring", "ring inner column");
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
});

describe("Attachment.Action", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-density");
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
      expectTargetBoxes([roleNamed("button", "Remove small.pdf")], density);
      unmount();
    }
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
    // A hidden element has no accessible role or name, so each one is found by its slot.
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
