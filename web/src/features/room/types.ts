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

export type RoomStatePayload = {
  roomId: string;
  code: string;
  language: string;
  participants: Participant[];
};

export type CodeChangePayload = {
  roomId: string;
  code: string;
  language: string;
  updatedBy: string;
};
