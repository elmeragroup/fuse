import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

describe("Avatar root classes", () => {
  it("paints from muted tokens and never a raw gray palette class", () => {
    const html = renderToStaticMarkup(
      createElement(Avatar.Root, null, createElement(Avatar.Fallback, null, "AL"))
    );
    expect(html).toContain("bg-muted");
    expect(html).toContain("text-muted-foreground");
    expect(html).not.toContain("bg-gray-");
    expect(html).not.toContain("text-gray-");
    expect(html).toContain('data-slot="avatar"');
    expect(html).toContain('data-slot="avatar-fallback"');
  });

  it("lets className size-10 beat the default size-8 through cn", () => {
    const html = renderToStaticMarkup(
      createElement(Avatar.Root, { className: "size-10" }, createElement(Avatar.Fallback, null, "AL"))
    );
    expect(html).toContain("size-10");
    expect(html).not.toContain("size-8");
  });
});
