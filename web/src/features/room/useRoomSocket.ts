import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { ConnectionState, JoinedRoom, Participant } from "./types";

type ParticipantsChangePayload = {
  roomId: string;
  participants: Participant[];
};

const DEFAULT_CONNECTION_STATE: ConnectionState = "connecting";
const SOCKET_URL = "http://localhost:3000";

export function useRoomSocket() {
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    DEFAULT_CONNECTION_STATE,
  );
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionState("connected");
    });
    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });
    socket.on(
      "participants-change",
      ({ participants }: ParticipantsChangePayload) => {
        setParticipants(participants);
      },
    );

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("participants-change");
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function joinRoom(nextRoom: JoinedRoom) {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    socket.emit("join-room", nextRoom);
    setJoinedRoom(nextRoom);
  }

  return { connectionState, joinedRoom, participants, joinRoom };
}
