import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as Y from "yjs";
import type {
  AwarenessUpdatePayload,
  ConnectionState,
  JoinedRoom,
  LanguageChangePayload,
  Participant,
  SyncState,
  YjsSyncPayload,
  YjsUpdatePayload,
} from "./types";
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  type Awareness,
} from "y-protocols/awareness.js";

type ParticipantsChangePayload = {
  roomId: string;
  participants: Participant[];
};

type UseRoomSocketOptions = {
  doc: Y.Doc;
  onLanguageChange: (language: string) => void;
  awareness: Awareness;
};

const DEFAULT_CONNECTION_STATE: ConnectionState = "connecting";
const SOCKET_URL = "http://localhost:3000";
const REMOTE_UPDATE_ORIGIN = "remote";

export function useRoomSocket(options: UseRoomSocketOptions) {
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const optionsRef = useRef(options);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    DEFAULT_CONNECTION_STATE,
  );
  const [joinedRoom, setJoinedRoom] = useState<JoinedRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const joinedRoomRef = useRef<JoinedRoom | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const publishAwarenessState = () => {
      const room = joinedRoomRef.current;

      if (!room || !optionsRef.current.awareness.getLocalState()) {
        return;
      }

      socket.emit("awareness-update", {
        roomId: room.roomId,
        update: encodeAwarenessUpdate(optionsRef.current.awareness, [
          optionsRef.current.awareness.clientID,
        ]),
      });
    };

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
        publishAwarenessState();
      },
    );
    socket.on("yjs-sync", ({ update, language }: YjsSyncPayload) => {
      Y.applyUpdate(
        optionsRef.current.doc,
        new Uint8Array(update),
        REMOTE_UPDATE_ORIGIN,
      );
      optionsRef.current.onLanguageChange(language);
      setSyncState("synced");
    });
    socket.on("yjs-update", ({ update }: YjsUpdatePayload) => {
      Y.applyUpdate(
        optionsRef.current.doc,
        new Uint8Array(update),
        REMOTE_UPDATE_ORIGIN,
      );
      setSyncState("synced");
    });
    socket.on("language-change", ({ language }: LanguageChangePayload) => {
      optionsRef.current.onLanguageChange(language);
    });
    socket.on("awareness-update", ({ update }: AwarenessUpdatePayload) => {
      applyAwarenessUpdate(
        optionsRef.current.awareness,
        new Uint8Array(update),
        "remote",
      );
    });

    const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_UPDATE_ORIGIN || !joinedRoomRef.current) {
        return;
      }

      setSyncState("syncing");
      socket.emit("yjs-update", {
        roomId: joinedRoomRef.current.roomId,
        update,
      });
      setSyncState("synced");
    };

    optionsRef.current.doc.on("update", handleDocUpdate);

    const handleAwarenessUpdate = (
      changed: {
        added: number[];
        updated: number[];
        removed: number[];
      },
      origin: unknown,
    ) => {
      if (origin === "remote" || !joinedRoomRef.current) {
        return;
      }

      const changedClients = [
        ...changed.added,
        ...changed.updated,
        ...changed.removed,
      ];

      socket.emit("awareness-update", {
        roomId: joinedRoomRef.current.roomId,
        update: encodeAwarenessUpdate(
          optionsRef.current.awareness,
          changedClients,
        ),
      });
    };

    optionsRef.current.awareness.on("update", handleAwarenessUpdate);

    socket.io.on("reconnect_attempt", () => {
      setConnectionState("reconnecting");
    });
    socket.io.on("reconnect", () => {
      setConnectionState("connected");
      if (joinedRoomRef.current) {
        socket.emit("join-room", joinedRoomRef.current);
        publishAwarenessState();
      }
    });
    socket.io.on("reconnect_failed", () => {
      setConnectionState("disconnected");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("participants-change");
      socket.off("yjs-sync");
      socket.off("yjs-update");
      socket.off("language-change");
      socket.off("awareness-update");
      optionsRef.current.doc.off("update", handleDocUpdate);
      optionsRef.current.awareness.off("update", handleAwarenessUpdate);
      optionsRef.current.awareness.setLocalState(null);
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

  function sendLanguageChange(language: string) {
    const socket = socketRef.current;

    if (!socket || !joinedRoomRef.current) {
      return;
    }

    socket.emit("language-change", {
      roomId: joinedRoomRef.current.roomId,
      language,
    });
  }

  return {
    connectionState,
    joinedRoom,
    participants,
    joinRoom,
    syncState,
    sendLanguageChange,
  };
}
