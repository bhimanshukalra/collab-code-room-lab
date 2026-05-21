# Collaborative Code Room Lab

This repository is a small learning project for building a real-time collaborative code editor.

The goal is to prove the smallest useful collaboration loop:

- create or join a room
- show connected participants
- edit code in the browser
- sync code changes between two browser tabs
- recover cleanly when a user disconnects or rejoins

Keep this lab intentionally small. Do not add auth, database persistence, video calls, code execution, or product-specific UI until the core collaboration loop works.

## MVP Scope

- [ ] Single-user Monaco code editor.
- [ ] Room join flow using a room id.
- [ ] WebSocket server for room presence.
- [ ] Participants list for everyone in the room.
- [ ] Basic code sync between participants.
- [ ] Connection state: `connecting`, `connected`, `disconnected`, `reconnecting`.
- [ ] Simple rejoin behavior after refresh or disconnect.

## Non-Goals For The First Version

- No auth.
- No database.
- No multiple files.
- No code execution.
- No WebRTC.
- No remote cursor rendering.
- No CRDT/Yjs in the first pass.
- No production deployment work.

## Suggested Stack

Build the spike directly in this repository.

- Vite
- React
- TypeScript
- Monaco editor
- Socket.IO or native WebSocket
- pnpm workspaces

Socket.IO is a good first choice because rooms, reconnects, and event naming are easy to learn. Native WebSocket is also fine if you want fewer abstractions.

Suggested structure:

```text
collab-code-room-lab/
  readme.md
  package.json
  server/
    package.json
    src/
      index.ts
      rooms.ts
  web/
    package.json
    src/
      App.tsx
      editor/
        CodeEditor.tsx
      room/
        JoinRoomForm.tsx
        ParticipantsList.tsx
        useRoomSocket.ts
```

## Workspace Setup

Use pnpm workspaces so the web app and server can share one lockfile and root-level scripts while staying as separate packages.

Steps:

1. Create the root package:

```sh
pnpm init
```

2. Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "web"
  - "server"
