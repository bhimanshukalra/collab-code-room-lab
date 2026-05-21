# Phase 3: Rooms And Participants

Add room identity and in-memory presence. This phase proves that multiple browser tabs can join the same room and see the same participant list.

Do not sync editor code in this phase. Keep the editor local until Phase 4.

## Starting Point

You should already have:

- Phase 1 single-user editor complete
- Phase 2 socket connection complete
- `socket.io-client` installed in `web`
- `useRoomSocket` at `web/src/features/room/useRoomSocket.ts`
- an Express and Socket.IO server in `server/src/index.ts`
- `pnpm typecheck` passing

## Goal

By the end of this phase:

- users can enter a room id and display name
- the client emits `join-room`
- the server tracks participants in memory
- every client in the room receives participant updates
- closing a tab removes that participant from the room

## Step 1: Define Room Types

Create:

```text
web/src/features/room/types.ts
```

Use this client-side shape:

```ts
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
```

You can duplicate these types on the server for now. Shared packages can wait until the event contract stabilizes.

Checkpoint:

- room-related UI and hook code can import the same client types
- no shared workspace package is needed yet

## Step 2: Add Server Room State

In `server/src/index.ts`, add an in-memory room map.

Suggested state:

```ts
type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

type RoomState = {
  participants: Map<string, Participant>;
};

const rooms = new Map<string, RoomState>();
```

Add helpers:

```ts
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
```

Checkpoint:

- rooms are created lazily
- participants are keyed by socket id
- the server can convert participant maps into arrays before emitting

## Step 3: Handle `join-room`

Inside the server `connection` handler, listen for a `join-room` event.

Suggested payload:

```ts
type JoinRoomPayload = {
  roomId: string;
  name: string;
};
```

Suggested event:

```ts
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
```

Checkpoint:

- joining a room stores the participant
- the socket joins the matching Socket.IO room
- everyone in the room receives the full participant list

## Step 4: Remove Participants On Disconnect

Update the server disconnect handler.

Suggested shape:

```ts
socket.on("disconnect", () => {
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
```

Checkpoint:

- closing a tab removes only that socket's participant
- remaining participants receive an updated list
- empty rooms are cleaned up

## Step 5: Expand `useRoomSocket`

Update `web/src/features/room/useRoomSocket.ts`.

The hook should now return:

- `connectionState`
- `joinedRoom`
- `participants`
- `joinRoom`
- `leaveRoom` if you want an explicit leave button

Suggested API:

```ts
export function useRoomSocket() {
  return {
    connectionState,
    joinedRoom,
    participants,
    joinRoom,
  };
}
```

Suggested join function:

```ts
function joinRoom(nextRoom: JoinedRoom) {
  socket.emit("join-room", nextRoom);
  setJoinedRoom(nextRoom);
}
```

Implementation note:

- store the socket in a `useRef`
- register `participants-change` once in `useEffect`
- clean up all listeners and disconnect the socket in the effect cleanup

Checkpoint:

- `joinRoom({ roomId, name })` emits the expected server event
- `participants-change` updates React state
- socket cleanup still works

## Step 6: Add Join UI

Create:

```text
web/src/features/room/JoinRoomForm.tsx
```

The form should collect:

- room id
- display name

Submit behavior:

- prevent default form submission
- trim both fields
- do nothing if either field is empty
- call `joinRoom({ roomId, name })`

Checkpoint:

- users can join a room from the browser
- the form does not submit empty room ids or names

## Step 7: Add Participants UI

Create:

```text
web/src/features/room/ParticipantsList.tsx
```

Render:

- participant name
- optional socket id suffix for debugging
- optional joined timestamp for debugging

Checkpoint:

- one tab shows one participant after joining
- two tabs in the same room show two participants
- closing one tab removes it from the other tab's list

## Step 8: Wire Room UI Into `App.tsx`

Use the room hook in `App.tsx`.

Render the room controls near the editor controls:

```tsx
const { connectionState, joinedRoom, participants, joinRoom } = useRoomSocket();
```

Suggested layout:

- connection state
- join room form if not joined
- current room id if joined
- participants list
- editor

Checkpoint:

- the editor still works locally
- joining a room does not reset editor code
- participants update independently of editor typing

## Step 9: Run Checks

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

- open `http://localhost:5173` in tab A
- join room `demo` as `Ada`
- open `http://localhost:5173` in tab B
- join room `demo` as `Grace`
- verify both tabs show Ada and Grace
- close tab B
- verify tab A only shows Ada

## Done Criteria

Phase 3 is complete when:

- the web app has a room id input
- the web app has a display name input
- the client emits `join-room`
- the server tracks participants by room in memory
- all clients in a room receive `participants-change`
- closing a tab removes that participant
- `pnpm typecheck` passes

Do not add code sync, reconnect recovery, persistence, Yjs, or remote cursors in this phase.
