import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import * as Y from "yjs";

type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

type RoomState = {
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

  socket.on("join-room", ({ roomId, name }: JoinRoomPayload) => {
    const room = getOrCreateRoom(roomId);

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

  socket.on("yjs-update", ({ roomId, update }: YjsUpdatePayload) => {
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room-error", { message: "Room not found." });
      return;
    }

    Y.applyUpdate(room.doc, update);
    socket.to(roomId).emit("yjs-update", {
      roomId,
      update,
      updatedBy: socket.id,
    });
  });

  socket.on(
    "language-change",
    ({ roomId, language }: LanguageChangePayload) => {
      const room = rooms.get(roomId);

      if (!room) {
        socket.emit("room-error", { message: "Room not found." });
        return;
      }

      room.language = language;
      socket.to(roomId).emit("language-change", {
        roomId,
        language,
        updatedBy: socket.id,
      });
    },
  );

  socket.on("disconnect", () => {
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
      room.doc.destroy();
      rooms.delete(roomId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Node server running at ${PORT}`);
});

function getOrCreateRoom(roomId: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const doc = new Y.Doc();
  doc.getText("code").insert(0, DEFAULT_CODE);

  const room: RoomState = {
    doc,
    language: DEFAULT_LANGUAGE,
    participants: new Map<string, Participant>(),
  };
  rooms.set(roomId, room);
  return room;
}

function getParticipants(room: RoomState) {
  return Array.from(room.participants.values());
}
