import path from "node:path";
import type { RoomState } from "./index.js";
import { saveRoomDocument } from "./persistence.js";

export const DATA_DIR = path.join(process.cwd(), "data", "rooms");

export function getRoomKey(roomId: string) {
  return Buffer.from(roomId).toString("base64url");
}

export function getSnapshotPath(roomId: string) {
  return path.join(DATA_DIR, `${getRoomKey(roomId)}.bin`);
}

export function getMetadataPath(roomId: string) {
  return path.join(DATA_DIR, `${getRoomKey(roomId)}.json`);
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SAVE_DOCUMENT_DELAY = 500;

export function scheduleRoomSave(roomId: string, room: RoomState) {
  const existingTimer = saveTimers.get(roomId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const nextTimer = setTimeout(() => {
    saveRoomDocument({ roomId, doc: room.doc, language: room.language }).catch(
      (error) => {
        console.error(`Failed to save room ${roomId}`, error);
      },
    );

    saveTimers.delete(roomId);
  }, SAVE_DOCUMENT_DELAY);

  saveTimers.set(roomId, nextTimer);
}

export async function saveRoomNow(roomId: string, room: RoomState) {
  const existingTimer = saveTimers.get(roomId);

  if (existingTimer) {
    clearTimeout(existingTimer);
    saveTimers.delete(roomId);
  }

  await saveRoomDocument({ roomId, doc: room.doc, language: room.language });
}
