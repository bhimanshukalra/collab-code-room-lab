# Phase 2: WebSocket Server

Connect the single-user editor to a tiny Socket.IO backend. This phase does not add rooms, participants, or code sync yet. It only proves that the browser can connect to the server and that disconnects are visible.

## Starting Point

You should already have:

- Phase 1 complete
- an Express server in `server/src/index.ts`
- Socket.IO attached to the same HTTP server
- a `/health` route
- server connection and disconnect logs
- root scripts such as `pnpm dev`, `pnpm dev:web`, `pnpm dev:server`, and `pnpm typecheck`

Current server shape:

```ts
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});
```

## Step 1: Verify The Server Alone

Start the server:

```sh
pnpm dev:server
```

Expected terminal output:

```text
Node server running at 3000
```

Open the health route:

```text
http://localhost:3000/health
```

Expected response:

```json
{ "ok": true }
```

Checkpoint:

- the server starts without TypeScript errors
- `/health` returns `{ "ok": true }`
- the server listens on one port, `3000`

## Step 2: Install The Client Socket Package

The server uses `socket.io`. The web app needs `socket.io-client`.

Install it in the `web` package:

```sh
pnpm --filter web add socket.io-client
```

Checkpoint:

- `socket.io-client` appears in `web/package.json`
- `pnpm-lock.yaml` updates

## Step 3: Create A Socket Hook

Create:

```text
web/src/features/room/useRoomSocket.ts
```

For Phase 2, keep the hook intentionally small. It should connect when the app mounts and disconnect when the app unmounts.

Suggested state:

```ts
type ConnectionState = "connecting" | "connected" | "disconnected";
```

Suggested first pass:

```ts
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

type ConnectionState = "connecting" | "connected" | "disconnected";

export function useRoomSocket() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");

  useEffect(() => {
    const socket = io("http://localhost:3000");

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
```

Checkpoint:

- the hook creates one socket connection
- the hook cleans up by calling `socket.disconnect()`
- connection state changes when the socket connects or disconnects

## Step 4: Show Connection State In The App

Use the hook in `web/src/App.tsx`.

Example:

```tsx
const { connectionState } = useRoomSocket();
```

Render the state near the editor controls:

```tsx
<span>Socket: {connectionState}</span>
```

Checkpoint:

- the browser shows `Socket: connected` when the server is running
- the server logs `Socket connected: <socket-id>`

## Step 5: Verify Disconnect Logging

With both apps running:

```sh
pnpm dev
```

Open:

```text
http://localhost:5173
```

Then close the browser tab.

Expected server logs:

```text
Socket connected: <socket-id>
Socket disconnected: <socket-id>
```

Checkpoint:

- opening the web app logs a socket connection
- closing the tab logs a socket disconnect
- refreshing the tab creates a new connection and disconnects the old one

## Step 6: Run Checks

Run:

```sh
pnpm typecheck
```

Optional:

```sh
pnpm --filter web lint
```

## Done Criteria

Phase 2 is complete when:

- the server starts successfully
- `/health` returns `{ "ok": true }`
- the web app connects to Socket.IO on `http://localhost:3000`
- the app shows the current socket connection state
- the server logs browser connect and disconnect events
- `pnpm typecheck` passes

Do not add rooms, participants, code sync, reconnect recovery, or Yjs in this phase.
