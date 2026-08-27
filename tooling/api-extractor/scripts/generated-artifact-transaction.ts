import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { basename, join } from "node:path";

type FileSystemError = Error & { readonly code?: string };

export type StagingFile = {
  readonly name: string;
  readonly path: string;
  readonly device: number;
  readonly inode: number;
};

export type TemporaryFile = StagingFile & {
  readonly fd: number;
};

export type SnapshotDestinationHooks = {
  /** Test-only seam for validating cleanup after the backup descriptor closes. */
  readonly afterBackup?: (staging: StagingFile) => void;
};

export type DestinationIdentity = {
  readonly device: number;
  readonly inode: number;
};

export type DestinationBackup =
  | { readonly kind: "missing" }
  | {
      readonly kind: "file";
      readonly sourceDevice: number;
      readonly sourceInode: number;
      readonly staging: StagingFile;
    };

type InitialDestination =
  | { readonly kind: "missing" }
  | { readonly kind: "file"; readonly device: number; readonly inode: number };

export type TransactionEntry = {
  readonly destinationPath: string;
  readonly initial: InitialDestination;
  backup?: DestinationBackup;
  backupRestored?: boolean;
  committedDevice?: number;
  committedInode?: number;
  collisionDevice?: number;
  collisionInode?: number;
};

export type ArtifactTransaction = {
  readonly entries: readonly TransactionEntry[];
  readonly byPath: ReadonlyMap<string, TransactionEntry>;
  readonly committedByIdentity: Map<string, TransactionEntry>;
};

function isMissing(error: Error): error is FileSystemError {
  return "code" in error && error.code === "ENOENT";
}

function identityKey(identity: DestinationIdentity): string {
  return `${identity.device}:${identity.inode}`;
}

function initialDestination(destinationPath: string): InitialDestination {
  let file;
  try {
    file = lstatSync(destinationPath);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) return { kind: "missing" };
    throw error;
  }
  if (file.isSymbolicLink()) {
    throw new Error(
      `Generated Issue 14 artifact refuses symlink destination during transaction: ${destinationPath}`
    );
  }
  if (!file.isFile()) {
    throw new Error(
      `EISDIR: Generated Issue 14 artifact destination is not a regular file: ${destinationPath}`
    );
  }
  return { kind: "file", device: file.dev, inode: file.ino };
}

/**
 * Reserve every requested path and preserve each pre-existing destination
 * before the first rename or caller race hook. The reservation is an
 * in-memory ownership table: it records the initial state and the identities
 * committed by this transaction without creating placeholder files that would
 * block legitimate caller race tests. Existing-file backups live in the
 * anchored staging directory and are consumed only by rollback or final
 * success cleanup.
 */
export function createArtifactTransaction(destinationPaths: readonly string[]): ArtifactTransaction {
  const entries: TransactionEntry[] = [];
  const byPath = new Map<string, TransactionEntry>();
  const initialByIdentity = new Map<string, TransactionEntry>();
  for (const destinationPath of destinationPaths) {
    if (byPath.has(destinationPath)) {
      throw new Error(`Generated Issue 14 artifact has a duplicate resolved destination: ${destinationPath}`);
    }
    const entry: TransactionEntry = {
      destinationPath,
      initial: initialDestination(destinationPath),
    };
    if (entry.initial.kind === "file") {
      const key = identityKey(entry.initial);
      const existing = initialByIdentity.get(key);
      if (existing !== undefined) {
        throw new Error(
          `Generated Issue 14 artifact destination aliases another generated destination by filesystem identity: ${destinationPath} aliases ${existing.destinationPath}`
        );
      }
      initialByIdentity.set(key, entry);
    }
    entries.push(entry);
    byPath.set(destinationPath, entry);
  }
  const transaction: ArtifactTransaction = { entries, byPath, committedByIdentity: new Map() };
  try {
    for (const entry of entries) {
      entry.backup =
        entry.initial.kind === "missing"
          ? { kind: "missing" }
          : snapshotExistingDestination(entry.destinationPath, entry.initial);
    }
  } catch (error) {
    const cleanupError = discardTransactionBackups(transaction);
    if (cleanupError !== undefined) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AggregateError([error, cleanupError], message, { cause: error });
    }
    throw error;
  }
  return transaction;
}

function transactionEntry(transaction: ArtifactTransaction, destinationPath: string): TransactionEntry {
  const entry = transaction.byPath.get(destinationPath);
  if (entry === undefined) {
    throw new Error(`Generated Issue 14 artifact destination was not reserved: ${destinationPath}`);
  }
  return entry;
}

