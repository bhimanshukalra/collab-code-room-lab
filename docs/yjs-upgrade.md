# Yjs Upgrade

Replace the full-document sync MVP with Yjs-backed collaborative editing. Do this only after Phase 4 and Phase 5 are working and manually tested.

The goal is to keep the existing room, participant, and connection shell while replacing the document synchronization engine.

## Starting Point

You should already have:

- room join flow
- participants list
- connection and reconnect state
- full-document `code-change` sync
- server-side in-memory room state
- Monaco editor rendering in the web app
- `pnpm typecheck` passing

## Why Upgrade

The current MVP sends the whole code string on every edit. That is useful for learning, but it has limits:

- simultaneous edits can overwrite each other
- large files send too much data
- cursor and selection presence are awkward to add
- conflict handling would become custom collaboration logic

Yjs gives the editor a CRDT-backed shared document so concurrent edits can merge without the app inventing its own sync algorithm.

## What Stays

Keep these pieces:

- room id
- display name
- join room form
- participants list
- socket connection state
- reconnect/rejoin behavior
- server as room authority
- Monaco as the editor UI

The room shell is still valuable. Only the document sync mechanism changes.

## What Changes

Replace:

```text
Monaco edit
-> React code state
-> socket emits full code string
-> server stores room.code
-> server broadcasts full code string
-> remote client replaces editor value
```

With:

```text
Monaco edit
-> Y.Text update
-> Yjs emits binary update
-> socket sends binary update
-> server applies update to room Y.Doc
-> server broadcasts binary update
-> remote Y.Doc merges update
-> Monaco binding updates editor
```

## Step 1: Install Yjs Packages

Install the client and server dependencies:

```sh
pnpm --filter web add yjs y-monaco
pnpm --filter server add yjs
```

Optional if you want to experiment with WebRTC before using the app server:

```sh
pnpm --filter web add y-webrtc
```

For this repository, prefer the server-backed Socket.IO path so room behavior stays consistent with the existing app.

Checkpoint:

- `yjs` is available in both packages
- `y-monaco` is available in `web`
- `pnpm-lock.yaml` updates

## Step 2: Replace Server Code Storage

Current room state:

```ts
type RoomState = {
  code: string;
  language: string;
  participants: Map<string, Participant>;
};
```

Yjs room state:

```ts
import * as Y from "yjs";

type RoomState = {
  doc: Y.Doc;
  language: string;
  participants: Map<string, Participant>;
};
```

Create a `Y.Doc` when a room is created:

```ts
const room: RoomState = {
  doc: new Y.Doc(),
  language: DEFAULT_LANGUAGE,
  participants: new Map<string, Participant>(),
};
```

Checkpoint:

- the server stores a `Y.Doc` per room
- `room.code` no longer exists
- language can remain a normal room field for now

## Step 3: Send A Yjs Snapshot On Join

When a client joins or rejoins, send the current Yjs document snapshot:

```ts
socket.emit("yjs-sync", {
  roomId,
  update: Y.encodeStateAsUpdate(room.doc),
  language: room.language,
});
```

Keep participant events unchanged:

```ts
io.to(roomId).emit("participants-change", {
  roomId,
  participants: getParticipants(room),
});
```

Checkpoint:

- join still updates participants
- join sends a Yjs snapshot to the joining socket
- refreshed clients can reconstruct the latest in-memory document

## Step 4: Replace `code-change` With `yjs-update`

Remove or stop using the full-string `code-change` event.

Add a server event:

```ts
type YjsUpdatePayload = {
  roomId: string;
  update: Uint8Array;
};

socket.on("yjs-update", ({ roomId, update }: YjsUpdatePayload) => {
  const room = rooms.get(roomId);

  if (!room) {
    socket.emit("room-error", { message: "Room not found." });
    return;
  }

  Y.applyUpdate(room.doc, update);

  socket.to(roomId).emit("yjs-update", {
    roomId,
    update,
    updatedBy: socket.id,
  });
});
```

Checkpoint:

