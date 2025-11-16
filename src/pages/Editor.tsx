import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { BlogSettingsDialog, CATEGORIES } from "@/components/BlogSettingsDialog";
import { blogApi } from "@/lib/api";
import { blockNoteToApi } from "@/lib/translator";
import type { APIBlock } from "@/lib/translator";
import { ArrowLeft, Check, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [blogBlocks, setBlogBlocks] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedContent, setHasLoadedContent] = useState(false);

  // Local storage key for draft
  const getLocalStorageKey = () => `blog_draft_${articleId || 'new'}`;

  // Save to localStorage
  const saveToLocalStorage = useCallback(() => {
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
  }, [title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, articleId]);

  // Load from localStorage
  const loadFromLocalStorage = () => {
    try {
      const data = localStorage.getItem(getLocalStorageKey());
      if (data) {
        const parsed = JSON.parse(data);
        return parsed;
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return null;
  };

  // Load existing article
  useEffect(() => {
    console.log("Editor mounted:", { isNew, articleId });
    if (!isNew && articleId) {
      loadArticle(articleId);
    } else {
      // Check localStorage for new articles
      const localData = loadFromLocalStorage();
      if (localData) {
        setTitle(localData.title || "");
        setAuthorName(localData.authorName || "");
        setAuthorAvatar(localData.authorAvatar || "");
        setAuthorAffiliation(localData.authorAffiliation || "");
        setCategory(localData.category || CATEGORIES[0]);
        setFeatureImageUrl(localData.featureImageUrl || "");
        setStatus(localData.status || "draft");
        setBlogBlocks(localData.blogBlocks || []);
        setHasLoadedContent(true);
      }
      setIsInitialLoad(false);
    }
  }, [articleId, isNew]);

  const loadArticle = async (id: string) => {
    try {
      console.log("Loading article:", id);
      
      // Check localStorage first
      const localData = loadFromLocalStorage();
      const localTimestamp = localData?.lastSaved || 0;
      
      const response = await blogApi.getById(id);
      const blog = response.data;
      
      console.log("Article loaded:", blog);
      
      // Use server data (it's the source of truth for existing articles)
      setTitle(blog.title);
      setAuthorName(blog.author.name);
      setAuthorAvatar(blog.author.avatarUrl || "");
      setAuthorAffiliation(blog.author.affiliation);
      
      const cat = CATEGORIES.find(c => c.slug === blog.category.slug) || CATEGORIES[0];
      setCategory(cat);
      
      setFeatureImageUrl(blog.featureImage.url);
      setStatus(blog.state);
      setBlogBlocks(blog.currentPageBody || []);
      setHasLoadedContent(true);
      
      // Clear old localStorage data
      localStorage.removeItem(getLocalStorageKey());
      
    } catch (error: any) {
      console.error("Failed to load article:", error);
      toast.error(error?.response?.data?.detail || "Failed to load article");
      
      // Try to load from localStorage as fallback
      const localData = loadFromLocalStorage();
      if (localData) {
        setTitle(localData.title || "");
        setAuthorName(localData.authorName || "");
        setAuthorAvatar(localData.authorAvatar || "");
        setAuthorAffiliation(localData.authorAffiliation || "");
        setCategory(localData.category || CATEGORIES[0]);
        setFeatureImageUrl(localData.featureImageUrl || "");
        setStatus(localData.status || "draft");
        setBlogBlocks(localData.blogBlocks || []);
        setHasLoadedContent(true);
        toast.info("Loaded from local draft");
      }
    } finally {
      setIsInitialLoad(false);
    }
  };

  const saveArticle = useCallback(async () => {
    if (!title.trim()) return;

    // Always save to localStorage first
    saveToLocalStorage();
    
    setSaveStatus("saving");

    const apiCompatibleBody: APIBlock[] = blockNoteToApi(blogBlocks);

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
        altText: title,
      },
      state: status,
      currentPageBody: apiCompatibleBody,
    };

    try {
      let savedBlog;
      if (!articleId) {
        const response = await blogApi.create({ ...payload, state: "draft" });
        savedBlog = response.data;
        setArticleId(savedBlog._id);
        navigate(`/admin/editor/${savedBlog._id}`, { replace: true });
        toast.success("Article created");
      } else {
        const response = await blogApi.update(articleId, payload);
        savedBlog = response.data;
      }
      
      setSaveStatus("saved");
      // Clear localStorage after successful save
      localStorage.removeItem(getLocalStorageKey());
    } catch (error: any) {
      console.error("Save failed:", error);
      setSaveStatus("error");
      
      // Network error
      if (!error.response) {
        toast.error("Network error - saved locally", {
          description: "Your changes are saved locally and will sync when connection is restored",
          icon: <AlertCircle className="h-4 w-4" />,
        });
      } else {
        toast.error(error.response?.data?.detail || "Failed to save", {
          description: "Your changes are saved locally",
          icon: <AlertCircle className="h-4 w-4" />,
        });
      }
    }
  }, [articleId, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, navigate, saveToLocalStorage]);

  // Auto-save with debounce
  useDebounce(
    () => {
      if (!isInitialLoad && title && blogBlocks.length > 0) {
        saveArticle();
      }
    },
    2000,
    [title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, isInitialLoad]
  );

  const handlePublish = () => {
    setStatus("published");
    toast.success("Article published!");
  };

  const handleUnpublish = () => {
    setStatus("draft");
    toast.success("Article moved to draft");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                  <Check className="h-4 w-4 text-success" />
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
          {/* Title */}
          <Input
            placeholder="Article title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-4xl font-bold border-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />

          {/* BlockNote Editor */}
          <div className="prose prose-lg max-w-none">
            {hasLoadedContent || isNew ? (
              <BlockNoteEditor
                key={articleId || 'new'}
                initialContent={blogBlocks}
                onChange={setBlogBlocks}
              />
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
