# Phase 7: Remote Cursors And Selections

Add remote cursor and selection presence with Yjs awareness. Text synchronization already uses Yjs updates; this phase adds ephemeral collaboration state on top.

Do not store cursors or selections in the durable room document. Awareness state is temporary and should disappear when a participant disconnects.

## Starting Point

You should already have:

- Yjs document sync working
- Monaco bound to `Y.Text` with `MonacoBinding`
- `yjs-sync` and `yjs-update` socket events working
- room join and participant presence working
- display names available through `JoinedRoom`
- `y-protocols` installed in `web`
- `pnpm typecheck` passing

Current important files:

```text
web/src/App.tsx
web/src/features/editor/useYjsDocument.ts
web/src/features/room/useRoomSocket.ts
web/src/features/room/types.ts
server/src/index.ts
```

## Goal

By the end of this phase:

- each joined user has an awareness identity
- local Monaco cursor and selection changes are published
- remote cursors and selections render inside Monaco
- awareness state clears when a user disconnects
- text sync, language sync, and participants still work

## Step 1: Add Awareness To The Document Hook

Update:

```text
web/src/features/editor/useYjsDocument.ts
```

Import awareness:

```ts
import { Awareness } from "y-protocols/awareness";
```

Create one awareness instance for the local Yjs document:

```ts
const awareness = useMemo(() => new Awareness(doc), [doc]);
```

Destroy it on unmount:

```ts
useEffect(() => {
  return () => {
    awareness.destroy();
    doc.destroy();
  };
}, [awareness, doc]);
```

Return it:

```ts
return { awareness, doc, text };
```

Checkpoint:

- `useYjsDocument` returns `awareness`
- awareness and document are created once per editor session
- cleanup destroys both

## Step 2: Define Awareness Event Types

Update:

```text
web/src/features/room/types.ts
```

Add awareness payloads:

```ts
export type AwarenessUpdatePayload = {
  roomId: string;
  update: Uint8Array;
  updatedBy: string;
};
```

Optionally add user metadata:

```ts
export type AwarenessUser = {
  name: string;
  color: string;
};
```

Server can duplicate the payload type locally for now.

Checkpoint:

- client socket code has typed awareness payloads
- no shared package is needed yet

## Step 3: Relay Awareness Updates On The Server

Update:

```text
server/src/index.ts
```

Add a payload type:

```ts
type AwarenessUpdatePayload = {
  roomId: string;
  update: Uint8Array;
};
```

Add a relay event inside the Socket.IO connection handler:

```ts
socket.on("awareness-update", ({ roomId, update }: AwarenessUpdatePayload) => {
  const room = rooms.get(roomId);

  if (!room) {
    socket.emit("room-error", { message: "Room not found." });
    return;
  }

  socket.to(roomId).emit("awareness-update", {
    roomId,
    update,
    updatedBy: socket.id,
  });
});
```

The server should not store awareness updates. It only relays them.

Checkpoint:

- awareness updates are broadcast to other sockets in the same room
- server room state does not persist awareness

## Step 4: Extend `useRoomSocket` With Awareness

Update:

```text
web/src/features/room/useRoomSocket.ts
```

Import protocol helpers:

```ts
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
```

Update hook options:

```ts
type UseRoomSocketOptions = {
  awareness: Awareness;
  doc: Y.Doc;
  onLanguageChange: (language: string) => void;
};
```

Listen for remote awareness:

```ts
socket.on("awareness-update", ({ update }: AwarenessUpdatePayload) => {
  applyAwarenessUpdate(
    optionsRef.current.awareness,
    new Uint8Array(update),
    "remote",
  );
});
```

Emit local awareness changes:

```ts
const handleAwarenessUpdate = (
  changed: { added: number[]; updated: number[]; removed: number[] },
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
```

Cleanup:

```ts
socket.off("awareness-update");
optionsRef.current.awareness.off("update", handleAwarenessUpdate);
```

Checkpoint:

- remote awareness updates apply locally
- local awareness updates are emitted after joining
- awareness listeners are cleaned up

## Step 5: Set Local Awareness User State

Update:

```text
web/src/App.tsx
```

Pass awareness from the document hook:

```ts
const { awareness, doc, text } = useYjsDocument();
```

Pass awareness to the room hook:

```ts
useRoomSocket({
  awareness,
  doc,
  onLanguageChange: handleLanguageChange,
});
```

Set local user metadata when joining a room. The current `joinedRoom` has the display name:

```ts
useEffect(() => {
  if (!joinedRoom) {
    awareness.setLocalState(null);
    return;
  }

  awareness.setLocalStateField("user", {
    name: joinedRoom.name,
    color: getParticipantColor(joinedRoom.name),
  });
}, [awareness, joinedRoom]);
```

Add a simple stable color helper:

```ts
const PARTICIPANT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
];

function getParticipantColor(name: string) {
  const index = Array.from(name).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );

  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
}
```

Checkpoint:

- local awareness state includes user name and color
- awareness state clears before joining or after leaving

## Step 6: Pass Awareness To `MonacoBinding`

Update the Monaco binding in:

```text
web/src/App.tsx
```

Current shape:

```ts
bindingRef.current = new MonacoBinding(text, model, new Set([editor]));
```

Change to:

```ts
bindingRef.current = new MonacoBinding(
  text,
  model,
  new Set([editor]),
  awareness,
);
```

This lets `y-monaco` publish local selections and render remote selections.

Checkpoint:

- Monaco binding receives awareness
- cursor movement emits awareness updates
- remote selections can render

## Step 7: Add Remote Selection Styles

`y-monaco` renders decorations with class names such as:

```text
yRemoteSelection
yRemoteSelectionHead
```

Add basic styles in:

```text
web/src/index.css
```

Example:

```css
.yRemoteSelection {
  background-color: rgba(37, 99, 235, 0.2);
}

.yRemoteSelectionHead {
  border-left: 2px solid #2563eb;
  box-sizing: border-box;
}
```

For per-user colors, `y-monaco` also uses client-specific classes. Start with one neutral style first.

Checkpoint:

- remote selections are visible
- remote cursor head is visible
- styling does not interfere with normal Monaco selection

## Step 8: Clear Awareness On Disconnect Or Unmount

In `useRoomSocket`, cleanup should clear local awareness before disconnecting:

```ts
optionsRef.current.awareness.setLocalState(null);
```

In `App.tsx`, if you later add explicit leave-room, clear awareness there too.

Checkpoint:

- closing a tab removes remote cursor/selection from other tabs
- reconnecting republishes awareness after rejoining

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
- click inside Monaco in tab A
- verify tab B sees tab A's cursor
- select text in tab A
- verify tab B sees tab A's selection
- type in either tab
- verify Yjs text sync still works
- close tab A
- verify tab A's cursor/selection disappears from tab B

## Done Criteria

Phase 7 is complete when:

- `useYjsDocument` creates and returns awareness
- the server relays `awareness-update`
- `useRoomSocket` sends and applies awareness updates
- `App.tsx` sets local awareness user metadata
- `MonacoBinding` receives awareness
- remote cursors and selections render in Monaco
- awareness clears on disconnect or unmount
- text sync, language sync, participants, reconnect, and rejoin still work
- `pnpm typecheck` passes

## Non-Goals

- persistence
- database-backed presence
- auth or permissions
- avatars or rich user profiles
- production multi-server awareness scaling
