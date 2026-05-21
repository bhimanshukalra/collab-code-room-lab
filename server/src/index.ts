import express from "express";
import http from "node:http";
import { Server } from "socket.io";

type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

type RoomState = {
  participants: Map<string, Participant>;
};

type JoinRoomPayload = {
  roomId: string;
  name: string;
};

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

    room.participants.set(socket.id, {
      id: socket.id,
      name,
      joinedAt: new Date().toISOString(),
    });

    io.to(roomId).emit("participants-change", {
      roomId,
      participants: getParticipants(room),
    });
  });

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

  const room = { participants: new Map<string, Participant>() };
  rooms.set(roomId, room);
  return room;
}

function getParticipants(room: RoomState) {
  return Array.from(room.participants.values());
}
