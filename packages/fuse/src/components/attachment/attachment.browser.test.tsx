import { useState } from "react";
import type { ReactElement } from "react";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { settleTransitions } from "../../../test/assert-invalid-ring";
import { assertNoAxeViolations } from "../../../test/axe";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { TARGET_SIZE } from "../../../test/target-size";
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
      const box = roleNamed("button", "Remove small.pdf").getBoundingClientRect();
      expect(box.width, `${density} width`).toBeGreaterThanOrEqual(TARGET_SIZE);
      expect(box.height, `${density} height`).toBeGreaterThanOrEqual(TARGET_SIZE);
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
