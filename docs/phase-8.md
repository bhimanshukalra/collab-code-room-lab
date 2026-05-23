# Phase 8: Optional Yjs Persistence

Persist room documents so code survives a server restart. This phase should stay focused on document state only. Do not persist participants, sockets, remote cursors, selections, or awareness.

Persistence is optional for this lab. Add it only after Yjs text sync and remote cursors are working reliably.

## Starting Point

You should already have:

- room join and participant presence working
- Monaco bound to a `Y.Text`
- server-side in-memory `Y.Doc` per room
- `yjs-sync` sent when a participant joins
- `yjs-update` applied to the server room document
- `yjs-update` broadcast to other room participants
- Yjs awareness remote cursors working
- `pnpm typecheck` passing

Current important files:

```text
server/src/index.ts
web/src/features/room/useRoomSocket.ts
web/src/features/editor/useYjsDocument.ts
web/src/App.tsx
```

Likely new server files:

```text
server/src/persistence.ts
server/src/rooms.ts
server/data/
```

`rooms.ts` is optional, but recommended if `server/src/index.ts` starts getting too large.

## Goal

By the end of this phase:

- server room documents can be restored after restart
- Yjs document updates are persisted when edits happen
- first join after restart loads the stored room document
- awareness state remains temporary
- participants remain temporary
- stale rooms have a clear cleanup policy

Acceptance check:

- Start the server and web app.
- Join a room.
- Type code.
- Stop the server.
- Restart the server.
- Rejoin the same room.
- The latest code is restored.
- Remote cursors are not restored, because they are awareness state.

## Recommended Approach

Use snapshots first.

For this lab, the simplest useful persistence model is:

- keep using one in-memory `Y.Doc` per active room
- save a compact Yjs snapshot after document updates
- load that snapshot when the room is created
- ignore persistence for awareness and participants

The snapshot is produced with:

```ts
Y.encodeStateAsUpdate(room.doc)
```

The snapshot is restored with:

```ts
Y.applyUpdate(doc, snapshot)
```

This is not the most advanced storage model, but it is easy to understand and good enough for a learning project.

## Snapshot vs Update Log

There are two common persistence models.

Snapshot model:

- Store the latest full Yjs state update for each room.
- Replace the previous snapshot on save.
- Restore one snapshot when the room is created.
- Simple to build and debug.
- Good for this lab.

Update log model:

- Store every incremental Yjs update.
- Replay all updates when the room is created.
- Preserves history if you need it later.
- Can become slow if a room has many updates.
- Usually needs compaction or periodic snapshots.

Recommended Phase 8 choice:

- Start with snapshots.
- Add an update log only if you later want audit history, conflict debugging, or replay.

## Step 1: Choose A Storage Target

Pick one storage target before coding.

Good lab options:

- File snapshots: easiest to understand, no database dependency.
- SQLite: still local, but closer to real app persistence.

Good later production options:

- Postgres: durable relational persistence.
- Redis: useful for ephemeral or short-lived rooms, but needs persistence settings if restarts matter.
- Object storage: useful for large snapshots or archival.

Recommended for this repo:

- Use file snapshots for the first pass, or SQLite if you specifically want database practice.

File snapshots are enough because the repo currently has no auth, no workspace ids, no permissions, and no multi-server deployment.

## Step 2: Define What Is Persisted

Persist:

- `roomId`
- Yjs document snapshot
- current language
- last updated timestamp

Do not persist:

- participant socket ids
- participant online status
- awareness
- cursor position
- selections
- connection state

Suggested persisted shape:

```ts
type PersistedRoom = {
  roomId: string;
  language: string;
  documentUpdate: Uint8Array;
  updatedAt: string;
};
```

If using files, the data can be split into:

```text
server/data/rooms/<encoded-room-id>.bin
server/data/rooms/<encoded-room-id>.json
```

The `.bin` file stores the Yjs snapshot. The `.json` file stores metadata such as language and `updatedAt`.

## Step 3: Create A Persistence Module

Create:

```text
server/src/persistence.ts
```

Start with a small API. Keep `index.ts` from knowing storage details.

Suggested API:

```ts
import * as Y from "yjs";

export type PersistedRoomState = {
  language: string;
  updatedAt: string;
};

export async function loadRoomDocument(
  roomId: string,
): Promise<{ doc: Y.Doc; language: string } | null> {
  // Read snapshot and metadata from storage.
}

export async function saveRoomDocument(options: {
  roomId: string;
  doc: Y.Doc;
  language: string;
}): Promise<void> {
  // Encode Yjs state and write snapshot plus metadata.
}

export async function deleteRoomDocument(roomId: string): Promise<void> {
  // Optional cleanup helper.
}
```

Checkpoint:

- Persistence is isolated from Socket.IO event handlers.
- The server can load, save, and optionally delete room documents through this module.

