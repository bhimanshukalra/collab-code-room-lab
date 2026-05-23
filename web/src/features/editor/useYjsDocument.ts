import { useEffect, useMemo } from "react";
import { Awareness } from "y-protocols/awareness.js";
import * as Y from "yjs";

export function useYjsDocument() {
  const doc = useMemo(() => new Y.Doc(), []);
  const text = useMemo(() => doc.getText("code"), [doc]);
  const awareness = useMemo(() => new Awareness(doc), [doc]);

  useEffect(() => {
    return () => {
      awareness.destroy();
      doc.destroy();
    };
  }, [awareness, doc]);

  return { doc, text, awareness };
}