export function destinationIdentity(destinationPath: string): DestinationIdentity {
  const file = lstatSync(destinationPath);
  if (file.isSymbolicLink()) {
    throw new Error(
      `Generated Issue 14 artifact refuses symlink destination during transaction: ${destinationPath}`
    );
  }
  if (!file.isFile()) {
    throw new Error(
      `EISDIR: Generated Issue 14 artifact destination is not a regular file: ${destinationPath}`
    );
  }
  return { device: file.dev, inode: file.ino };
}

/**
 * Check the current entry against transaction-owned output identities. A
 * destination that became a hardlink (or a case-fold alias) of an earlier
 * output is never allowed to be committed as a second file. The collision is
 * retained on its reservation so rollback can remove the newly-created alias.
 */
export function assertDestinationReservation(
  transaction: ArtifactTransaction,
  destinationPath: string
): void {
  const entry = transactionEntry(transaction, destinationPath);
  let current: DestinationIdentity;
  try {
    current = destinationIdentity(destinationPath);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) return;
    throw error;
  }
  const owner = transaction.committedByIdentity.get(identityKey(current));
  if (owner === undefined || owner === entry) return;
  entry.collisionDevice = current.device;
  entry.collisionInode = current.inode;
  throw new Error(
    `Generated Issue 14 artifact destination aliases an output already committed in this transaction: ${destinationPath} aliases ${owner.destinationPath}`
  );
}

export function recordCommittedDestination(
  transaction: ArtifactTransaction,
  destinationPath: string,
  identity: DestinationIdentity
): void {
  const entry = transactionEntry(transaction, destinationPath);
  const key = identityKey(identity);
  // Mark the entry before checking the map so a post-rename ownership error
  // still leaves enough identity for rollback to remove the new output.
  entry.committedDevice = identity.device;
  entry.committedInode = identity.inode;
  const owner = transaction.committedByIdentity.get(key);
  if (owner !== undefined && owner !== entry) {
    throw new Error(
      `Generated Issue 14 artifact destination aliases an output already committed in this transaction: ${destinationPath} aliases ${owner.destinationPath}`
    );
  }
  transaction.committedByIdentity.set(key, entry);
}

export function createStagingFile(destinationPath: string, suffix: "tmp" | "bak"): TemporaryFile {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const name = `.${basename(destinationPath)}.${process.pid}.${randomUUID()}.${suffix}`;
    const path = join(".", name);
    try {
      const fd = openSync(path, flags, 0o600);
      try {
        const identity = fstatSync(fd);
        if (!identity.isFile()) {
          throw new Error(`Generated Issue 14 temporary staging file is not regular: ${path}`);
        }
        return { fd, name, path, device: identity.dev, inode: identity.ino };
      } catch (error) {
        closeDescriptor(fd);
        throw error;
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
  }
  throw new Error(`Could not allocate a unique staging file for ${destinationPath}`);
}

export function createTemporaryFile(destinationPath: string): TemporaryFile {
  return createStagingFile(destinationPath, "tmp");
}

export function writeDescriptor(fd: number, content: string | Uint8Array): void {
  const buffer = Buffer.from(content);
  let offset = 0;
  while (offset < buffer.byteLength) {
    const written = writeSync(fd, buffer, offset, buffer.byteLength - offset, null);
    if (written <= 0) throw new Error("Generated Issue 14 artifact write made no progress.");
    offset += written;
  }
  fsyncSync(fd);
}

export function assertTemporaryFileUnchanged(temporary: TemporaryFile): void {
  const descriptor = fstatSync(temporary.fd);
  if (!descriptor.isFile() || descriptor.dev !== temporary.device || descriptor.ino !== temporary.inode) {
    throw new Error(`Generated Issue 14 temporary staging file descriptor changed: ${temporary.path}`);
  }
  let current;
  try {
    current = lstatSync(temporary.name);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) {
      throw new Error(
        `Generated Issue 14 temporary staging file disappeared before commit: ${temporary.path}`
      );
    }
    throw error;
  }
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.dev !== temporary.device ||
    current.ino !== temporary.inode
  ) {
    throw new Error(
      `Generated Issue 14 temporary staging file was replaced before commit: ${temporary.path}`
    );
  }
}

function assertStagingFilePathUnchanged(staging: StagingFile): void {
  let current;
  try {
    current = lstatSync(staging.name);
  } catch (error) {
    if (error instanceof Error && isMissing(error)) {
      throw new Error(`Generated Issue 14 staging file disappeared before cleanup: ${staging.path}`);
    }
    throw error;
  }
  if (
    current.isSymbolicLink() ||
    !current.isFile() ||
    current.dev !== staging.device ||
    current.ino !== staging.inode
  ) {
    throw new Error(`Generated Issue 14 staging file was replaced before cleanup: ${staging.path}`);
  }
}

