/**
 * Server-visible namespace for `InputGroup`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Addon, Button, Text, Input, Textarea } from "./index.parts";

export const InputGroup = {
  Root,
  Addon,
  Button,
  Text,
  Input,
  Textarea,
};

export type {
  InputGroupAddonProps,
  InputGroupButtonProps,
  InputGroupInputProps,
  InputGroupRootProps,
  InputGroupTextProps,
  InputGroupTextareaProps,
} from "./input-group";
