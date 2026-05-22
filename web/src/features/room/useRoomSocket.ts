import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type {
  CodeChangePayload,
  ConnectionState,
  JoinedRoom,
  Participant,
  RoomDocument,
  RoomStatePayload,
  SyncState,
} from "./types";

type ParticipantsChangePayload = {
  roomId: string;
  participants: Participant[];
};

type UseRoomSocketOptions = {
  onRoomState: (document: RoomDocument) => void;
  onRemoteCodeChange: (document: RoomDocument) => void;
};

const DEFAULT_CONNECTION_STATE: ConnectionState = "connecting";
const SOCKET_URL = "http://localhost:3000";

export function useRoomSocket(options: UseRoomSocketOptions) {
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const optionsRef = useRef(options);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    DEFAULT_CONNECTION_STATE,
  );
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const joinedRoomRef = useRef<JoinedRoom>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

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
    socket.on("room-state", ({ code, language }: RoomStatePayload) => {
      optionsRef.current.onRoomState({ code, language });
      setSyncState("synced");
    });
    socket.on("code-change", ({ code, language }: CodeChangePayload) => {
      optionsRef.current.onRemoteCodeChange({ code, language });
      setSyncState("synced");
    });
    socket.io.on("reconnect_attempt", () => {
      setConnectionState("reconnecting");
    });
    socket.io.on("reconnect", () => {
      setConnectionState("connected");
      if (joinedRoomRef.current) {
        socket.emit("join-room", joinedRoomRef.current);
      }
    });
    socket.io.on("reconnect_failed", () => {
      setConnectionState("disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("participants-change");
      socket.off("room-state");
      socket.off("code-change");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.io.off("reconnect_failed");
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
    joinedRoomRef.current = nextRoom;
    setJoinedRoom(nextRoom);
  }

  const sendCodeChange = ({ code, language }: RoomDocument) => {
    const socket = socketRef.current;
    if (!socket || !joinedRoom) {
      return;
    }
    setSyncState("syncing");
    socket.emit("code-change", {
      roomId: joinedRoom.roomId,
      code,
      language,
    });
    setSyncState("synced");
  };

  return {
    connectionState,
    joinedRoom,
    participants,
    joinRoom,
    syncState,
    sendCodeChange,
  };
}
