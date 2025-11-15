import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/shadcn/style.css";
import { mediaApi } from "@/lib/api";
import { apiToBlockNote } from "@/lib/translator";
import type { APIBlock } from "@/lib/translator";

interface BlockNoteEditorProps {
  initialContent?: APIBlock[];
  onChange: (blocks: any[]) => void;
}

export function BlockNoteEditor({ initialContent, onChange }: BlockNoteEditorProps) {
  const handleUpload = async (file: File) => {
    try {
      const response = await mediaApi.uploadImage(file);
      return response.data.url;
    } catch (error) {
      console.error("Image upload failed:", error);
      return null;
    }
  };

  const editor = useCreateBlockNote({
    initialContent: initialContent ? apiToBlockNote(initialContent) : undefined,
    uploadFile: handleUpload,
  });

  useEffect(() => {
    const handleChange = () => {
      onChange(editor.document);
    };

    editor.onChange(handleChange);
  }, [editor, onChange]);

  return (
    <div className="blocknote-wrapper">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}
