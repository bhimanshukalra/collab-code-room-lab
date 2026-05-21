import { useState, type ChangeEvent } from "react";

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

  const renderCodeEditor = () => {
    const onChangeCode = (event: ChangeEvent<HTMLTextAreaElement>) => {
      setCurrentCode(event.target.value);
    };

    return <textarea value={currentCode} onChange={onChangeCode} />;
  };

  return (
    <>
      {renderLanguageOptions()}
      {renderCodeEditor()}
    </>
  );
}

export default App;
