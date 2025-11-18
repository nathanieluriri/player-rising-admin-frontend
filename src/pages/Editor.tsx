import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { BlogSettingsDialog } from "@/components/BlogSettingsDialog";
import { blogApi } from "@/lib/api";
import "@blocknote/core/style.css";
import "@blocknote/react/style.css";
import { ArrowLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import useCategories from "@/hooks/useCategories";
import { Category } from "@/lib/api";
import type { PartialBlock } from "@blocknote/core";

// We'll use this type alias for clarity. It's BlockNote's native format.
type BlockNoteDocument = PartialBlock<any>[];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  // categories hook
  const { categories, isLoading: categoriesLoading } = useCategories();

  // article meta
  const [articleId, setArticleId] = useState<string | null>(isNew ? null : id || null);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorAvatar, setAuthorAvatar] = useState("");
  const [authorAffiliation, setAuthorAffiliation] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [featureImageUrl, setFeatureImageUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  // BlockNote native JSON document
  const [blogBlocks, setBlogBlocks] = useState<BlockNoteDocument>([]);

  // save + loading states
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedContent, setHasLoadedContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // for loading article

  // Local storage helpers
  const getLocalStorageKey = useCallback(
    (aid?: string | null) => `blog_draft_${aid || articleId || (isNew ? "new" : "unknown")}`,
    [articleId, isNew]
  );

  const saveToLocalStorage = useCallback(() => {
    if (isInitialLoad) return;
    try {
      const data = {
        title,
        authorName,
        authorAvatar,
        authorAffiliation,
        category,
        featureImageUrl,
        status,
        blogBlocks,
        lastSaved: Date.now(),
      };
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
    } catch (err) {
      console.error("Failed to save draft to localStorage", err);
    }
  }, [
    isInitialLoad,
    title,
    authorName,
    authorAvatar,
    authorAffiliation,
    category,
    featureImageUrl,
    status,
    blogBlocks,
    getLocalStorageKey,
  ]);

  const loadFromLocalStorage = useCallback((key: string) => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
      return null;
    }
  }, []);

  // When categories arrive, if category is null set to first category (optional behavior)
  useEffect(() => {
    if (!category && !categoriesLoading && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories, categoriesLoading, category]);

  // Initial load: either from API (if editing) or from local draft
  useEffect(() => {
    let mounted = true;

    const restoreLocal = () => {
      const localData = loadFromLocalStorage(getLocalStorageKey());
      if (!localData) return false;

      if (!mounted) return false;
      setTitle(localData.title || "");
      setAuthorName(localData.authorName || "");
      setAuthorAvatar(localData.authorAvatar || "");
      setAuthorAffiliation(localData.authorAffiliation || "");
      setCategory(localData.category ?? (categories[0] ?? null));
      setFeatureImageUrl(localData.featureImageUrl || "");
      setStatus(localData.status || "draft");
      setBlogBlocks(localData.blogBlocks || []);
      setHasLoadedContent(true);
      setIsInitialLoad(false);
      toast.info("Restored local draft");
      return true;
    };

    const doLoad = async () => {
      setIsLoading(true);
      if (!isNew && articleId) {
        // try to fetch remote article
        try {
          const response = await blogApi.getById(articleId);
          const blog = response.data;

          if (!mounted) return;

          setTitle(blog.title || "");
          setAuthorName(blog.author?.name || "");
          setAuthorAvatar(blog.author?.avatarUrl || "");
          setAuthorAffiliation(blog.author?.affiliation || "");
          const foundCat =
            categories.find((c) => c.slug === blog.category?.slug) ?? categories[0] ?? null;
          setCategory(foundCat);
          setFeatureImageUrl(blog.featureImage?.url || "");
          setStatus(blog.state || "draft");

          // IMPORTANT: if API returns a string, parse it; else assume native JSON.
          let blocks = blog.currentPageBody ?? [];
          if (typeof blocks === "string") {
            try {
              blocks = JSON.parse(blocks);
            } catch (err) {
              console.warn("currentPageBody is a string but not JSON; using empty array", err);
              blocks = [];
            }
          }
          setBlogBlocks(blocks);
          setHasLoadedContent(true);
          // remove local draft for this article if remote loaded
          localStorage.removeItem(getLocalStorageKey());
        } catch (error: any) {
          console.error("Failed to load article:", error);
          toast.error(error?.response?.data?.detail || "Failed to load article");
          // fallback to local draft if available
          const restored = restoreLocal();
          if (!restored) {
            // nothing to restore
            setHasLoadedContent(true); // allow editor to mount empty state
          }
        } finally {
          if (mounted) {
            setIsInitialLoad(false);
            setIsLoading(false);
          }
        }
      } else {
        // new article: try to restore draft
        const restored = restoreLocal();
        if (!restored) {
          setHasLoadedContent(true); // empty editor for new
          setIsInitialLoad(false);
        }
        setIsLoading(false);
      }
    };

    doLoad();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, isNew, categories]); // categories included so we can match category slug

  // Save to localStorage on unmount
  useEffect(() => {
    return () => {
      saveToLocalStorage();
    };
  }, [saveToLocalStorage]);

  // Save article function
  const saveArticle = useCallback(
    async (overrideStatus?: "draft" | "published") => {
      if (isInitialLoad) return;
      saveToLocalStorage();
      setSaveStatus("saving");

      const payload = {
        title,
        author: {
          name: authorName,
          avatarUrl: authorAvatar,
          affiliation: authorAffiliation,
        },
        category,
        featureImage: {
          url: featureImageUrl,
          altText: title || "Feature image",
        },
        state: overrideStatus || status,
        currentPageBody: blogBlocks, // native JSON or string if your API expects it
      };

      try {
        let savedBlog;
        if (!articleId) {
          const response = await blogApi.create({ ...payload, state: "draft" });
          savedBlog = response.data;
          setArticleId(savedBlog._id);
          navigate(`/admin/editor/${savedBlog._id}`, { replace: true });
          toast.success("Article created");
          localStorage.removeItem(`blog_draft_new`);
          localStorage.removeItem(`blog_draft_${savedBlog._id}`);
        } else {
          await blogApi.update(articleId, payload);
          localStorage.removeItem(`blog_draft_${articleId}`);
        }
        setSaveStatus("saved");
      } catch (error: any) {
        console.error("Save failed:", error);
        setSaveStatus("error");
        if (!error?.response) {
          toast.error("Network error - saved locally");
        } else {
          toast.error(error.response?.data?.detail || "Failed to save");
        }
      }
    },
    [
      articleId,
      title,
      authorName,
      authorAvatar,
      authorAffiliation,
      category,
      featureImageUrl,
      status,
      blogBlocks,
      saveToLocalStorage,
      isInitialLoad,
      navigate,
    ]
  );

  // Auto-save (debounced)
  useDebounce(
    () => {
      if (!isInitialLoad) {
        saveArticle();
      }
    },
    2000,
    [isInitialLoad, saveArticle]
  );

  // Publish / Unpublish
  const handlePublish = () => {
    setStatus("published");
    toast.success("Article published!");
    saveArticle("published");
  };

  const handleUnpublish = () => {
    setStatus("draft");
    toast.success("Article moved to draft");
    saveArticle("draft");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="container mx-auto h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Button variant="ghost" onClick={() => navigate("/admin")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            {/* Save indicator */}
            {saveStatus === "saving" && (
              <Badge variant="outline">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…
              </Badge>
            )}
            {saveStatus === "saved" && (
              <Badge className="bg-green-600/20 text-green-600">
                <Check className="w-3 h-3 mr-1" /> Saved
              </Badge>
            )}
            {saveStatus === "error" && (
              <Badge className="bg-red-600/20 text-red-600">
                <AlertCircle className="w-3 h-3 mr-1" /> Error
              </Badge>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            <BlogSettingsDialog
              authorName={authorName}
              setAuthorName={setAuthorName}
              authorAvatar={authorAvatar}
              setAuthorAvatar={setAuthorAvatar}
              authorAffiliation={authorAffiliation}
              setAuthorAffiliation={setAuthorAffiliation}
              category={category ?? (categories[0] ?? null)}
              setCategory={(c) => setCategory(c)}
              featureImageUrl={featureImageUrl}
              setFeatureImageUrl={setFeatureImageUrl}
            />

            {status === "draft" ? (
              <Button onClick={handlePublish}>Publish</Button>
            ) : (
              <Button variant="outline" onClick={handleUnpublish}>
                Unpublish
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Input
            placeholder="Article title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl font-bold tracking-tight border-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />

          <div className="max-w-none">
            {hasLoadedContent || isNew ? (
              <div className="not-prose">
                <BlockNoteEditor
                  key={articleId || "new"}
                  initialContent={blogBlocks}
                  onChange={(editorBlocks: BlockNoteDocument) => {
                    setBlogBlocks(editorBlocks);
                  }}
                />
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No content yet</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
