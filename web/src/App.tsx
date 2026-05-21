import { Editor } from "@monaco-editor/react";
import { useState, type ChangeEvent } from "react";
import { useRoomSocket } from "./features/room/useRoomSocket";

const LANGUAGES = ["typescript", "python"] as const;

type Language = (typeof LANGUAGES)[number];

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
  const [currentCode, setCurrentCode] = useState(DEFAULT_SNIPPETS.typescript);
  const { connectionState } = useRoomSocket();

  const renderLanguageOptions = () => {
    const onChangeSelection = (event: ChangeEvent<HTMLSelectElement>) => {
      const nextLanguage = event.target.value;
      if (isLanguage(nextLanguage)) {
        setSelectedLanguage(nextLanguage);
        setCurrentCode(DEFAULT_SNIPPETS[nextLanguage]);
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
      setCurrentCode(DEFAULT_SNIPPETS[selectedLanguage]);
    };

    return (
      <button onClick={handleOnClick} className="border px-1">
        Reset
      </button>
    );
  };

  const renderLineCount = () => {
    const lineCount =
      currentCode.length === 0 ? 1 : currentCode.split("\n").length;
    return <span>Line count: {lineCount}</span>;
  };

  const renderConnectionState = () => {
    return <span>Socket: {connectionState}</span>;
  };

  const renderEditorControls = () => {
    return (
      <div className="flex self-end mt-2 me-2 gap-2">
        {renderLanguageOptions()}
        {renderResetButton()}
        {renderLineCount()}
        {renderConnectionState()}
      </div>
    );
  };

  const renderCodeEditor = () => {
    const onChangeCode = (value: string | undefined) => {
      setCurrentCode(value ?? "");
    };

    return (
      <Editor
        height="100%"
        language={selectedLanguage}
        theme="vs-dark"
        value={currentCode}
        onChange={onChangeCode}
      />
    );
  };

  return (
    <div className="flex flex-col gap-10 h-screen">
      {renderEditorControls()}
      {renderCodeEditor()}
    </div>
  );
}

export default App;
