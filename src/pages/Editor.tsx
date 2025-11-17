import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { BlogSettingsDialog, CATEGORIES } from "@/components/BlogSettingsDialog";
import { blogApi } from "@/lib/api";
import "@blocknote/core/style.css";
import "@blocknote/react/style.css";
import { ArrowLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
 
import type { PartialBlock } from "@blocknote/core";

// We'll use this type alias for clarity. It's BlockNote's native format.
type BlockNoteDocument = PartialBlock<any>[];

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
  
  // ✅ 1. STATE FIX: The state now holds BlockNote's native JSON document.
  const [blogBlocks, setBlogBlocks] = useState<BlockNoteDocument>([]);
  
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
      blogBlocks, // <-- Saves the native BlockNote JSON
      lastSaved: Date.now(),
    };
    // ✅ JSON.stringify works perfectly on BlockNote's native objects.
    localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
  }, [isInitialLoad, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, articleId]);

  const loadFromLocalStorage = (key: string) => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        // ✅ JSON.parse correctly turns the string back into BlockNote's native objects.
        return JSON.parse(data);
      }
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
        // ✅ 2. LOAD FIX: No translation needed. Just set the native JSON.
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

      // ✅ 3. LOAD FIX: Set the raw native JSON from the API.
      // **IMPORTANT**: This assumes `blog.currentPageBody` IS the BlockNote JSON.
      // If it's a string, you must use `JSON.parse(blog.currentPageBody)`.
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
        // ... (set other fields)
        setBlogBlocks(localData.blogBlocks || []); // <-- Also native JSON
        setHasLoadedContent(true);
        toast.info("Loaded from local draft");
      }
    } finally {
      setIsInitialLoad(false);
    }
  };

  // ✅ 4. SAVE FIX: This is now MUCH simpler
  const saveArticle = useCallback(async (overrideStatus?: "draft" | "published") => {
    if (isInitialLoad) return;

    saveToLocalStorage();
    setSaveStatus("saving");

    // **IMPORTANT**: Your API endpoint for `currentPageBody` must now accept
    // BlockNote's native JSON object array (or a stringified version).
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
      // ✅ We send the native JSON directly. No translation.
      currentPageBody: blogBlocks, 
    };

    try {
      let savedBlog;
      if (!articleId) {
        const response = await blogApi.create({ ...payload, state: "draft" });
        savedBlog = response.data;
        // ... (rest of navigation/toast logic)
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

  // Auto-save logic (unchanged, now correct)
  useDebounce(
    () => {
      if (!isInitialLoad) {
        saveArticle();
      }
    },
    2000,
    [isInitialLoad, saveArticle]
  );

  // Publish/Unpublish handlers (unchanged, now correct)
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
  <div className="container mx-auto h-16 px-4 flex items-center justify-between">

    {/* LEFT: Back Button */}
    <div className="container flex gap-5">
 <Button variant="ghost" onClick={() => navigate("/admin")}>
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>

 {/* CENTER: Save indicator */}
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
   

   

    {/* RIGHT: Publish + Settings */}
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

      {status === "draft" ? (
        <Button onClick={handlePublish}>Publish</Button>
      ) : (
        <Button variant="outline" onClick={handleUnpublish}>Unpublish</Button>
      )}
    </div>

  </div>
</header>


      {/* Editor Content */}
      <main className=" container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Input
            placeholder="Article title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl font-bold tracking-tight border-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />

          <div className=" max-w-none">
            {hasLoadedContent || isNew ? (
              <div className="not-prose">  
                <BlockNoteEditor
                  key={articleId || 'new'}
                  // ✅ 5. EDITOR FIX 1: Pass the native JSON document
                  initialContent={blogBlocks}
                  // ✅ 6. EDITOR FIX 2: Receive the native JSON document
                  onChange={(editorBlocks) => {
                    setBlogBlocks(editorBlocks); // No translation needed!
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