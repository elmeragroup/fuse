/**
 * Server-visible namespace for `AlertDialog`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { AlertDialogRoot, AlertDialogTrigger, AlertDialogContent } from "./alert-dialog";

export const AlertDialog = {
  Root: AlertDialogRoot,
  Trigger: AlertDialogTrigger,
  Content: AlertDialogContent,
};