```

3. Update the root `package.json`:

```json
{
  "name": "collab-code-room-lab",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --parallel --filter web --filter server dev",
    "dev:web": "pnpm --filter web dev",
    "dev:server": "pnpm --filter server dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

4. Create the web package:

```sh
pnpm create vite web --template react-ts
pnpm --filter web add @monaco-editor/react
```

5. Create the server package:

```sh
mkdir -p server/src
cd server
pnpm init
pnpm add socket.io
pnpm add -D typescript tsx @types/node
```

6. Add server scripts in `server/package.json`:

```json
{
  "name": "server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit"
  }
}
```

7. Make sure the web package has a matching typecheck script:

```json
{
  "name": "web",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b"
  }
}
```

## Phase 1: Single-User Editor

Build the editor before adding real-time behavior.

Tasks:

- Create a Vite React TypeScript app in `web/`.
- Install Monaco editor.
- Render a full-page editor.
- Add a language selector.
- Add a starter snippet button.
- Track local code in React state.
- Show local metadata such as line count and selected language.

Acceptance check:

- You can open the app, choose a language, type code, reset code, and see the editor behave normally.

## Phase 2: WebSocket Server

Create a tiny real-time server.

Tasks:

- Create a Node TypeScript server in `server/`.
- Add a WebSocket or Socket.IO server.
- Accept client connections.
- Log connect and disconnect events.
- Add a simple health route or startup log.

Acceptance check:

- Starting the server shows it is listening.
- Opening the web app creates a socket connection.
- Closing the tab logs a disconnect.

## Phase 3: Rooms And Participants

Add room identity and presence.

Tasks:

- Add a room id input in the web app.
- Let users join a room with a display name.
- Track participants in memory on the server.
- Broadcast participant updates to everyone in the room.
- Show participants in the UI.
- Limit the first version to one room or many rooms, whichever is simpler for your implementation.

Suggested server state:

```ts
type Participant = {
  id: string;
  name: string;
  joinedAt: string;
};

type RoomState = {
  code: string;
  language: string;
  participants: Participant[];
};
```

Suggested events:

```ts
type ClientToServerEvent =
  | { type: 'join-room'; roomId: string; name: string }
  | { type: 'leave-room'; roomId: string }
  | { type: 'code-change'; roomId: string; code: string; language: string };

type ServerToClientEvent =
  | { type: 'room-state'; roomId: string; code: string; language: string; participants: Participant[] }
  | { type: 'participants-change'; roomId: string; participants: Participant[] }
  | { type: 'code-change'; roomId: string; code: string; language: string; updatedBy: string }
  | { type: 'room-error'; message: string };
```

Acceptance check:

- Open two browser tabs.
- Join the same room from both tabs.
- Both tabs show both participants.
- Closing one tab removes that participant from the other tab.

## Phase 4: Basic Code Sync

Start with the simplest possible sync model.

Tasks:

- When a user edits code, emit the full code string to the room.
- The server stores the latest code string for the room.
- The server broadcasts the latest code to other participants.
- The sender should not re-apply their own update unless your implementation requires it.
- Add a small `synced` or `syncing` indicator.

Acceptance check:

- Open two tabs in the same room.
- Type in tab A.
- Tab B updates.
- Type in tab B.
- Tab A updates.
- Refresh tab A.
- Tab A receives the latest room code.

## Phase 5: Reconnect And Recovery

Make the MVP feel stable.

Tasks:

- Show socket connection state in the UI.
- If the socket disconnects, show `disconnected` or `reconnecting`.
- When the socket reconnects, rejoin the previous room.
- On rejoin, request the latest room state from the server.
- Do not persist room state to a database yet.

Acceptance check:

- Stop and restart the server.
- The web app shows a disconnected state.
- Rejoining the room restores the latest in-memory room state if the server still has it.

## Phase 6: Optional Yjs Upgrade

Only add Yjs after basic sync works.

Why:

- Sending the full code string is fine for an MVP.
- It can overwrite simultaneous edits.
- Yjs uses CRDTs to merge concurrent edits more safely.
- Yjs also gives a cleaner path to remote cursors, selections, and presence.

Upgrade tasks:

- Replace full-string sync with a Yjs document.
- Use a shared `Y.Text` for editor content.
- Use a Yjs WebSocket provider or your own provider.
- Add awareness state for participant names and cursor presence.
- Keep the old simple sync branch or notes so you can compare approaches.

Suggested upgrade path:

- Keep the room join flow, display name input, participants list, connection state UI, and reconnect behavior.
- Move editor synchronization behind a small client boundary such as `useRoomDocument` so the UI does not care whether sync is full-string or Yjs-based.
- Replace `code-change` events with binary Yjs update events.
- Replace server `code: string` room storage with an in-memory `Y.Doc` per room.
- When a client joins or rejoins, send a full Yjs snapshot with `Y.encodeStateAsUpdate(roomDoc)`.
- When a client edits, apply the incoming Yjs update to the server room document with `Y.applyUpdate(roomDoc, update)`.
- Broadcast that Yjs update to the other sockets in the room.
- Bind Monaco to `doc.getText('code')` instead of treating React state as the source of truth for editor content.
- Use Yjs awareness for ephemeral collaboration state such as names, cursors, selections, and typing indicators.

Suggested Yjs events:

```ts
type ClientToServerYjsEvent =
  | { type: 'join-room'; roomId: string; name: string }
  | { type: 'leave-room'; roomId: string }
  | { type: 'yjs-update'; roomId: string; update: Uint8Array };

type ServerToClientYjsEvent =
  | { type: 'yjs-sync'; roomId: string; update: Uint8Array }
  | { type: 'yjs-update'; roomId: string; update: Uint8Array; updatedBy: string }
  | { type: 'participants-change'; roomId: string; participants: Participant[] }
  | { type: 'room-error'; message: string };
```

Acceptance check:

- Two users can type at the same time without obvious overwrite bugs.
- Remote participant presence still works.

## Implementation Notes

Keep the server as the room authority.

- The server decides which room a socket joins.
- The server owns the latest room state for the MVP.
- The client should treat server `room-state` as the source of truth when joining.

Avoid these traps:

- Do not add auth too early.
- Do not add persistence before real-time sync works.
- Do not start with CRDTs unless you already understand the socket room flow.
- Do not combine WebRTC and code sync in the same spike.
- Do not hide connection errors; show them in the UI.

## Manual Test Plan

Run these checks before calling the spike successful:

- One tab can join a room.
- Two tabs can join the same room.
- Both tabs show the same participant list.
- Typing in one tab updates the other.
- Changing language updates the other.
- Refreshing a tab restores room state.
- Closing a tab removes the participant.
- Server restart shows a clear disconnected state.
- Rejoining after disconnect works without duplicate participants.

## Future Integration

After the spike works, bring only the proven pieces into a larger application:

- editor component
- room socket hook
- room event types
- participant list UI
- connection state UI

Use an existing stable entity id, such as a document id or session id, as the room id in the larger application.

Do not copy spike code blindly. Translate it into the larger application's patterns:

- shared schemas in `packages/shared`
- feature-level hooks in `apps/web/src/features`
- focused UI components in `apps/web/src/components`
- API or real-time server boundaries in `apps/api`

## Done Criteria

The mini project is done when:

- two tabs can join the same room
- both participants are visible
- code sync works both ways
- reconnect states are visible
- the implementation is small enough that you understand every file

That is enough learning to start integrating the feature into a larger application.
