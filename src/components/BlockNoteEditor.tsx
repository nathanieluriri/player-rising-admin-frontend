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
      return {
      url: response.data.url,
      previewWidth: 300, // or any sensible default width
      previewHeight: 200, // optional
    };      // 👈 MUST return final file URL
    } catch (error) {
      console.error("Image upload failed:", error);
      throw new Error("Image upload failed");
    }
  };

  const editor = useCreateBlockNote({
   
    initialContent: initialContent?.length ? initialContent : undefined,
    uploadFile,     
     resolveFileUrl: async (url) => url,  
    
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
