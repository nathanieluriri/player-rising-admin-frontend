import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { mediaApi } from "@/lib/api";

import {
  type PartialBlock,
} from "@blocknote/core";

type BlockNoteDocument = PartialBlock<any>[];

interface BlockNoteEditorProps {
  initialContent?: BlockNoteDocument;
  onChange: (blocks: BlockNoteDocument) => void;
  
}
 

export function BlockNoteEditor({ initialContent, onChange }: BlockNoteEditorProps) {
  const uploadFile = async (file: File) => {
    try {
      const response = await mediaApi.uploadImage(file);
      return response.data.url;
    } catch (error) {
      console.error("Image upload failed:", error);
      throw new Error("Image upload failed");
    }
  };

  const editor = useCreateBlockNote({
    initialContent: initialContent?.length ? initialContent : undefined,
    uploadFile,
  });

  useEffect(() => {
    const unsub = editor.onChange(() => onChange(editor.document));
    return () => unsub();
  }, [editor, onChange]);

  return (
    
      <BlockNoteView
        editor={editor}
        theme="light"
        slashMenu                     // 👈 enables "/" insert menu
        formattingToolbar
        filePanel={false} // disable file panel temporarily    
        />
   
  );
}
