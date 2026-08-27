/* oxlint-disable anti-slop/no-runtime-typeof -- JSDoc trivia is narrowed at the compiler boundary. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- assertions adapt unstable AST facts. */
/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized optional facts preserve the public encoding. */
/* oxlint-disable anti-slop/no-unknown-parameters -- primitive narrowing is the adapter's normalized-fact seam. */

import type { Node } from "typescript/unstable/ast";
import { isParameterDeclaration } from "typescript/unstable/ast/is";

import type { BackendDocumentation, BackendNodeReference, BackendSymbolHandle } from "../contracts.ts";
import { authoredSymbolName } from "./class-facts.ts";
import type { TsgoFactsSession } from "./facts.ts";

/**
 * Documentation normalization for the whole adapter.
 *
 * This module deliberately sits beside `facts.ts` and `class-facts.ts` as the
 * single owner of JSDoc work: the checker-aggregated symbol reader, the
 * declaration-authored node readers, and the shared tag/visibility reduction
 * live here so neither sibling grows a second copy of the normalization.
 */

/** A JSDoc tag reduced to the parts the public documentation record carries. */
type DocumentationTagDraft = { name: string; value?: string };

export function documentationOfNode(
  session: TsgoFactsSession,
  handle: BackendNodeReference
): BackendDocumentation | undefined {
  return documentationFromNode(session.node(handle, "documentationOfNode"));
}

/**
 * Reads the documentation authored directly on a declaration node.
 *
 * TypeScript attaches constructor JSDoc to the declaration, not to any symbol
 * the checker exposes — the transient constructor member carries no comment.
 * Upstream reads this same source (`getDocumentationFromNode`) whenever a
 * symbol has declarations, so the adapter normalizes the authored block into
 * the shared documentation record rather than dropping it.
 */
function documentationFromNode(node: Node): BackendDocumentation | undefined {
  const block = singleJsDocBlock(node);
  if (block === undefined) return undefined;
  const description = jsDocText(block.comment);
  const rawTags = block.tags ?? [];
  const visibility = visibilityFromTags(rawTags.map((tag) => tag.tagName.text));
  const defaultValueTag = rawTags.find((tag) => tag.tagName.text === "default");
  const tags = rawTags
    .filter((tag) => !["default", "private", "internal", "public", "param"].includes(tag.tagName.text))
    .map(tagToDocumentationTag);
  if (
    description === undefined &&
    tags.length === 0 &&
    visibility === undefined &&
    defaultValueTag === undefined
  )
    return undefined;
  return {
    ...(description === undefined ? {} : { description }),
    ...(defaultValueTag === undefined ? {} : { defaultValue: jsDocText(defaultValueTag.comment) ?? "" }),
    ...(visibility === undefined ? {} : { visibility }),
    tags,
  };
}

/**
 * Reads the documentation authored for ONE signature parameter.
 *
 * The checker aggregates `@param` summaries across an overloaded owner, so a
 * second overload's parameter can be answered with the first overload's text.
 * The authored block of the OWNING declaration is the only source scoped to a
 * single overload, so it is consulted first; a JSDoc block written directly on
 * the parameter declaration (inline parameter docs) is used next. Tag-only
 * blocks keep an empty description, matching upstream's shared parser.
 */
export function documentationOfParameter(
  session: TsgoFactsSession,
  parameter: BackendSymbolHandle,
  ownerDeclaration: BackendNodeReference | undefined
): BackendDocumentation | undefined {
  const symbol = session.symbol(parameter, "documentationOfParameter");
  const parameterName = authoredSymbolName(symbol.name);
  const owner =
    ownerDeclaration === undefined ? undefined : session.node(ownerDeclaration, "documentationOfParameter");
  const ownerBlock = owner === undefined ? undefined : singleJsDocBlock(owner);
  if (ownerBlock !== undefined) {
    const tag = (ownerBlock.tags ?? []).find(
      (candidate) => candidate.tagName.text === "param" && jsDocParamName(candidate) === parameterName
    );
    if (tag !== undefined) {
      return {
        description: normalizeParameterSummary(jsDocText(tag.comment) ?? ""),
        tags: [],
      };
    }
  }
  // No `@param` entry for this parameter on the owning declaration: an inline
  // block on the parameter itself still belongs to this parameter alone.
  const ownDeclarations = symbol.declarations
    .map((declaration) => session.resolveNode(declaration))
    .filter((candidate): candidate is Node => candidate !== undefined);
  const firstOwn = ownDeclarations.at(0);
  if (firstOwn !== undefined && jsDocBlocks(firstOwn).length === 1) {
    const documentation = documentationFromNode(firstOwn);
    if (documentation !== undefined && documentation.description === undefined) {
      return { ...documentation, description: "" };
    }
    return documentation;
  }
  return undefined;
}

