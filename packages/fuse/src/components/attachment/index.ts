/**
 * Server-visible namespace for `Attachment`.
 * Root, Group, Action and Trigger stay client modules; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { AttachmentGroup, AttachmentRoot } from "./attachment";
import { AttachmentAction } from "./attachment-action";
import {
  AttachmentActions,
  AttachmentAspectRatio,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "./attachment-markup";
import { AttachmentTrigger } from "./attachment-trigger";

export const Attachment = {
  Root: AttachmentRoot,
  Group: AttachmentGroup,
  Media: AttachmentMedia,
  AspectRatio: AttachmentAspectRatio,
  Content: AttachmentContent,
  Title: AttachmentTitle,
  Description: AttachmentDescription,
  Actions: AttachmentActions,
  Action: AttachmentAction,
  Trigger: AttachmentTrigger,
};
