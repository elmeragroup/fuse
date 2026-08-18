import { describe, expect, it } from "vitest";

import { buildContrastMatrix, pairId, TEXT_GRADE_PAIRS } from "./contrast";
import { LEGAL_THEMES, themeSlug } from "./tokens/themes";

describe("contrast matrix", () => {
  const matrix = buildContrastMatrix();

  it("snapshots text-grade pairs across the 16 themes", async () => {
    expect(LEGAL_THEMES).toHaveLength(16);
    expect(Object.keys(matrix)).toHaveLength(16);
    await expect(matrix).toMatchFileSnapshot("./__snapshots__/contrast-matrix.json");
  });

  it("meets 4.5:1 on text-grade pairs that are not the muted-foreground classification", () => {
    for (const theme of LEGAL_THEMES) {
      const slug = themeSlug(theme);
      const row = matrix[slug];
      for (const [foreground, background] of TEXT_GRADE_PAIRS) {
        const id = pairId(foreground, background);
        const ratio = row[id];
        if (foreground === "muted-foreground") {
          continue;
        }
        expect(ratio, `${slug} ${id}`).toBeGreaterThanOrEqual(4.5);
      }
      if (theme.variant === "internal") {
        expect(
          row["muted-foreground/background"],
          `${slug} muted-foreground/background`
        ).toBeGreaterThanOrEqual(4.45);
      }
    }
  });
});
