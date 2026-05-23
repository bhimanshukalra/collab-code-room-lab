import { Editor, type OnMount } from "@monaco-editor/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";
import { useYjsDocument } from "./features/editor/useYjsDocument";
import { JoinRoomForm } from "./features/room/JoinRoomForm";
import { ParticipantsList } from "./features/room/ParticipantsList";
import { useRoomSocket } from "./features/room/useRoomSocket";
import { getParticipantColor } from "./utils";

const LANGUAGES = ["typescript", "python"] as const;

export type Language = (typeof LANGUAGES)[number];

type MonacoEditor = Parameters<OnMount>[0];
type MonacoInstance = Parameters<OnMount>[1];

const DEFAULT_LANGUAGE = "typescript";

const DEFAULT_SNIPPETS: Record<Language, string> = {
  typescript: `console.log('Hello world');`,
  python: `print("Hello world")`,
};

const isLanguage = (value: string): value is Language =>
  Object.hasOwn(DEFAULT_SNIPPETS, value);

function App() {
  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>(DEFAULT_LANGUAGE);
  const [editorText, setEditorText] = useState("");
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const selectionListenerRef = useRef<{ dispose: () => void } | null>(null);
  const { doc, text, awareness } = useYjsDocument();

  const handleLanguageChange = (language: string) => {
    if (isLanguage(language)) {
      setSelectedLanguage(language);
    }
  };

  const {
    connectionState,
    joinedRoom,
    participants,
    joinRoom,
    sendLanguageChange,
    syncState,
  } = useRoomSocket({ doc, onLanguageChange: handleLanguageChange, awareness });

  const syncAwarenessSelection = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    const selection = editor?.getSelection();

    if (!editor || !model || !monaco || !selection) {
      return;
    }

    let anchor = model.getOffsetAt(selection.getStartPosition());
    let head = model.getOffsetAt(selection.getEndPosition());

    if (selection.getDirection() === monaco.SelectionDirection.RTL) {
      const nextAnchor = head;
      head = anchor;
      anchor = nextAnchor;
    }

    awareness.setLocalState({
      ...(awareness.getLocalState() ?? {}),
      selection: {
        anchor: Y.createRelativePositionFromTypeIndex(text, anchor),
        head: Y.createRelativePositionFromTypeIndex(text, head),
      },
    });
  }, [awareness, text]);

  useEffect(() => {
    if (!joinedRoom) {
      awareness.setLocalState(null);
      return;
    }

    awareness.setLocalState({
      ...(awareness.getLocalState() ?? {}),
      user: {
        name: joinedRoom.name,
        color: getParticipantColor(joinedRoom.name),
      },
    });
    syncAwarenessSelection();
  }, [awareness, joinedRoom, syncAwarenessSelection]);

  useEffect(() => {
    const updateEditorText = () => {
      setEditorText(text.toString());
    };

    updateEditorText();
    text.observe(updateEditorText);

    return () => {
      text.unobserve(updateEditorText);
    };
  }, [text]);

  useEffect(() => {
    return () => {
      selectionListenerRef.current?.dispose();
      selectionListenerRef.current = null;
      bindingRef.current?.destroy();
      bindingRef.current = null;
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  const renderLanguageOptions = () => {
    const onChangeSelection = (event: ChangeEvent<HTMLSelectElement>) => {
      const nextLanguage = event.target.value;
      if (isLanguage(nextLanguage)) {
        const nextCode = DEFAULT_SNIPPETS[nextLanguage];
        setSelectedLanguage(nextLanguage);
        replaceEditorText(nextCode);
        sendLanguageChange(nextLanguage);
      }
    };

    return (
      <select value={selectedLanguage} onChange={onChangeSelection}>
        {LANGUAGES.map((currentLang) => (
          <option key={currentLang} value={currentLang}>
            {currentLang}
          </option>
        ))}
      </select>
    );
  };

  const renderResetButton = () => {
    const handleOnClick = () => {
      const nextCode = DEFAULT_SNIPPETS[selectedLanguage];
      replaceEditorText(nextCode);
    };

    return (
      <button onClick={handleOnClick} className="border px-1">
        Reset
      </button>
    );
  };

  const renderLineCount = () => {
    const lineCount =
      editorText.length === 0 ? 1 : editorText.split("\n").length;
    return <span>Line count: {lineCount}</span>;
  };

  const renderSyncState = () => {
    return <span>Sync: {syncState}</span>;
  };

  const renderEditorControls = () => {
    return (
      <div className="flex self-end mt-2 me-2 gap-2">
        {renderLanguageOptions()}
        {renderResetButton()}
        {renderLineCount()}
        {renderSyncState()}
      </div>
    );
  };

  const renderRoomPanel = () => {
    return (
      <section className="flex items-center gap-4 px-2 pt-2">
        <span>Socket: {connectionState}</span>
        {joinedRoom ? (
          <span>Room: {joinedRoom.roomId}</span>
        ) : (
          <JoinRoomForm onJoinRoom={joinRoom} />
        )}
        <ParticipantsList participants={participants} />
      </section>
    );
  };

  const renderCodeEditor = () => {
    const handleEditorMount: OnMount = (editor, monaco) => {
      const model = editor.getModel();

      if (!model) {
        return;
      }

      editorRef.current = editor;
      monacoRef.current = monaco;
      selectionListenerRef.current?.dispose();
      bindingRef.current?.destroy();
      bindingRef.current = new MonacoBinding(
        text,
        model,
        new Set([editor]),
        awareness,
      );
      selectionListenerRef.current =
        editor.onDidChangeCursorSelection(syncAwarenessSelection);
      syncAwarenessSelection();
    };

    return (
      <Editor
        height="100%"
        language={selectedLanguage}
        onMount={handleEditorMount}
        theme="vs-dark"
      />
    );
  };

  const replaceEditorText = (nextCode: string) => {
    text.doc?.transact(() => {
      text.delete(0, text.length);
      text.insert(0, nextCode);
    });
  };

  return (
    <div className="flex h-screen flex-col gap-4">
      {renderRoomPanel()}
      {renderEditorControls()}
      {renderCodeEditor()}
    </div>
  );
}

export default App;
