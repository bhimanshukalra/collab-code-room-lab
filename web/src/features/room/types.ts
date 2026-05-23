export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

export type JoinedRoom = {
  roomId: string;
  name: string;
};

export type SyncState = "idle" | "syncing" | "synced";

export type RoomDocument = {
  code: string;
  language: string;
};

export type YjsSyncPayload = {
  roomId: string;
  language: string;
  update: Uint8Array;
};

export type YjsUpdatePayload = {
  roomId: string;
  update: Uint8Array;
  updatedBy: string;
};

export type LanguageChangePayload = {
  roomId: string;
  language: string;
  updatedBy: string;
};

export type AwarenessUpdatePayload = {
  roomId: string;
  update: Uint8Array;
  updatedBy: string;
};

export type AwarenessUser = {
  name: string;
  color: string;
};