## Step 4: Implement File-Based Snapshots

If you choose file snapshots, use Node filesystem APIs on the server.

Important details:

- Encode room ids before using them as filenames.
- Create the data directory if it does not exist.
- Write snapshots atomically enough for the lab.
- Store binary Yjs data as a real binary file, not JSON arrays.

Suggested helpers:

```ts
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import * as Y from "yjs";

const DATA_DIR = path.join(process.cwd(), "data", "rooms");

function getRoomKey(roomId: string) {
  return Buffer.from(roomId).toString("base64url");
}

function getSnapshotPath(roomId: string) {
  return path.join(DATA_DIR, `${getRoomKey(roomId)}.bin`);
}

function getMetadataPath(roomId: string) {
  return path.join(DATA_DIR, `${getRoomKey(roomId)}.json`);
}
```

Suggested save flow:

```ts
export async function saveRoomDocument({
  roomId,
  doc,
  language,
}: {
  roomId: string;
  doc: Y.Doc;
  language: string;
}) {
  await mkdir(DATA_DIR, { recursive: true });

  const snapshot = Y.encodeStateAsUpdate(doc);
  const updatedAt = new Date().toISOString();

  const snapshotPath = getSnapshotPath(roomId);
  const metadataPath = getMetadataPath(roomId);

  await writeFile(`${snapshotPath}.tmp`, snapshot);
  await writeFile(
    `${metadataPath}.tmp`,
    JSON.stringify({ language, updatedAt }, null, 2),
  );

  await rename(`${snapshotPath}.tmp`, snapshotPath);
  await rename(`${metadataPath}.tmp`, metadataPath);
}
```

Suggested load flow:

```ts
export async function loadRoomDocument(roomId: string) {
  try {
    const [snapshot, metadataRaw] = await Promise.all([
      readFile(getSnapshotPath(roomId)),
      readFile(getMetadataPath(roomId), "utf-8"),
    ]);

    const metadata = JSON.parse(metadataRaw) as PersistedRoomState;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(snapshot));

    return {
      doc,
      language: metadata.language,
    };
  } catch {
    return null;
  }
}
```

Checkpoint:

- Storage writes a binary snapshot.
- Storage reads a binary snapshot.
- Missing room files return `null`.
- New rooms still work when no snapshot exists.

## Step 5: Load Persisted Rooms On First Join

Update the server room creation flow.

Current room creation is probably synchronous:

```ts
function getOrCreateRoom(roomId: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const doc = new Y.Doc();
  doc.getText("code").insert(0, DEFAULT_CODE);

  const room = {
    doc,
    language: DEFAULT_LANGUAGE,
    participants: new Map(),
  };

  rooms.set(roomId, room);
  return room;
}
```

Persistence makes it async:

```ts
async function getOrCreateRoom(roomId: string) {
  const existingRoom = rooms.get(roomId);

  if (existingRoom) {
    return existingRoom;
  }

  const persistedRoom = await loadRoomDocument(roomId);
  const doc = persistedRoom?.doc ?? new Y.Doc();

  if (!persistedRoom) {
    doc.getText("code").insert(0, DEFAULT_CODE);
  }

  const room = {
    doc,
    language: persistedRoom?.language ?? DEFAULT_LANGUAGE,
    participants: new Map(),
  };

  rooms.set(roomId, room);
  return room;
}
```

Then update the join handler:

```ts
socket.on("join-room", async ({ roomId, name }: JoinRoomPayload) => {
  const room = await getOrCreateRoom(roomId);

  // existing join logic
});
```

Checkpoint:

- First join creates or loads the room.
- Rejoining an active room uses the in-memory room.
- Rejoining after a server restart loads the persisted room.

## Step 6: Save When Yjs Updates Arrive

The server already receives Yjs updates:

