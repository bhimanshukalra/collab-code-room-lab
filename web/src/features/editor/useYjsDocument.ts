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