export function removeTemporaryFile(temporary: StagingFile): void {
  assertStagingFilePathUnchanged(temporary);
  unlinkSync(temporary.name);
}

/** Snapshot an existing destination before its atomic replacement. */
export function snapshotDestination(
  destinationPath: string,
  hooks: SnapshotDestinationHooks = {}
): DestinationBackup {
  let sourceDescriptor: number | undefined;
  let staging: TemporaryFile | undefined;
  let backupStaging: StagingFile | undefined;
  let stagingDescriptor: number | undefined;
  try {
    try {
      sourceDescriptor = openSync(destinationPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) return { kind: "missing" };
      throw error;
    }
    const source = fstatSync(sourceDescriptor);
    if (!source.isFile()) {
      throw new Error(
        `EISDIR: Generated Issue 14 artifact destination is not a regular file: ${destinationPath}`
      );
    }
    const bytes = readFileSync(sourceDescriptor);
    staging = createStagingFile(destinationPath, "bak");
    stagingDescriptor = staging.fd;
    writeDescriptor(staging.fd, bytes);
    const descriptor = staging.fd;
    stagingDescriptor = undefined;
    closeSync(descriptor);
    // The descriptor is deliberately owned and closed locally. Construct a
    // fresh metadata-only value after that close so neither the hook nor the
    // transaction backup can retain or accidentally reuse the descriptor.
    backupStaging = {
      name: staging.name,
      path: staging.path,
      device: staging.device,
      inode: staging.inode,
    };
    hooks.afterBackup?.(backupStaging);
    const latest = fstatSync(sourceDescriptor);
    const current = destinationIdentity(destinationPath);
    if (latest.dev !== source.dev || latest.ino !== source.ino) {
      throw new Error(
        `Generated Issue 14 artifact destination changed while it was being backed up: ${destinationPath}`
      );
    }
    if (current.device !== source.dev || current.inode !== source.ino) {
      throw new Error(
        `Generated Issue 14 artifact destination changed while it was being backed up: ${destinationPath}`
      );
    }
    return {
      kind: "file",
      sourceDevice: source.dev,
      sourceInode: source.ino,
      staging: backupStaging,
    };
  } catch (error) {
    const descriptor = stagingDescriptor;
    stagingDescriptor = undefined;
    if (descriptor !== undefined) {
      try {
        closeDescriptor(descriptor);
      } catch {
        // Preserve the primary snapshot error; the path cleanup below still
        // runs without retrying a descriptor whose ownership was released.
      }
    }
    const cleanupStaging = backupStaging ?? staging;
    if (cleanupStaging !== undefined) {
      try {
        removeTemporaryFile(cleanupStaging);
      } catch {
        // The primary snapshot error remains the actionable failure. The
        // surrounding transaction cleanup will report any retained residue.
      }
    }
    throw error;
  } finally {
    closeDescriptor(sourceDescriptor);
  }
}

function snapshotExistingDestination(
  destinationPath: string,
  initial: Extract<InitialDestination, { readonly kind: "file" }>
): DestinationBackup {
  const backup = snapshotDestination(destinationPath);
  if (
    backup.kind !== "file" ||
    backup.sourceDevice !== initial.device ||
    backup.sourceInode !== initial.inode
  ) {
    if (backup.kind === "file") {
      try {
        removeTemporaryFile(backup.staging);
      } catch {
        // Preserve the source-identity failure; transaction cleanup reports
        // any staging residue that remains reachable.
      }
    }
    throw new Error(
      `Generated Issue 14 artifact destination changed while being reserved: ${destinationPath}`
    );
  }
  return backup;
}

export function assertDestinationSnapshotUnchanged(destinationPath: string, backup: DestinationBackup): void {
  if (backup.kind === "missing") {
    try {
      lstatSync(destinationPath);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) return;
      throw error;
    }
    throw new Error(
      `Generated Issue 14 artifact destination appeared during transaction: ${destinationPath}`
    );
  }
  const current = destinationIdentity(destinationPath);
  if (current.device !== backup.sourceDevice || current.inode !== backup.sourceInode) {
    throw new Error(`Generated Issue 14 artifact destination changed during transaction: ${destinationPath}`);
  }
  assertStagingFilePathUnchanged(backup.staging);
}

function appendTransactionError(existing: Error | undefined, next: Error): Error {
  return existing === undefined
    ? next
    : new AggregateError([existing, next], existing.message, { cause: existing });
}

