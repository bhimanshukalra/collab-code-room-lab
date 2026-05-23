import * as Y from "yjs";
import { DATA_DIR, getMetadataPath, getSnapshotPath } from "./utils.js";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

export type PersistedRoom = {
  roomId: string;
  language: string;
  documentUpdate: Uint8Array;
  updatedAt: string;
};

export type PersistedRoomState = {
  language: string;
  updatedAt: string;
};

interface SaveRoomDocumentProps {
  roomId: string;
  doc: Y.Doc;
  language: string;
}

export async function loadRoomDocument(roomId: string) {
  try {
    const [snapshot, metadataRaw] = await Promise.all([
      readFile(getSnapshotPath(roomId)),
      readFile(getMetadataPath(roomId), "utf-8"),
    ]);
    const metadata = JSON.parse(metadataRaw) as PersistedRoomState;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(snapshot));

    return { doc, language: metadata.language };
  } catch {
    return null;
  }
}

export async function saveRoomDocument({
  doc,
  language,
  roomId,
}: SaveRoomDocumentProps) {
  await mkdir(DATA_DIR, { recursive: true });

  const snapshot = Y.encodeStateAsUpdate(doc);
  const updatedAt = new Date().toISOString();

  const snapshotPath = getSnapshotPath(roomId);
  const metadataPath = getMetadataPath(roomId);

  await writeFile(`${snapshotPath}.tmp`, snapshot);
  await writeFile(
    `${metadataPath}.tmp`,
    JSON.stringify({ language, updatedAt }, null, 2),
  );

  await rename(`${snapshotPath}.tmp`, snapshotPath);
  await rename(`${metadataPath}.tmp`, metadataPath);
}

export async function deleteRoomDocument(roomId: string): Promise<void> {
  await Promise.all([
    unlink(getSnapshotPath(roomId)).catch(ignoreMissingFile),
    unlink(getMetadataPath(roomId)).catch(ignoreMissingFile),
  ]);
}

function ignoreMissingFile(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  ) {
    return;
  }

  throw error;
}
