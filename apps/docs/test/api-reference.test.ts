import { describe, expect, it } from "vitest";

import { DocsCodeBlock } from "../src/components/docs-code-block";
import { NO_DEFAULT } from "../src/lib/api-row";
import { readComponentApi } from "../src/lib/api-source";
import type { ApiPartView } from "../src/lib/api-view";
import { toPartView } from "../src/lib/api-view";
import type { ApiPart } from "../src/lib/docs-model";
import { API_REGEN_COMMAND } from "../src/lib/docs-model";

async function partView(slug: string, name: string): Promise<ApiPartView> {
  const api = await readComponentApi(slug);
  const part = api.parts.find((candidate) => candidate.name === name);
  if (part === undefined) {
    throw new Error(`${slug} has no part named ${name}`);
  }
  return toPartView(part);
}

describe("committed api.json read at render time (docs-site.md §8)", () => {
  it("renders the artifact the repository committed, banner and all", async () => {
    const api = await readComponentApi("button");
    expect(api.slug).toBe("button");
    expect(api.$generated).toContain(API_REGEN_COMMAND);
    expect(api.parts.map((part) => part.name)).toContain("Button");
  });

  it("fails the build naming the file and the command when the artifact is missing", async () => {
    await expect(readComponentApi("no-such-component")).rejects.toThrow(
      "apps/docs/src/app/(docs)/components/no-such-component/api.json does not exist"
    );
    await expect(readComponentApi("no-such-component")).rejects.toThrow(API_REGEN_COMMAND);
  });

  it("includes selected Base UI primitive props without exposing React or DOM props", async () => {
    const api = await readComponentApi("button");
    const button = api.parts.find((part) => part.name === "Button");
    if (button === undefined) throw new Error("button has no Button API part");

    expect(button.props).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "focusableWhenDisabled",
          origin: { packageName: "@base-ui/react" },
          defaultValue: "false",
          description: "Whether the button should be focusable when disabled.",
        }),
        expect.objectContaining({
          name: "nativeButton",
          origin: { packageName: "@base-ui/react" },
          defaultValue: "true",
        }),
        expect.objectContaining({ name: "render", origin: { packageName: "@base-ui/react" } }),
        expect.objectContaining({ name: "style", origin: { packageName: "@base-ui/react" } }),
      ])
    );
    expect(button.props.map((prop) => prop.name)).not.toEqual(
      expect.arrayContaining(["children", "onClick", "ref"])
    );
  });
});

describe("reference row presentation (docs-site.md §8)", () => {
  it("shows the collapsed short type closed and the full signature expanded", async () => {
    const part = await partView("button", "Button");
    const onIntent = part.props.find((prop) => prop.name === "onIntent");
    expect(onIntent?.closedType).toBe("function");
    // The panel gets a finished element: the server highlighted the printed signature
    // through DocsCodeBlock, so the client module never reaches the highlighter.
    expect(onIntent?.signature.type).toBe(DocsCodeBlock);
    expect(onIntent?.signature.props).toMatchObject({
      variant: "signature",
      source: "(() => void) | undefined",
    });
  });

  it("keeps the printed type in the closed row when it is short enough to read", async () => {
    const part = await partView("button", "Button");
    expect(part.props.find((prop) => prop.name === "isPending")?.closedType).toBe("boolean | undefined");
  });

  it("gives every row a deep link that survives the prop's casing", async () => {
    const part = await partView("button", "Button");
    expect(part.anchor).toBe("api-button");
    expect(part.props.map((prop) => prop.id)).toContain("api-button-isVisuallyDisabled");
  });

  it("reports RSC status per part, in the words a reader acts on", async () => {
    expect((await partView("button", "Button")).rscLabel).toBe('"use client"');
    expect((await partView("card", "Card.Root")).rscLabel).toBe("server-safe");
  });

  it("leaves a missing default as an em-dash rather than an empty cell", async () => {
    const part = await partView("button", "Button");
    expect(part.props.find((prop) => prop.name === "onIntent")?.defaultValue).toBeNull();
    expect(NO_DEFAULT).toBe("—");
  });

  it("composes one label per row so a summary is not announced cell by cell", () => {
    const part: ApiPart = {
      name: "Dialog.Root",
      rsc: "client",
      sourcePath: "packages/ui/src/components/dialog/dialog.tsx",
      forwardedFrom: [],
      forwardedCount: 0,
      props: [
        {
          name: "open",
          origin: "declared",
          type: "boolean",
          shortType: null,
          defaultValue: null,
          description: "Whether the dialog is open.",
          required: true,
        },
        {
          name: "size",
          origin: "recipe-axis",
          type: '"sm" | "md" | "lg" | undefined',
          shortType: "Union",
          defaultValue: '"md"',
          description: "",
          required: false,
        },
      ],
    };

    const view = toPartView(part);
    expect(view.props.at(0)?.label).toBe("Prop: open, required, type: boolean");
    expect(view.props.at(1)?.label).toBe('Prop: size, type: Union (default: "md")');
    // A recipe axis has no JSDoc to show; its printed union is the documentation.
    expect(view.props.at(1)?.description).toBe("Recipe axis.");
    expect(view.props.at(0)?.id).toBe("api-dialog-root-open");
  });
});
