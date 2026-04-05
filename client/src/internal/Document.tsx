import Editor from "./Editor";
import { useCallback } from "react";
import { useAppContext } from "../contexts/AppContext";

export default function Document() {
  const { currentDocumentContent, setCurrentDocumentContent } = useAppContext();

  const handleEditorChange = useCallback((content: string) => {
    setCurrentDocumentContent(content);
  }, [setCurrentDocumentContent]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <Editor handleEditorChange={handleEditorChange} content={currentDocumentContent} />
      </div>
    </div>
  );
}