import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** A 1×1 transparent PNG, so a picked image decodes and previews. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

describe("FileUpload demos", () => {
  it.each([
    ["Compact drop zone", "Add files"],
    ["Attachments with limits", "Add files"],
    ["Picker only", "Choose file"],
    ["Folders", "Add folder"],
  ])("%s renders its Trigger", async (title, trigger) => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "file-upload", title);
    expect(await demo.getByRole("button", { name: trigger, exact: true }).count()).toBe(1);
    await page.close();
  });

  it("describes the compact zone's Trigger with the hint", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "file-upload", "Compact drop zone");
    const hint = "Drop files here or click to browse (max 3 files)";
    // The accessible description: the text of each element the Trigger's aria-describedby names.
    const description = () =>
      demo.getByRole("button", { name: "Add files", exact: true }).evaluate((button) =>
        (button.getAttribute("aria-describedby") ?? "")
          .split(/\s+/u)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim()
      );
    await expect.poll(description).toBe(hint);
    await page.close();
  });

  // Next hydrates React on the document, so the zone's `stopPropagation` cannot keep a drag from
  // the Fuse drop guard's listener on that same node. A synthetic DragEvent never reaches the
  // browser's drop decision, so the drag goes through Chromium's own path with a file on disk.
  it("lists a file dropped on the compact zone's surface", async () => {
    const dir = mkdtempSync(join(tmpdir(), "docs-file-drop-"));
    const file = join(dir, "dropped-photo.png");
    writeFileSync(file, PNG);
    const page = await browser().newPage();
    try {
      const demo = await openDemo(page, "file-upload", "Compact drop zone");
      const zone = demo.locator('[data-slot="file-upload-dropzone"]');
      await zone.scrollIntoViewIfNeeded();
      const box = await zone.boundingBox();
      if (box === null) {
        throw new Error("expected the compact drop zone to have a box");
      }
      // The zone's right end, past the Trigger and the hint.
      const point = { x: box.x + box.width - 8, y: box.y + box.height / 2 };
      const data = { items: [], files: [file], dragOperationsMask: 1 };
      const cdp = await page.context().newCDPSession(page);
      for (const type of ["dragEnter", "dragOver", "drop"] as const) {
        await cdp.send("Input.dispatchDragEvent", { type, ...point, data });
      }
      await expect.poll(() => demo.getByText("dropped-photo.png", { exact: true }).count()).toBe(1);
    } finally {
      await page.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lists accepted files as attachments and alerts about a rejected one", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "file-upload", "Attachments with limits");
    const chooser = page.waitForEvent("filechooser");
    await demo.getByRole("button", { name: "Add files", exact: true }).click();
    await (
      await chooser
    ).setFiles([
      { name: "meter.png", mimeType: "image/png", buffer: PNG },
      { name: "setup.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") },
    ]);
    const list = demo.getByRole("list", { name: "Attached files" });
    await expect
      .poll(() => list.getByRole("listitem").allTextContents())
      .toEqual([expect.stringContaining("meter.png")]);
    await expect.poll(() => demo.getByRole("alert").textContent()).toContain("setup.exe");
    await page.close();
  });
});
