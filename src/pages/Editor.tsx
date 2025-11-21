import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { BlogSettingsDialog, BlogType } from "@/components/BlogSettingsDialog";
import { blogApi } from "@/lib/api";
import "@blocknote/core/style.css";
import "@blocknote/react/style.css";
import { 
  ArrowLeft, 
  Check, 
  Loader2, 
  AlertCircle, 
  MoreVertical, 
  Image as ImageIcon, 
  Settings,
  Send,
  FileText
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import useCategories from "@/hooks/useCategories";
import { Category } from "@/lib/api";
import type { PartialBlock } from "@blocknote/core";
import { MediaUploaderModal } from "@/components/MediaUploaderWithCaptionComponent";

type BlockNoteDocument = PartialBlock<any>[];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";

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
  const [blogType, setBlogType] = useState<BlogType>("normal");
  
  const [blogBlocks, setBlogBlocks] = useState<BlockNoteDocument>([]);

  // save + loading states
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedContent, setHasLoadedContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // -----------------------------------------------------------------------
  // LOCAL STORAGE LOGIC
  // -----------------------------------------------------------------------
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
        blogType, 
        lastSaved: Date.now(),
      };
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(data));
    } catch (err) {
      console.error("Failed to save draft to localStorage", err);
    }
  }, [isInitialLoad, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, blogType, getLocalStorageKey]);

  const loadFromLocalStorage = useCallback((key: string) => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!category && !categoriesLoading && categories.length > 0) {
      setCategory(categories[0]);
    }
  }, [categories, categoriesLoading, category]);

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
      setBlogType(localData.blogType || "normal"); 
      setHasLoadedContent(true);
      setIsInitialLoad(false);
      toast.info("Restored local draft");
      return true;
    };

    const doLoad = async () => {
      setIsLoading(true);
      if (!isNew && articleId) {
        try {
          const response = await blogApi.getById(articleId);
          const blog = response.data;
          if (!mounted) return;
          setTitle(blog.title || "");
          setAuthorName(blog.author?.name || "");
          setAuthorAvatar(blog.author?.avatarUrl || "");
          setAuthorAffiliation(blog.author?.affiliation || "");
          const foundCat = categories.find((c) => c.slug === blog.category?.slug) ?? categories[0] ?? null;
          setCategory(foundCat);
          setFeatureImageUrl(blog.featureImage?.url || "");
          setStatus(blog.state || "draft");
          setBlogType((blog.blogType as BlogType) || "normal");
          let blocks = blog.currentPageBody ?? [];
          if (typeof blocks === "string") {
            try { blocks = JSON.parse(blocks); } catch (err) { blocks = []; }
          }
          setBlogBlocks(blocks);
          setHasLoadedContent(true);
          localStorage.removeItem(getLocalStorageKey());
        } catch (error: any) {
          const restored = restoreLocal();
          if (!restored) setHasLoadedContent(true);
        } finally {
          if (mounted) { setIsInitialLoad(false); setIsLoading(false); }
        }
      } else {
        const restored = restoreLocal();
        if (!restored) { setHasLoadedContent(true); setIsInitialLoad(false); }
        setIsLoading(false);
      }
    };
    doLoad();
    return () => { mounted = false; };
  }, [articleId, isNew, categories]);

  useEffect(() => {
    return () => { saveToLocalStorage(); };
  }, [saveToLocalStorage]);

  // -----------------------------------------------------------------------
  // SAVE FUNCTION
  // -----------------------------------------------------------------------

  const saveArticle = useCallback(
    async (overrideStatus?: "draft" | "published", overrideBlogType?: BlogType) => {
      if (isInitialLoad) return;
      saveToLocalStorage();
      setSaveStatus("saving");

      const payload = {
        title,
        author: { name: authorName, avatarUrl: authorAvatar, affiliation: authorAffiliation },
        category,
        featureImage: { url: featureImageUrl, altText: title || "Feature image" },
        state: overrideStatus || status,
        currentPageBody: blogBlocks,
        blogType: overrideBlogType || blogType
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
        if (!error?.response) toast.error("Network error - saved locally");
        else toast.error(error.response?.data?.detail || "Failed to save");
      }
    },
    [articleId, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, blogType, saveToLocalStorage, isInitialLoad, navigate]
  );

  useDebounce(() => { if (!isInitialLoad) saveArticle(); }, 2000, [isInitialLoad, saveArticle]);

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

  // Helper for status icons
  const StatusIndicator = ({ className }: { className?: string }) => {
    if (saveStatus === "saving") return <Loader2 className={`animate-spin text-muted-foreground ${className || "w-4 h-4"}`} />;
    if (saveStatus === "error") return <AlertCircle className={`text-red-500 ${className || "w-4 h-4"}`} />;
    return <Check className={`text-green-500 ${className || "w-4 h-4"}`} />;
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* HEADER: Sticky & Glassmorphic */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-5xl mx-auto h-16 px-4 flex items-center justify-between">
          
          {/* Left: Back & Status */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="h-10 w-10 -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground hidden sm:inline-block">
                   {status === 'draft' ? 'Draft' : 'Published'}
                </span>
                <div className="flex items-center gap-1.5">
                    <StatusIndicator className="w-3 h-3" />
                    <span className="text-xs text-muted-foreground">
                    {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
                    </span>
                </div>
            </div>
          </div>

          {/* Right: Desktop Actions (Hidden on Mobile) */}
          <div className="hidden md:flex items-center gap-2">
            <MediaUploaderModal 
              onUploadSuccess={() => window.location.reload()} 
              mediaId={articleId} 
              label="Add Media"
              variant="ghost"
            />
            
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
              blogType={blogType}
              setBlogType={setBlogType}
            />

            <div className="w-px h-6 bg-border mx-2" />

            {status === "draft" ? (
              <Button onClick={handlePublish} className="gap-2 px-6">
                 Publish <Send className="w-4 h-4" /> 
              </Button>
            ) : (
              <Button variant="outline" onClick={handleUnpublish}>
                Unpublish
              </Button>
            )}
          </div>

          {/* Mobile Actions: Minimal (Publish Icon Only) */}
          <div className="flex md:hidden items-center gap-1">
            {status === "draft" && (
                 <Button size="sm" onClick={handlePublish} className="bg-primary text-primary-foreground h-9 px-4 text-xs font-medium rounded-full">
                    Publish
                 </Button>
            )}
             {/* Note: Settings & Media moved to Bottom Bar for Mobile */}
          </div>
        </div>
      </header>

      {/* Editor Content Area */}
      <main className="container max-w-4xl mx-auto px-4 py-6 sm:py-12">
        <div className="space-y-6">
          
          {/* Title Input - Refined for Readability */}
          <div className="relative group px-14">
            <Input
            placeholder="Article Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="
              text-3xl sm:text-4xl md:text-5xl 
              font-extrabold tracking-tight leading-tight
              border-none px-0 shadow-none
              focus-visible:ring-0 
              bg-transparent
              placeholder:text-muted-foreground/30
              h-auto py-2
              w-full
            "
            />
            {/* Optional: Add a subtle divider line that appears on focus or hover could go here */}
          </div>

          {/* Author / Category Meta Snippet (Visual enhancement) */}
          <div className="flex px-14 items-center gap-3 text-sm text-muted-foreground pb-2">
             {category && <Badge variant="secondary" className="rounded-sm font-normal">{category.name}</Badge>}
             {authorName && <span>by {authorName}</span>}
          </div>

          {/* Editor Wrapper */}
          <div className="min-h-[50vh] animate-in fade-in duration-500">
            {hasLoadedContent || isNew ? (
              // Negative margin adjustment for mobile to feel native
              <div className="not-prose -mx-4 sm:mx-0"> 
                <BlockNoteEditor
                  key={articleId || "new"}
                  initialContent={blogBlocks}
                  onChange={(editorBlocks: BlockNoteDocument) => {
                    setBlogBlocks(editorBlocks);
                  }}
                  // You can add specific theme override props here if your BlockNote component supports them
                />
              </div>
            ) : isLoading ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                <p className="text-sm">Loading editor...</p>
              </div>
            ) : (
              <div className="h-[50vh] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <FileText className="h-10 w-10 opacity-20" />
                <p>Ready to write</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MOBILE BOTTOM BAR: Productivity & Settings */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-t border-border z-50 px-6 flex items-center justify-between safe-area-bottom">
        
        {/* Media Trigger */}
        <MediaUploaderModal 
            onUploadSuccess={() => window.location.reload()} 
            mediaId={articleId} 
            label="" // Empty label for icon-only
            variant="ghost"
           
        />

        {/* Center: Word Count or Status (Optional placeholder) */}
        <div className="text-xs text-muted-foreground font-medium">
           {saveStatus === "saving" ? "Saving..." : "Synced"}
        </div>

        {/* Settings Trigger */}
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full">
                    <Settings className="w-6 h-6" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 mb-4">
                <div className="p-2">
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
                        blogType={blogType}
                        setBlogType={setBlogType}
                    />
                </div>
                <DropdownMenuSeparator />
                {status === "published" && (
                    <DropdownMenuItem onClick={handleUnpublish} className="text-destructive p-3 cursor-pointer">
                        Unpublish Article
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}