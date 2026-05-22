# Phase 4: Basic Code Sync

Add the simplest useful collaboration loop: when one participant edits code, the other participants in the same room see the latest full document.

This phase intentionally sends the whole code string on change. That is acceptable for the MVP because it keeps the room flow easy to understand before introducing patches, CRDTs, Yjs, or persistence.

## Starting Point

You should already have:

- Phase 1 single-user Monaco editor complete
- Phase 2 socket connection complete
- Phase 3 rooms and participants complete
- `join-room` working
- `participants-change` working
- `pnpm typecheck` passing

## Goal

By the end of this phase:

- the server stores the latest code and language for each room
- the client emits full-document code changes after joining a room
- the server broadcasts code changes to other participants in the room
- a refreshed tab receives the latest room code
- the sender does not need to re-apply its own update

## Step 1: Extend Room Types

Update `web/src/features/room/types.ts`.

Add a sync state:

```ts
export type SyncState = "idle" | "syncing" | "synced";
```

Add room document payloads:

```ts
export type RoomDocument = {
  code: string;
  language: string;
};

export type RoomStatePayload = {
  roomId: string;
  code: string;
  language: string;
  participants: Participant[];
};

export type CodeChangePayload = {
  roomId: string;
  code: string;
  language: string;
  updatedBy: string;
};
```

Checkpoint:

- client code can type room state and code-change events
- `Participant` remains unchanged

## Step 2: Extend Server Room State

Update the server `RoomState`.

Current:

```ts
type RoomState = {
  participants: Map<string, Participant>;
};
```

Change to:

```ts
type RoomState = {
  code: string;
  language: string;
  participants: Map<string, Participant>;
};
```

Create defaults:

```ts
const DEFAULT_CODE = `console.log('Hello world');`;
const DEFAULT_LANGUAGE = "typescript";
```

Update `getOrCreateRoom`:

```ts
const room = {
  code: DEFAULT_CODE,
  language: DEFAULT_LANGUAGE,
  participants: new Map<string, Participant>(),
};
```

Checkpoint:

- every room has code and language from creation
- room state still remains in memory only

## Step 3: Send Room State On Join

After adding the participant in `join-room`, emit the current room state to the joining socket.

Suggested event:

```ts
socket.emit("room-state", {
  roomId,
  code: room.code,
  language: room.language,
  participants: getParticipants(room),
});
```

Keep broadcasting `participants-change` to the room:

```ts
io.to(roomId).emit("participants-change", {
  roomId,
  participants: getParticipants(room),
});
```

Checkpoint:

- a new participant receives the latest code and language
- all participants still receive participant updates

## Step 4: Handle `code-change` On The Server

Add a payload type:

```ts
type CodeChangePayload = {
  roomId: string;
  code: string;
  language: string;
};
```

Add a server event:

```ts
socket.on("code-change", ({ roomId, code, language }: CodeChangePayload) => {
  const room = rooms.get(roomId);

  if (!room) {
    socket.emit("room-error", { message: "Room not found." });
    return;
  }

  room.code = code;
  room.language = language;

  socket.to(roomId).emit("code-change", {
    roomId,
    code,
    language,
    updatedBy: socket.id,
  });
});
```

Use `socket.to(roomId)` so the sender does not receive its own update.

Checkpoint:

- server stores the latest full document
- remote participants receive code updates
- sender keeps its local editor state without re-applying its own event

## Step 5: Expand `useRoomSocket`

Update `web/src/features/room/useRoomSocket.ts`.

The hook should accept callbacks or return event handlers so `App.tsx` can keep owning editor state.

Recommended API:

```ts
type UseRoomSocketOptions = {
  onRoomState: (document: RoomDocument) => void;
  onRemoteCodeChange: (document: RoomDocument) => void;
};

export function useRoomSocket(options: UseRoomSocketOptions) {
  return {
    connectionState,
    joinedRoom,
    participants,
    syncState,
    joinRoom,
    sendCodeChange,
  };
}
```

Add listeners:

```ts
socket.on("room-state", ({ code, language }: RoomStatePayload) => {
  options.onRoomState({ code, language });
  setSyncState("synced");
});

socket.on("code-change", ({ code, language }: CodeChangePayload) => {
  options.onRemoteCodeChange({ code, language });
  setSyncState("synced");
});
```

Add a sender:

```ts
function sendCodeChange(document: RoomDocument) {
  const socket = socketRef.current;

  if (!socket || !joinedRoom) {
    return;
  }

  setSyncState("syncing");
  socket.emit("code-change", {
    roomId: joinedRoom.roomId,
    ...document,
  });
  setSyncState("synced");
}
```

Checkpoint:

- joining a room can apply server room state to the editor
- remote code changes update local editor state
- local code changes can be emitted to the room

## Step 6: Emit Editor Changes From `App.tsx`

When Monaco changes:

```ts
const onChangeCode = (value: string | undefined) => {
  const nextCode = value ?? "";
  setCurrentCode(nextCode);

  if (joinedRoom) {
    sendCodeChange({
      code: nextCode,
      language: selectedLanguage,
    });
  }
};
```

When language changes:

```ts
setSelectedLanguage(nextLanguage);

if (joinedRoom) {
  sendCodeChange({
    code: currentCode,
    language: nextLanguage,
  });
}
```

For this first pass, it is okay to send on every editor change. If it feels noisy, add a small debounce later.

Checkpoint:

- typing in tab A updates tab B
- changing language in tab A updates tab B
- local typing before joining still works

## Step 7: Apply Server Room State In `App.tsx`

Pass callbacks into the hook:

```tsx
const {
  connectionState,
  joinedRoom,
  participants,
  syncState,
  joinRoom,
  sendCodeChange,
} = useRoomSocket({
  onRoomState: ({ code, language }) => {
    setCurrentCode(code);
    setSelectedLanguage(language);
  },
  onRemoteCodeChange: ({ code, language }) => {
    setCurrentCode(code);
    setSelectedLanguage(language);
  },
});
```

If TypeScript complains about `language` being a plain string, validate it with the existing `isLanguage` guard before calling `setSelectedLanguage`.

Checkpoint:

- refresh after joining receives the latest room code
- remote updates do not break language state typing

## Step 8: Show Sync State

Render sync state near the room/editor controls:

```tsx
<span>Sync: {syncState}</span>
```

Suggested behavior:

- `idle` before joining a room
- `syncing` briefly when sending local changes
- `synced` after local send or remote receive

Checkpoint:

- users can see whether sync is active
- sync state is separate from socket connection state

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
- type in tab A
- verify tab B updates
- type in tab B
- verify tab A updates
- change language in tab A
- verify tab B changes language
- refresh tab A and rejoin `demo`
- verify tab A receives the latest room code

## Known Limitations

- Full-document sync can overwrite simultaneous edits.
- No version checks yet.
- No debounce yet.
- No persistence after server restart.
- No reconnect recovery beyond a fresh join.
- No Yjs or CRDT behavior yet.

These limitations are acceptable for Phase 4.

## Done Criteria

Phase 4 is complete when:

- rooms store latest code and language in memory
- joining a room sends the latest room state to the client
- local editor changes emit `code-change`
- remote editor changes update other participants
- language changes sync between participants
- refreshing and rejoining restores latest in-memory room code
- `pnpm typecheck` passes

Do not add Yjs, persistence, remote cursors, patch sync, or production reconnect recovery in this phase.
