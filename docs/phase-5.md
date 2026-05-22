# Phase 5: Reconnect And Recovery

Make the MVP feel stable when a socket disconnects, reconnects, or the browser refreshes. This phase keeps room state in memory only. Do not add a database, local storage persistence, Yjs, or production-grade conflict handling.

## Starting Point

You should already have:

- Phase 1 single-user Monaco editor complete
- Phase 2 socket connection complete
- Phase 3 rooms and participants complete
- Phase 4 full-document code sync complete
- server-side in-memory room state
- `room-state`, `participants-change`, and `code-change` events working
- `pnpm typecheck` passing

## Goal

By the end of this phase:

- the UI can show `connecting`, `connected`, `disconnected`, and `reconnecting`
- the client remembers the current joined room during the current React session
- the client re-emits `join-room` after Socket.IO reconnects
- rejoin receives the latest server `room-state`
- disconnects do not leave duplicate participants behind

## Step 1: Extend Connection State

Update `web/src/features/room/types.ts`.

Current:

```ts
export type ConnectionState = "connecting" | "connected" | "disconnected";
```

Change to:

```ts
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
```

Checkpoint:

- UI can represent reconnect attempts separately from fully disconnected state

## Step 2: Store Joined Room In A Ref

In `web/src/features/room/useRoomSocket.ts`, keep `joinedRoom` state for rendering, but also mirror it into a ref so socket event handlers can read the latest room without recreating the socket effect.

Suggested shape:

```ts
const joinedRoomRef = useRef<JoinedRoom | null>(null);

function joinRoom(nextRoom: JoinedRoom) {
  const socket = socketRef.current;

  if (!socket) {
    return;
  }

  socket.emit("join-room", nextRoom);
  joinedRoomRef.current = nextRoom;
  setJoinedRoom(nextRoom);
}
```

Checkpoint:

- socket event handlers can access the latest joined room
- the socket setup effect still has an empty dependency array

## Step 3: Handle Reconnect Events

Socket.IO has reconnect lifecycle events on `socket.io`, the manager behind the socket.

Inside the socket setup effect:

```ts
socket.io.on("reconnect_attempt", () => {
  setConnectionState("reconnecting");
});

socket.io.on("reconnect", () => {
  setConnectionState("connected");

  const room = joinedRoomRef.current;

  if (room) {
    socket.emit("join-room", room);
  }
});

socket.io.on("reconnect_failed", () => {
  setConnectionState("disconnected");
});
```

Keep the normal socket events:

```ts
socket.on("connect", () => {
  setConnectionState("connected");
});

socket.on("disconnect", () => {
  setConnectionState("disconnected");
});
```

Checkpoint:

- transient reconnect attempts show `reconnecting`
- successful reconnect rejoins the previous room
- rejoin triggers a fresh `room-state`

## Step 4: Clean Up Manager Listeners

When the hook unmounts, remove both socket listeners and manager listeners.

Suggested cleanup:

```ts
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
```

Checkpoint:

- React StrictMode does not leave duplicate listeners behind
- unmounting the app disconnects cleanly

## Step 5: Avoid Duplicate Participants

On the server, reconnecting creates a new socket id. The old socket should normally disconnect and be removed from the room, but timing can be messy.

For this MVP, keep participants keyed by socket id:

```ts
participants: Map<string, Participant>;
```

But make `join-room` idempotent for the current socket:

```ts
room.participants.set(socket.id, {
  id: socket.id,
  name,
  joinedAt: new Date().toISOString(),
});
```

That is already safe for duplicate `join-room` events from the same socket.

Optional cleanup improvement:

```ts
socket.data.roomId = roomId;
socket.data.name = name;
```

This makes logs/debugging easier, but is not required.

Checkpoint:

- re-emitting `join-room` from the same socket does not create duplicate entries
- reconnecting with a new socket id removes the old participant when the old socket disconnects

## Step 6: Show Reconnect State In The UI

`App.tsx` already renders socket state:

```tsx
<span>Socket: {connectionState}</span>
```

Keep that visible during reconnect testing.

Optional: add simple styles so `disconnected` or `reconnecting` is visually obvious.

Checkpoint:

- stopping the server changes the visible state away from `connected`
- restarting the server changes it back to `connected`

## Step 7: Understand Server Restart Limits

Because room state is in memory:

- browser refresh while the server is still running can restore latest room code after rejoin
- socket reconnect while the server is still running can restore latest room code after rejoin
- server restart deletes all rooms and code

Do not solve server restart persistence in this phase.

After a server restart, rejoining should still work, but the room will use default code and language.

Checkpoint:

- the app recovers connection after restart
- default room state after restart is expected

## Step 8: Run Checks

Run:

```sh
pnpm typecheck
```

Optional:

```sh
pnpm --filter web lint
```

## Manual Acceptance Test

Run both apps:

```sh
pnpm dev
```

Then:

- open `http://localhost:5173`
- join room `demo` as `Ada`
- type a few changes
- stop the server
- verify the UI shows `disconnected` or `reconnecting`
- restart the server
- verify the UI returns to `connected`
- verify the client rejoins room `demo`
- verify the server sends `room-state` after rejoin

For the in-memory server case:

- if the server was not restarted, latest room code should be restored
- if the server was restarted, default room code is expected

## Done Criteria

Phase 5 is complete when:

- `ConnectionState` includes `reconnecting`
- reconnect attempts update the UI
- successful reconnect re-emits `join-room` for the current room
- rejoin receives and applies `room-state`
- cleanup removes socket and manager listeners
- no duplicate participants appear after reconnect testing
- `pnpm typecheck` passes

Do not add database persistence, local storage persistence, Yjs, remote cursors, or patch-based sync in this phase.