```ts
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

Add persistence after applying the update:

```ts
socket.on("yjs-update", async ({ roomId, update }: YjsUpdatePayload) => {
  const room = rooms.get(roomId);

  if (!room) {
    socket.emit("room-error", { message: "Room not found." });
    return;
  }

  Y.applyUpdate(room.doc, update);
  await saveRoomDocument({
    roomId,
    doc: room.doc,
    language: room.language,
  });

  socket.to(roomId).emit("yjs-update", {
    roomId,
    update,
    updatedBy: socket.id,
  });
});
```

Checkpoint:

- Edits save the latest Yjs document state.
- Other clients still receive the original incremental update.
- The server does not broadcast full snapshots on every edit.

## Step 7: Save Language Changes

Language is not stored inside the Yjs text by default, so persist it separately.

Current language handler likely updates memory:

```ts
room.language = language;
```

After that, save the room metadata and snapshot:

```ts
room.language = language;
await saveRoomDocument({
  roomId,
  doc: room.doc,
  language: room.language,
});
```

Checkpoint:

- Change language.
- Restart the server.
- Rejoin the same room.
- The editor language is restored.

## Step 8: Avoid Saving Too Often

The direct implementation saves on every Yjs update. That is fine for this lab, but it can write too frequently while a user types.

If saves feel noisy, add a debounce on the server.

Suggested approach:

- Apply every Yjs update to memory immediately.
- Broadcast every Yjs update immediately.
- Schedule persistence after a short delay.
- Reset the timer if another update arrives.

Suggested helper:

```ts
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRoomSave(roomId: string, room: RoomState) {
  const existingTimer = saveTimers.get(roomId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const nextTimer = setTimeout(() => {
    saveRoomDocument({
      roomId,
      doc: room.doc,
      language: room.language,
    }).catch((error) => {
      console.error(`Failed to save room ${roomId}`, error);
    });

    saveTimers.delete(roomId);
  }, 500);

  saveTimers.set(roomId, nextTimer);
}
```

Then call:

```ts
scheduleRoomSave(roomId, room);
```

instead of directly awaiting `saveRoomDocument(...)`.

Recommended for the lab:

- Direct `await saveRoomDocument(...)` is simpler.
- Debounced saving is better once the behavior is proven.

## Step 9: Flush Pending Saves On Empty Room

When the last participant leaves, the server currently destroys the room document and deletes it from memory.

Before destroying the document, save it one final time:

```ts
if (room.participants.size === 0) {
  await saveRoomDocument({
    roomId,
    doc: room.doc,
    language: room.language,
  });

  room.doc.destroy();
  rooms.delete(roomId);
}
```

Because Socket.IO disconnect handlers can be async, wrap failures:

```ts
socket.on("disconnect", () => {
  void handleDisconnect(socket);
});

async function handleDisconnect(socket: Socket) {
  // existing disconnect behavior
}
```

Checkpoint:

- Last participant leaving does not lose the latest active document state.
- Room memory is still cleaned up.

## Step 10: Add Cleanup Rules

Persistence needs a cleanup policy.

For the lab, choose one:

- Manual cleanup only.
- Delete rooms older than a fixed age.
- Keep rooms forever while learning.

Suggested simple policy:

- Keep rooms for 7 days.
- Delete persisted files when `updatedAt` is older than 7 days.
- Run cleanup manually through a script or server startup helper.

Avoid:

- deleting rooms while users are active
- tying cleanup to participant disconnect without checking age
- persisting awareness just to restore cursors

Possible cleanup API:

```ts
export async function deleteExpiredRooms(maxAgeMs: number): Promise<void> {
  // Read metadata files.
  // Delete matching metadata and snapshot files.
}
```

Checkpoint:

- The project has a written cleanup rule.
- Stale data will not grow forever by accident.

## Step 11: Update Manual Testing

Add these checks to your manual test pass:

- Join room `persist-test`.
- Type a unique line, such as `const persisted = true;`.
- Change language.
- Stop the server.
- Start the server.
- Refresh or reopen the web app.
- Rejoin `persist-test`.
- Confirm the code is restored.
- Confirm the language is restored.
- Confirm participants show only currently connected users.
- Confirm remote cursors do not appear until users actively join and move/select text.

Also test:

- a brand new room still starts with default code
- two active tabs still sync live edits
- closing one tab still removes that participant
- server restart no longer loses persisted document text

## Step 12: Update Docs

After implementation, update:

```text
readme.md
```

Mark Phase 8 behavior clearly:

- persistence stores Yjs document state
- persistence does not store participants
- persistence does not store awareness
- persistence does not make the app production-ready by itself

If you choose file snapshots, document where the files live:

```text
server/data/rooms/
```

## Common Mistakes

Persisting awareness:

- Do not store awareness.
- Cursors and selections are live presence state.
- They should disappear when the user disconnects.

Persisting Socket.IO ids:

- Do not store socket ids.
- They change on reconnect.

Sending snapshots on every edit:

- Clients should still receive incremental Yjs updates.
- Snapshots are for storage and initial restore.

Creating a new server document for every update:

- Keep one active `Y.Doc` per room in memory.
- Apply incoming updates to that document.
- Persist from that document.

Using raw room ids as filenames:

- Encode room ids before using them as file paths.
- Do not allow `../` or special path characters to affect storage paths.

Ignoring failed saves:

- Log persistence errors.
- Keep live sync working even if a save fails.
- Surface a simple server-side error while learning.

## Done Criteria

Phase 8 is done when:

- room document state survives a full server restart
- language survives a full server restart
- active room sync still uses Yjs incremental updates
- joining a room sends a restored Yjs snapshot
- awareness and participants remain ephemeral
- cleanup policy is documented
- `pnpm typecheck` passes
- manual restart test passes

At that point the app has a good learning-level collaboration stack:

- room join
- participant presence
- Yjs text sync
- remote cursors and selections
- optional document persistence