export function documentationOfSymbol(
  session: TsgoFactsSession,
  handle: BackendSymbolHandle
): BackendDocumentation | undefined {
  const symbol = session.symbol(handle, "documentationOfSymbol");
  const resolvedDeclarations = symbol.declarations
    .map((candidate) => session.resolveNode(candidate))
    .filter((candidate): candidate is Node => candidate !== undefined);
  // A symbol declared several times (an overloaded function, for example)
  // aggregates every declaration's comment in the checker response. Upstream
  // reads only the first declaration's authored block, so the same source is
  // used here instead of publishing duplicated tags. This is deliberately more
  // lenient than upstream when that first block carries nothing: rather than
  // reporting nothing once a symbol has several declarations, resolution falls
  // through to the checker aggregate below and keeps whatever information it
  // does hold.
  if (resolvedDeclarations.length > 1) {
    const first = resolvedDeclarations.at(0);
    const firstDocumentation = first === undefined ? undefined : documentationFromNode(first);
    if (firstDocumentation !== undefined) return firstDocumentation;
  }
  const description = session.checker.getDocumentationCommentOfSymbol(symbol).trim();
  const rawTags = session.checker.getJsDocTagsOfSymbol(symbol);
  const visibility = visibilityFromTags(rawTags.map((tag) => tag.name));
  const defaultTag = rawTags.find((tag) => tag.name === "default");
  const tags = rawTags
    .filter((tag) => !["default", "private", "internal", "public", "param"].includes(tag.name))
    .map((tag) => {
      const result: DocumentationTagDraft = { name: tag.name };
      if (tag.text !== undefined) {
        const value = String(tag.text);
        result.value =
          tag.name === "type" && value.startsWith("{") && value.endsWith("}") ? value.slice(1, -1) : value;
      }
      return result;
    });
  if (description === "" && tags.length === 0 && visibility === undefined && defaultTag?.text === undefined)
    return undefined;
  const declaration = resolvedDeclarations[0];
  const parameterTagOnly =
    declaration !== undefined && isParameterDeclaration(declaration) && description === "";
  return {
    ...(description === ""
      ? parameterTagOnly
        ? { description: "" }
        : {}
      : {
          description:
            declaration !== undefined && isParameterDeclaration(declaration)
              ? normalizeParameterSummary(description)
              : description,
        }),
    ...(defaultTag?.text === undefined ? {} : { defaultValue: String(defaultTag.text) }),
    ...(visibility === undefined ? {} : { visibility }),
    tags,
  };
}

/**
 * Strips the separator a `@param` summary is written with.
 *
 * Checker summaries for parameters keep the `-` (and any surrounding
 * whitespace) the author wrote after the parameter name; upstream removes that
 * prefix from parameter documentation (`getParameterDocumentationFromSymbol`).
 */
function normalizeParameterSummary(summary: string): string {
  return summary.replace(/^[\s\-*:]*/u, "");
}

/** The authored parameter name a `@param` tag addresses, if any. */
function jsDocParamName(tag: JsDocTag): string | undefined {
  const expressionName = readIdentifierText(tag.nameExpression?.name);
  if (expressionName !== undefined) return expressionName;
  return readIdentifierText(tag.name);
}

/** The parts of a remote JSDoc tag the adapter reads. */
type JsDocTag = {
  readonly tagName: { text: string };
  readonly comment?: JsDocCommentParts;
  readonly name?: unknown;
  readonly nameExpression?: { name?: unknown };
  readonly typeExpression?: { type?: { getText(): string } };
};

/** The parts of a remote JSDoc block the adapter reads. */
type JsDocBlock = {
  readonly comment?: JsDocCommentParts;
  readonly tags?: readonly JsDocTag[];
};

type JsDocCommentParts = string | readonly { getText(): string }[];

function tagToDocumentationTag(tag: JsDocTag): DocumentationTagDraft {
  const result: DocumentationTagDraft = { name: tag.tagName.text };
  if (tag.typeExpression?.type !== undefined) {
    // An authored `@type` tag reports the type syntax it wraps.
    const value = tag.typeExpression.type.getText();
    if (value !== "") result.value = value;
    return result;
  }
  const value = jsDocText(tag.comment);
  if (value !== undefined) result.value = value;
  return result;
}

function singleJsDocBlock(node: Node): JsDocBlock | undefined {
  const blocks = jsDocBlocks(node);
  // Upstream consumes exactly one JSDoc block; several stacked blocks have no
  // single authored meaning, so none is reported.
  return blocks.length === 1 ? blocks[0] : undefined;
}

function jsDocBlocks(node: Node): readonly JsDocBlock[] {
  // SAFETY: every declaration node exposes its JSDoc children under `jsDoc`;
  // the adapter reads only the array shape and defers the rest to the readers.
  const blocks = (node as Node & { readonly jsDoc?: unknown }).jsDoc;
  return Array.isArray(blocks) ? (blocks as readonly JsDocBlock[]) : [];
}

function readIdentifierText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  // SAFETY: identifier nodes expose their spelling as `text`.
  if (typeof (value as { text?: unknown } | undefined)?.text === "string") {
    return (value as { text: string }).text;
  }
  return undefined;
}

/**
 * Joins authored JSDoc trivia into the plain text TypeScript's classic AST
 * would report. Remote comment pieces keep the block's opening marker and the
 * left-margin stars, so they are stripped line by line here.
 */
function jsDocText(comment: JsDocCommentParts | undefined): string | undefined {
  if (comment === undefined) return undefined;
  const raw = typeof comment === "string" ? comment : comment.map((part) => part.getText()).join("");
  const normalized = normalizeJsDocBlock(raw);
  return normalized === "" ? undefined : normalized;
}

function normalizeJsDocBlock(raw: string): string {
  const withoutMarkers = raw.replace(/^\/\*\*/u, "").replace(/\*\/$/u, "");
  const lines = withoutMarkers.split("\n").map((line) => line.replace(/^[ \t]*\*[ ]?/u, ""));
  while (lines.length > 0 && (lines[0]?.trim() ?? "") === "") lines.shift();
  while (lines.length > 0 && (lines.at(-1)?.trim() ?? "") === "") lines.pop();
  return lines.join("\n");
}

function visibilityFromTags(names: readonly string[]): BackendDocumentation["visibility"] {
  const tags = new Set(names);
  if (tags.has("private")) return "private";
  if (tags.has("internal")) return "internal";
  if (tags.has("public")) return "public";
  return undefined;
}
