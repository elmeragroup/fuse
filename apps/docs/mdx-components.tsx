import { ApiReference } from "./src/components/api-reference";
import { ComponentIntro } from "./src/components/component-intro";
import { ComponentTokens } from "./src/components/component-tokens";
import { DemoFrame } from "./src/components/demo-frame";
import { MDX_HEADINGS, MdxCode, MdxPre } from "./src/components/mdx-elements";
import { Prose } from "./src/components/prose";

/**
 * Shared MDX elements and page components for authored component routes.
 * Heading anchors use the same slugger as the generated TOC. Fenced code uses
 * the shared server highlighter. Each page imports its own runnable demos.
 * MDX merges a page's components prop over these defaults.
 */
export function useMDXComponents() {
  return {
    ...MDX_HEADINGS,
    code: MdxCode,
    pre: MdxPre,
    ApiReference,
    ComponentIntro,
    ComponentTokens,
    /** `<Demo …>` is the page-facing name of the frame. */
    Demo: DemoFrame,
    Prose,
  };
}
