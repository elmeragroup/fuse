"use client";

import { Component } from "react";
import type { ReactNode } from "react";

type DecorationBoundaryProps = {
  /** The decoration's input. A new value clears a failure, so the new input's decoration shows. */
  resetKey: string;
  children: ReactNode;
};

type DecorationBoundaryState = { failed: boolean; resetKey: string };

/**
 * Renders nothing in place of decoration that throws while rendering, such as a shader whose
 * image failed to load, so the failure stays inside the decoration instead of reaching the
 * route's error page. A new `resetKey` shows that input's decoration without remounting healthy
 * children. A shader's image that already failed stays dropped until reload, because the shader
 * caches the rejection per image URL.
 */
export class DecorationBoundary extends Component<DecorationBoundaryProps, DecorationBoundaryState> {
  override state: DecorationBoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<DecorationBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: DecorationBoundaryProps,
    state: DecorationBoundaryState
  ): DecorationBoundaryState | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
