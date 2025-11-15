// Translator functions for BlockNote <-> API format conversion

export type BlockNoteBlock = {
  type: string;
  content?: Array<{ type: string; text?: string }>;
  props?: any;
};

export type APIBlock = {
  type: "text" | "image" | "quote" | "divider";
  content?: string;
  url?: string;
  altText?: string;
  caption?: string;
  text?: string;
};

/**
 * Converts BlockNote's internal format to API's currentPageBody format
 */
export function blockNoteToApi(blocks: BlockNoteBlock[]): APIBlock[] {
  const apiBlocks = blocks
    .map((block): APIBlock | null => {
      switch (block.type) {
        case "paragraph":
          const textContent = block.content
            ?.map((c) => c.text || "")
            .join("") || "";
          if (!textContent.trim()) return null;
          return {
            type: "text" as const,
            content: textContent,
          };

        case "heading":
          const headingText = block.content
            ?.map((c) => c.text || "")
            .join("") || "";
          if (!headingText.trim()) return null;
          return {
            type: "text" as const,
            content: headingText,
          };

        case "image":
          if (!block.props?.url) return null;
          return {
            type: "image" as const,
            url: block.props.url,
            altText: block.props.altText || "Image",
            caption: block.props.caption || "",
          };

        case "blockquote":
          const quoteText = block.content
            ?.map((c) => c.text || "")
            .join("") || "";
          if (!quoteText.trim()) return null;
          return {
            type: "quote" as const,
            text: quoteText,
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
 */
export function apiToBlockNote(apiBlocks: APIBlock[]): BlockNoteBlock[] {
  if (!apiBlocks || apiBlocks.length === 0) {
    return [
      {
        type: "paragraph",
        content: [],
      },
    ];
  }

  const blocks = apiBlocks
    .map((block): BlockNoteBlock | null => {
      switch (block.type) {
        case "text":
          return {
            type: "paragraph",
            content: [{ type: "text", text: block.content || "" }],
          };

        case "image":
          return {
            type: "image",
            props: {
              url: block.url,
              caption: block.caption || "",
              altText: block.altText || "Image",
            },
          };

        case "quote":
          return {
            type: "blockquote",
            content: [{ type: "text", text: block.text || "" }],
          };

        case "divider":
          return {
            type: "horizontalRule",
            content: [],
          };

        default:
          return null;
      }
    })
    .filter((block) => block !== null);

  return blocks as BlockNoteBlock[];
}