function removeCommittedDestination(
  entry: TransactionEntry,
  removedIdentities: Set<string>
): Error | undefined {
  if (entry.committedDevice === undefined || entry.committedInode === undefined) return undefined;
  const committed = { device: entry.committedDevice, inode: entry.committedInode };
  try {
    const current = destinationIdentity(entry.destinationPath);
    if (current.device !== committed.device || current.inode !== committed.inode) {
      throw new Error(
        `Generated Issue 14 artifact committed destination changed during rollback: ${entry.destinationPath}`
      );
    }
    unlinkSync(entry.destinationPath);
    removedIdentities.add(identityKey(committed));
  } catch (error) {
    if (error instanceof Error && isMissing(error) && removedIdentities.has(identityKey(committed))) {
      return undefined;
    }
    return error instanceof Error ? error : new Error(String(error));
  }
  return undefined;
}

function removeCommittedAlias(entry: TransactionEntry, removedIdentities: Set<string>): Error | undefined {
  if (entry.collisionDevice === undefined || entry.collisionInode === undefined) return undefined;
  const collision = { device: entry.collisionDevice, inode: entry.collisionInode };
  try {
    const current = destinationIdentity(entry.destinationPath);
    if (current.device !== collision.device || current.inode !== collision.inode) {
      throw new Error(
        `Generated Issue 14 artifact collision alias changed during rollback: ${entry.destinationPath}`
      );
    }
    unlinkSync(entry.destinationPath);
    removedIdentities.add(identityKey(collision));
  } catch (error) {
    if (error instanceof Error && isMissing(error) && removedIdentities.has(identityKey(collision))) {
      return undefined;
    }
    return error instanceof Error ? error : new Error(String(error));
  }
  return undefined;
}

function restoreOriginalDestination(entry: TransactionEntry): Error | undefined {
  if (
    entry.initial.kind !== "file" ||
    entry.backup?.kind !== "file" ||
    (entry.committedDevice === undefined && entry.collisionDevice === undefined)
  ) {
    return undefined;
  }
  try {
    try {
      lstatSync(entry.destinationPath);
    } catch (error) {
      if (error instanceof Error && isMissing(error)) {
        assertStagingFilePathUnchanged(entry.backup.staging);
        renameSync(entry.backup.staging.name, entry.destinationPath);
        entry.backupRestored = true;
        return undefined;
      }
      throw error;
    }
    throw new Error(
      `Generated Issue 14 artifact destination changed before original restoration: ${entry.destinationPath}`
    );
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

export function rollbackTransaction(transaction: ArtifactTransaction): Error | undefined {
  let failure: Error | undefined;
  const removedIdentities = new Set<string>();

  // Remove aliases before committed paths. On a case-insensitive filesystem
  // both names can address one directory entry, so removing the alias first
  // may also remove the committed path. The identity set makes that outcome
  // explicit and safe for the following phase.
  for (const entry of [...transaction.entries].reverse()) {
    const aliasFailure = removeCommittedAlias(entry, removedIdentities);
    if (aliasFailure !== undefined) failure = appendTransactionError(failure, aliasFailure);
  }

  for (const entry of [...transaction.entries].reverse()) {
    const committedFailure = removeCommittedDestination(entry, removedIdentities);
    if (committedFailure !== undefined) failure = appendTransactionError(failure, committedFailure);
  }

  // Restore only destinations that this transaction committed or explicitly
  // replaced with a transaction-owned alias. Unrelated caller mutations stay
  // untouched, while a pre-existing destination that lost its pathname to a
  // collision regains its snapshotted bytes.
  for (const entry of transaction.entries) {
    const restoreFailure = restoreOriginalDestination(entry);
    if (restoreFailure !== undefined) failure = appendTransactionError(failure, restoreFailure);
  }

  for (const entry of transaction.entries) {
    if (entry.backup?.kind !== "file" || entry.backupRestored === true) continue;
    try {
      removeTemporaryFile(entry.backup.staging);
    } catch (error) {
      failure = appendTransactionError(failure, error instanceof Error ? error : new Error(String(error)));
    }
  }
  return failure;
}

export function discardTransactionBackups(transaction: ArtifactTransaction): Error | undefined {
  let failure: Error | undefined;
  for (const entry of transaction.entries) {
    const backup = entry.backup;
    if (backup?.kind !== "file" || entry.backupRestored === true) continue;
    try {
      removeTemporaryFile(backup.staging);
    } catch (error) {
      failure = appendTransactionError(failure, error instanceof Error ? error : new Error(String(error)));
    }
  }
  return failure;
}

export function closeDescriptor(descriptor: number | undefined): void {
  if (descriptor === undefined) return;
  try {
    closeSync(descriptor);
  } catch (error) {
    if (!(error instanceof Error && isMissing(error))) throw error;
  }
}
