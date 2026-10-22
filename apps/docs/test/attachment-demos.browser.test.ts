import { describe, expect, it } from "vitest";

import { launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

/** A 1×1 transparent PNG, so the picked image decodes and previews. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

describe("Attachment demos", () => {
  it("adds an attachment for each picked file and drops one when it is removed", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "attachment", "Upload with FileTrigger");
    const chooser = page.waitForEvent("filechooser");
    await demo.getByRole("button", { name: "Attach files" }).click();
    await (
      await chooser
    ).setFiles([
      { name: "meter.png", mimeType: "image/png", buffer: PNG },
      { name: "contract.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
    ]);
    const list = demo.getByRole("list", { name: "Attached files" });
    await expect
      .poll(() => list.getByRole("listitem").allTextContents())
      .toEqual([expect.stringContaining("meter.png"), expect.stringContaining("contract.pdf")]);

    // The picked image previews through an object URL, which removing the file revokes.
    const preview = list.getByRole("img", { name: "meter.png" });
    const previewUrl = await preview.getAttribute("src");
    expect(previewUrl).toMatch(/^blob:/);
    await demo.getByRole("button", { name: "Remove meter.png" }).click();
    await expect
      .poll(() => list.getByRole("listitem").allTextContents())
      .toEqual([expect.stringContaining("contract.pdf")]);
    const stillLoads = await page.evaluate(
      (url) =>
        fetch(url).then(
          () => true,
          () => false
        ),
      previewUrl ?? ""
    );
    expect(stillLoads).toBe(false);
    await page.close();
  });

  it("opens the preview dialog from the trigger, not from the actions beside it", async () => {
    const page = await browser().newPage();
    const demo = await openDemo(page, "attachment", "Dialog and link triggers");
    const dialog = page.getByRole("dialog", { name: "inspection-report.pdf" });
    await demo.getByRole("button", { name: "Copy link to inspection-report.pdf" }).click();
    expect(await dialog.count()).toBe(0);
    await demo.getByRole("button", { name: "Preview inspection-report.pdf" }).click();
    await expect.poll(() => dialog.count()).toBe(1);
    await page.close();
  });
});
