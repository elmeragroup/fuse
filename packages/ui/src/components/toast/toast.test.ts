import { describe, expect, it } from "vitest";

import { Toast } from "./toast";

describe("toast manager adapter", () => {
  it("createToastManager works from non-React code", () => {
    const manager = Toast.createToastManager();
    const id = manager.add({ title: "Saved", description: "Outside the tree.", timeout: 0 });
    expect(id).toEqual(expect.any(String));
    expect(id.length).toBeGreaterThan(0);
    manager.update(id, { description: "Updated from a timer." });
    manager.close(id);
    expect(manager).not.toHaveProperty("toasts");
  });

  it("promise() returns the settled value without a React tree", async () => {
    const manager = Toast.createToastManager();
    await expect(
      manager.promise(Promise.resolve("ok"), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).resolves.toBe("ok");
    await expect(
      manager.promise(Promise.reject(new Error("boom")), {
        loading: "Saving…",
        success: "Saved",
        error: "Failed",
      })
    ).rejects.toThrow("boom");
  });
});
