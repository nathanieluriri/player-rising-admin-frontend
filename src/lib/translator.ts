// --- BLOCKNOTE'S INTERNAL TYPE (Simplified) ---
// We've added textAlignment, level, and styles for clarity
export type BlockNoteInlineContent = {
  type: "text";
  text?: string;
  styles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    code?: boolean;
  };
};

// This type is a simplification, but the key is that 'content'
// can be an array OR the string "none".
export type BlockNoteBlock = {
  type: string;
  content?: BlockNoteInlineContent[] | "none"; // <-- More accurate type
  props?: {
    // --- Alignment ---
    textAlignment?: "left" | "center" | "right";
    // --- Heading ---
    level?: 1 | 2 | 3;
    // --- Image ---
    url?: string;
    altText?: string;
    caption?: string;
    previewWidth?: number;
    previewHeight?: number;
  };
};

// --- API'S INLINE CONTENT TYPE ---
// This new type will store bold, italic, etc.
export type APIInlineContent = {
  type: "text";
  text: string;
  styles: { [key: string]: boolean }; // e.g., { bold: true, italic: true }
};

// --- API'S BLOCK TYPE (New Structure) ---
// This is the new definition you asked to adjust.
// We've added `align` and split `text` into `paragraph` and `heading`.
export type APIBlock = {
  align?: "left" | "center" | "right";
} & (
  | {
      type: "paragraph";
      content: APIInlineContent[];
    }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      content: APIInlineContent[];
    }
  | {
      type: "image";
      url?: string;
      altText?: string;
      caption?: string;
      previewWidth?: number;
      previewHeight?: number;
    }
  | {
      type: "quote";
      content: APIInlineContent[];
    }
  | {
      type: "divider";
    }
);

// --- HELPER FUNCTIONS FOR RICH TEXT ---

/**
 * Maps BlockNote's inline content array to the API's format.
 */
function mapBlockNoteContentToApi(
  content?: BlockNoteInlineContent[] | "none"
): APIInlineContent[] {
  if (!content || content === "none") return [];
  return content.map((inline) => ({
    type: "text",
    text: inline.text || "",
    styles: inline.styles || {},
  }));
}

/**
 * Maps the API's inline content array to BlockNote's format.
 */
function mapApiContentToBlockNote(
  content?: APIInlineContent[]
): BlockNoteInlineContent[] {
  if (!content) return [];
  return content.map((inline) => ({
    type: "text",
    text: inline.text || "",
    styles: inline.styles || {},
  }));
}

/**
 * Converts BlockNote's internal format to API's currentPageBody format
 * (Now saves alignment and rich text)
 */
export function blockNoteToApi(blocks: BlockNoteBlock[]): APIBlock[] {
  const apiBlocks = blocks
    .map((block): APIBlock | null => {
      // Get alignment. 'left' is default, so we can store 'undefined'
      const align =
        block.props?.textAlignment === "left"
          ? undefined
          : block.props?.textAlignment;

      switch (block.type) {
        case "paragraph":
          return {
            type: "paragraph" as const,
            align: align,
            content: mapBlockNoteContentToApi(block.content),
          };

        case "heading":
          return {
            type: "heading" as const,
            align: align,
            level: (block.props?.level || 1) as 1 | 2 | 3,
            content: mapBlockNoteContentToApi(block.content),
          };

        case "image":
          if (!block.props?.url) return null;
          return {
            type: "image" as const,
            // 'align' is NOT included for images.
            url: block.props.url,
            altText: block.props.altText || "Image",
            caption: block.props.caption || "",
            previewWidth: block.props.previewWidth,
            previewHeight: block.props.previewHeight,
          };

        case "blockquote":
          return {
            type: "quote" as const,
            align: align,
            content: mapBlockNoteContentToApi(block.content),
          };

        case "horizontalRule":
          return {
            type: "divider" as const,
          };

        default:
          return null;
      }
    })
    .filter((block) => block !== null);

  return apiBlocks as APIBlock[];
}

/**
 * Converts API's currentPageBody format to BlockNote's format
 * (Now loads alignment and rich text)
 */
export function apiToBlockNote(apiBlocks: APIBlock[]): BlockNoteBlock[] {
  if (!apiBlocks || apiBlocks.length === 0) {
    return [
      {
        type: "paragraph",
        props: { textAlignment: "left" },
        content: [],
      },
    ];
  }

  const blocks = apiBlocks
    .map((block): BlockNoteBlock | null => {
      switch (block.type) {
        case "paragraph":
          return {
            type: "paragraph",
            props: { textAlignment: block.align || "left" },
            content: mapApiContentToBlockNote(block.content),
          };

        case "heading":
          return {
            type: "heading",
            props: {
              textAlignment: block.align || "left",
              level: block.level || 1,
            },
            content: mapApiContentToBlockNote(block.content),
          };

        case "image":
          return {
            type: "image",
            props: {
             
              url: block.url,
              caption: block.caption || "",
              altText: block.altText || "Image",
              previewWidth: block.previewWidth || 500,
              previewHeight: block.previewHeight,
            },
           
          };

        case "quote":
          return {
            type: "blockquote",
            props: { textAlignment: block.align || "left" },
            content: mapApiContentToBlockNote(block.content),
          };

        case "divider":
          return {
            type: "horizontalRule",
           
          };

        default:
          // This handles your old "text" type for data migration
          const oldBlock = block as any;
          if (oldBlock.type === "text" && oldBlock.content) {
            return {
              type: "paragraph",
              props: { textAlignment: "left" }, // Default alignment for old data
              content: [{ type: "text", text: oldBlock.content, styles: {} }],
            };
          }
          return null;
      }
    })
    .filter((block) => block !== null);

  // Ensure there's at least one block, otherwise BlockNote can crash
  if (blocks.length === 0) {
    return [
      {
        type: "paragraph",
        props: { textAlignment: "left" },
        content: [],
      },
    ];
  }

  return blocks as BlockNoteBlock[];
}