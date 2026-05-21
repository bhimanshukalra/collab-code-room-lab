# Phase 1: Single-User Editor

Build a single-user Monaco code editor before adding rooms, sockets, presence, or synchronization.

The goal of this phase is simple: the web app should feel like a small standalone code editor. No backend work is required for this phase.

## Starting Point

You should already have:

- a pnpm workspace at the repo root
- a Vite React TypeScript app in `web/`
- `@monaco-editor/react` installed in the `web` package
- a Phase 1 state skeleton in `web/src/App.tsx`
- root scripts such as `pnpm dev:web` and `pnpm typecheck`

Run the web app:

```sh
pnpm dev:web
```

Open the Vite URL, usually:

```text
http://localhost:5173
```

## Step 1: Continue From `App.tsx`

Use the current `web/src/App.tsx` as the starting point.

It already defines:

```ts
const DEFAULT_LANGUAGE = "typescript";

const DEFAULT_SNIPPETS = {
  typescript: `console.log('Hello world');`,
  python: `print("Hello world")`,
};
```

and local state for:

- selected language
- current code

You can split components later. Keep the first pass easy to understand.

Current state shape:

```ts
const [selectedLanguage, setSelectedLanguage] = useState(DEFAULT_LANGUAGE);
const [currentCode, setCurrentCode] = useState(DEFAULT_SNIPPETS.typescript);
```

Checkpoint:

- the Vite landing page is gone
- `App` renders the editor UI instead of an empty fragment

## Step 2: Expand Starter Snippets

Expand `DEFAULT_SNIPPETS` in `web/src/App.tsx` or move it to `web/src/editor/snippets.ts` if the file starts feeling crowded.

Include at least three languages:

```ts
const DEFAULT_SNIPPETS = {
  typescript: `function greet(name: string) {
  return \`Hello, ${name}\`;
}

console.log(greet("Ada"));`,
  javascript: `function greet(name) {
  return \`Hello, ${name}\`;
}

console.log(greet("Ada"));`,
  python: `def greet(name):
    return f"Hello, {name}"

print(greet("Ada"))`,
};
```

Checkpoint:

- you can reset the editor to a known starter snippet
- snippets are plain strings and easy to edit

## Step 3: Render Monaco

Use `@monaco-editor/react` in the main app.

Basic shape:

```tsx
import Editor from "@monaco-editor/react";

<Editor
  height="100%"
  language={selectedLanguage}
  theme="vs-dark"
  value={currentCode}
  onChange={(value) => setCurrentCode(value ?? "")}
/>;
```

Put the editor in a stable full-page layout so it does not resize awkwardly while typing.

Checkpoint:

- Monaco fills the main working area
- typing updates React state
- the editor does not visibly jump or resize while typing

## Step 4: Add Editor Controls

Add a compact toolbar above or beside the editor.

Required controls:

- language selector
- reset snippet button

Recommended metadata:

- selected language
- line count
- character count

Line count helper:

```ts
const lineCount = currentCode.length === 0 ? 1 : currentCode.split("\n").length;
```

Checkpoint:

- changing language updates Monaco's language mode
- reset replaces the current code with the selected language's snippet
- line count and character count update while typing

## Step 5: Style The Editor App

Update `web/src/index.css`. If the app grows enough to need component-level styles, create a new `web/src/App.css` and import it from `App.tsx`.

Aim for a simple tool layout:

- full viewport height
- toolbar with controls and metadata
- editor area below or beside the toolbar
- dark editor theme
- no Vite starter logos or demo content

Keep the UI quiet and practical. This is a working editor, not a landing page.

Checkpoint:

- the app looks intentional
- controls are easy to find
- the editor remains the primary focus

## Step 6: Verify Phase 1

Run:

```sh
pnpm --filter web typecheck
```

Then manually verify:

- the app opens in the browser
- you can type code
- you can change language
- you can reset to a starter snippet
- line count updates
- character count updates
- refreshing the page does not show the old Vite starter UI

## Done Criteria

Phase 1 is complete when:

- `web/src/App.tsx` renders a single-user Monaco editor
- local code is tracked in React state
- language selection works
- starter snippets work
- basic metadata is visible
- `pnpm --filter web typecheck` passes

Do not add sockets, rooms, participants, reconnect behavior, Yjs, or backend integration in this phase.