- server applies every incoming Yjs update
- server broadcasts updates to other sockets in the room
- sender does not receive its own update

## Step 5: Create A Document Hook

Create:

```text
web/src/features/editor/useYjsDocument.ts
```

This hook should own:

- `Y.Doc`
- `Y.Text`
- socket listeners for `yjs-sync` and `yjs-update`
- emitting local Yjs updates

Suggested shape:

```ts
import { useEffect, useMemo } from "react";
import * as Y from "yjs";

export function useYjsDocument() {
  const doc = useMemo(() => new Y.Doc(), []);
  const text = useMemo(() => doc.getText("code"), [doc]);

  useEffect(() => {
    return () => {
      doc.destroy();
    };
  }, [doc]);

  return { doc, text };
}
```

You may keep socket wiring in `useRoomSocket`, but a separate editor/document hook makes the migration easier to reason about.

Checkpoint:

- document lifecycle is separate from room UI
- the Yjs document is created once per editor session
- the document is destroyed on unmount

## Step 6: Bind Monaco To Y.Text

Use `MonacoBinding` from `y-monaco`.

Conceptual shape:

```ts
const binding = new MonacoBinding(
  yText,
  editor.getModel(),
  new Set([editor]),
  awareness,
);
```

If you are not using Yjs awareness yet, start with document binding only and add awareness after text sync works.

Important:

- do not keep React `currentCode` as the source of truth
- do not replace Monaco value manually on every remote update
- let the Yjs binding update Monaco

Checkpoint:

- local Monaco edits update `Y.Text`
- remote Yjs updates update Monaco
- React state no longer drives editor text

## Step 7: Wire Socket Updates To Y.Doc

Client-side event flow:

```ts
socket.on("yjs-sync", ({ update }) => {
  Y.applyUpdate(doc, new Uint8Array(update));
});

socket.on("yjs-update", ({ update }) => {
  Y.applyUpdate(doc, new Uint8Array(update));
});

doc.on("update", (update) => {
  if (!joinedRoom) {
    return;
  }

  socket.emit("yjs-update", {
    roomId: joinedRoom.roomId,
    update,
  });
});
```

Watch out for duplicate sends:

- `doc.on("update")` fires for both local and remote-applied updates
- use Yjs transaction origins or a small guard if needed to avoid echo loops
- because the server broadcasts with `socket.to(roomId)`, the sender should not receive its own update from the server

Checkpoint:

- joining receives the server snapshot
- typing emits Yjs updates
- remote clients apply Yjs updates

## Step 8: Keep Language Sync Simple

Language is not text content. Keep it as a normal room field and event for now.

Options:

- keep the existing language part of `code-change` as a new `language-change` event
- or store language in a Yjs map, such as `doc.getMap("metadata")`

Recommended first pass:

```ts
socket.emit("language-change", {
  roomId,
  language,
});
```

Checkpoint:

- editor language mode still syncs
- code text sync does not depend on language sync

## Step 9: Add Awareness Later

Awareness is for ephemeral presence:

- display name
- cursor position
- selection
- typing state
- user color

Do not add awareness until text sync is working.

Later:

```ts
awareness.setLocalStateField("user", {
  name,
  color,
});
```

Checkpoint:

- participant list still works before awareness
- awareness is treated as ephemeral UI state, not document state

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
- type in both tabs at the same time
- verify text merges without obvious overwrite bugs
- refresh tab A and rejoin
- verify tab A receives the latest document snapshot
- verify participants still update correctly

## Done Criteria

The Yjs upgrade is complete when:

- the server stores a `Y.Doc` per room
- joining sends a Yjs snapshot
- clients exchange `yjs-update` events
- Monaco is bound to `Y.Text`
- full-string `code-change` is removed from editor text sync
- two participants can type at the same time without obvious overwrite bugs
- reconnect/rejoin still restores the latest in-memory document
- participants still work
- `pnpm typecheck` passes

## Non-Goals

- database persistence
- production scaling
- remote cursor rendering in the first Yjs pass
- custom patch algorithms
- WebRTC transport in the main app path
- authentication or permissions
