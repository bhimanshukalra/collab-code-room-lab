export type ConnectionState = "connecting" | "connected" | "disconnected";

export type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

export type JoinedRoom = {
  roomId: string;
  name: string;
};
