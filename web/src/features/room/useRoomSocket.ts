import { useEffect, useState } from "react";
import { io } from "socket.io-client";

type ConnectionState = "connecting" | "connected" | "disconnected";

const DEFAULT_CONNECTION_STATE: ConnectionState = "connecting";
const SOCKET_URL = "http://localhost:3000";

export function useRoomSocket() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    DEFAULT_CONNECTION_STATE,
  );

  useEffect(() => {
    const socket = io(SOCKET_URL);

    socket.on("connect", () => {
      setConnectionState("connected");
    });
    socket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { connectionState };
}
