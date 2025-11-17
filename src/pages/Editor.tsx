import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { BlogSettingsDialog, CATEGORIES } from "@/components/BlogSettingsDialog";
import { blogApi } from "@/lib/api";
// Import all types and functions from your translator
import { blockNoteToApi, apiToBlockNote } from "@/lib/translator";
import type { APIBlock } from "@/lib/translator"; // <-- We only need APIBlock
import { ArrowLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// --- The sanitizeBlocks function is no longer needed ---

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

  const [articleId, setArticleId] = useState<string | null>(isNew ? null : id || null);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorAvatar, setAuthorAvatar] = useState("");
  const [authorAffiliation, setAuthorAffiliation] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [featureImageUrl, setFeatureImageUrl] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  
  // 1. STATE FIX: The state now holds your APIBlock type
  const [blogBlocks, setBlogBlocks] = useState<APIBlock[]>([]);
  
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedContent, setHasLoadedContent] = useState(false);

  const getLocalStorageKey = () => `blog_draft_${articleId || 'new'}`;

  const saveToLocalStorage = useCallback(() => {
    if (isInitialLoad) return;
    const data = {
      title,
      authorName,
      authorAvatar,
      authorAffiliation,
      category,
      featureImageUrl,
      status,
      blogBlocks, // <-- This is already APIBlock[]
      lastSaved: Date.now(),
    };
    localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
  }, [isInitialLoad, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, articleId]);

  const loadFromLocalStorage = (key: string) => {
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return null;
  };

  useEffect(() => {
    if (!isNew && articleId) {
      loadArticle(articleId);
    } else {
      const localData = loadFromLocalStorage(getLocalStorageKey());
      if (localData) {
        setTitle(localData.title || "");
        setAuthorName(localData.authorName || "");
        setAuthorAvatar(localData.authorAvatar || "");
        setAuthorAffiliation(localData.authorAffiliation || "");
        setCategory(localData.category || CATEGORIES[0]);
        setFeatureImageUrl(localData.featureImageUrl || "");
        setStatus(localData.status || "draft");
        // 2. LOAD FIX: No sanitizing needed, just set the raw APIBlocks
        setBlogBlocks(localData.blogBlocks || []);
        setHasLoadedContent(true);
      }
      setIsInitialLoad(false);
    }
  }, [articleId, isNew]);

  // Save draft to local storage on unmount
  useEffect(() => {
    return () => {
      saveToLocalStorage();
    };
  }, [saveToLocalStorage]);

  const loadArticle = async (id: string) => {
    try {
      const response = await blogApi.getById(id);
      const blog = response.data;

      setTitle(blog.title);
      setAuthorName(blog.author.name);
      setAuthorAvatar(blog.author.avatarUrl || "");
      setAuthorAffiliation(blog.author.affiliation);
      const cat = CATEGORIES.find(c => c.slug === blog.category.slug) || CATEGORIES[0];
      setCategory(cat);
      setFeatureImageUrl(blog.featureImage.url);
      setStatus(blog.state);

      // 3. LOAD FIX: Set the raw API blocks from the API
      setBlogBlocks(blog.currentPageBody || []);
      setHasLoadedContent(true);
      localStorage.removeItem(getLocalStorageKey());

    } catch (error: any) {
      console.error("Failed to load article:", error);
      toast.error(error?.response?.data?.detail || "Failed to load article");

      const localData = loadFromLocalStorage(getLocalStorageKey());
      if (localData) {
        // ... (load from local as fallback)
        setTitle(localData.title || "");
        setAuthorName(localData.authorName || "");
        setAuthorAvatar(localData.authorAvatar || "");
        setAuthorAffiliation(localData.authorAffiliation || "");
        setCategory(localData.category || CATEGORIES[0]);
        setFeatureImageUrl(localData.featureImageUrl || "");
        setStatus(localData.status || "draft");
        setBlogBlocks(localData.blogBlocks || []); // <-- Also raw APIBlocks
        setHasLoadedContent(true);
        toast.info("Loaded from local draft");
      }
    } finally {
      setIsInitialLoad(false);
    }
  };

  // 4. SAVE FIX: This is now MUCH simpler
  const saveArticle = useCallback(async (overrideStatus?: "draft" | "published") => {
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
      // The state is already in the correct format!
      currentPageBody: blogBlocks, 
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
      // ... (error handling toasts)
      if (!error.response) {
        toast.error("Network error - saved locally", { /* ... */ });
      } else {
        toast.error(error.response?.data?.detail || "Failed to save", { /* ... */ });
      }
    }
  }, [
    articleId, title, authorName, authorAvatar, authorAffiliation, 
    category, featureImageUrl, status, blogBlocks, navigate, 
    saveToLocalStorage, isInitialLoad
  ]);

  // Auto-save logic (unchanged, but now correct)
  useDebounce(
    () => {
      if (!isInitialLoad) {
        saveArticle();
      }
    },
    2000,
    [isInitialLoad, saveArticle]
  );

  // Publish/Unpublish handlers (unchanged, but now correct)
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
      {/* Header (unchanged) */}
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
  <div className="container mx-auto px-4 py-3 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      <div className="flex items-center gap-2 text-sm">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saving...</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Saved</span>
          </>
        )}
        {saveStatus === "error" && (
          <span className="text-destructive">Error saving</span>
        )}
      </div>
    </div>

    <div className="flex items-center gap-3">
      <BlogSettingsDialog
        authorName={authorName}
        setAuthorName={setAuthorName}
        authorAvatar={authorAvatar}
        setAuthorAvatar={setAuthorAvatar}
        authorAffiliation={authorAffiliation}
        setAuthorAffiliation={setAuthorAffiliation}
        category={category}
        setCategory={setCategory}
        featureImageUrl={featureImageUrl}
        setFeatureImageUrl={setFeatureImageUrl}
      />

      <Badge variant={status === "published" ? "default" : "secondary"}>
        {status}
      </Badge>

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

          <div className="prose prose-lg max-w-none">
            {hasLoadedContent || isNew ? (
              <div className="not-prose"> {/* <-- This CSS fix is still needed */}
                <BlockNoteEditor
                  key={articleId || 'new'}
                  // 5. EDITOR FIX 1: Pass the raw APIBlocks
                  initialContent={blogBlocks}
                  // 6. EDITOR FIX 2: Translate BlockNote's output back to APIBlocks
                  onChange={(editorBlocks) => {
                    setBlogBlocks(blockNoteToApi(editorBlocks));
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}