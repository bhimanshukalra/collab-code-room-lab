import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import * as Y from "yjs";
import { loadRoomDocument } from "./persistence.js";
import { saveRoomNow, scheduleRoomSave } from "./utils.js";

type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

export type RoomState = {
  doc: Y.Doc;
  language: string;
  participants: Map<string, Participant>;
};

type JoinRoomPayload = {
  roomId: string;
  name: string;
};

type YjsUpdatePayload = {
  roomId: string;
  update: Uint8Array;
};

type LanguageChangePayload = {
  roomId: string;
  language: string;
};

type AwarenessUpdatePayload = {
  roomId: string;
  update: Uint8Array;
};

const DEFAULT_CODE = `console.log('Hello world');`;
const DEFAULT_LANGUAGE = "typescript";

const app = express();
const server = http.createServer(app);

const PORT = 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map<string, RoomState>();

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-room", async ({ roomId, name }: JoinRoomPayload) => {
    const room = await getOrCreateRoom(roomId);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    room.participants.set(socket.id, {
      id: socket.id,
      name,
      joinedAt: new Date().toISOString(),
    });

    socket.emit("yjs-sync", {
      roomId,
      update: Y.encodeStateAsUpdate(room.doc),
      language: room.language,
    });

    io.to(roomId).emit("participants-change", {
      roomId,
      participants: getParticipants(room),
    });
  });

  socket.on("yjs-update", async ({ roomId, update }: YjsUpdatePayload) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room-error", { message: "Room not found." });
      return;
    }

    Y.applyUpdate(room.doc, update);

    scheduleRoomSave(roomId, room);

    socket.to(roomId).emit("yjs-update", {
      roomId,
      update,
      updatedBy: socket.id,
    });
  });

  socket.on(
    "language-change",
    async ({ roomId, language }: LanguageChangePayload) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("room-error", { message: "Room not found." });
        return;
      }

      room.language = language;

      scheduleRoomSave(roomId, room);

      socket.to(roomId).emit("language-change", {
        roomId,
        language,
        updatedBy: socket.id,
      });
    },
  );

  socket.on(
    "awareness-update",
    ({ roomId, update }: AwarenessUpdatePayload) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("room-error", { message: "Room not found." });
        return;
      }

      socket
        .to(roomId)
        .emit("awareness-update", { roomId, update, updatedBy: socket.id });
    },
  );

  socket.on("disconnect", () => {
    void handleDisconnect();
  });

  async function handleDisconnect() {
    console.log(`Socket disconnected: ${socket.id}`);
    const roomId = socket.data.roomId as string | undefined;

    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    room.participants.delete(socket.id);

    io.to(roomId).emit("participants-change", {
      roomId,
      participants: getParticipants(room),
    });

    if (room.participants.size === 0) {
      try {
        await saveRoomNow(roomId, room);
      } catch (error) {
        console.error(`Failed to save room ${roomId} before cleanup`, error);
      }

      room.doc.destroy();
      rooms.delete(roomId);
    }
  }
});

server.listen(PORT, () => {
  console.log(`Node server running at ${PORT}`);
});

async function getOrCreateRoom(roomId: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const persistedRoom = await loadRoomDocument(roomId);
  const doc = persistedRoom?.doc ?? new Y.Doc();

  if (!persistedRoom) {
    doc.getText("code").insert(0, DEFAULT_CODE);
  }

  const room: RoomState = {
    doc,
    language: persistedRoom?.language ?? DEFAULT_LANGUAGE,
    participants: new Map<string, Participant>(),
  };
  rooms.set(roomId, room);
  return room;
}

function getParticipants(room: RoomState) {
  return Array.from(room.participants.values());
}
