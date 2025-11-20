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
  Send
} from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

  // ... [Keep your existing LocalStorage Logic here exactly as is] ...
  // For brevity, I am omitting the localStorage helper functions and useEffects 
  // assuming you keep them exactly the same as your previous code.
  
  // -----------------------------------------------------------------------
  // PASTE YOUR LOCAL STORAGE & LOADING USEEFFECTS HERE (No changes needed)
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
  const StatusIndicator = () => {
    if (saveStatus === "saving") return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    if (saveStatus === "error") return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <Check className="w-4 h-4 text-green-500" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER: Mobile Friendly */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-5xl mx-auto h-14 px-4 flex items-center justify-between">
          
          {/* Left: Back & Status */}
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="-ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            {/* Minimal status for mobile */}
            <div className="flex items-center text-xs text-muted-foreground">
              <StatusIndicator />
              <span className="ml-1.5 hidden sm:inline">
                {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Error'}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            
            {/* DESKTOP VIEW (Hidden on Mobile) */}
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

              <div className="w-px h-4 bg-border mx-1" />

              {status === "draft" ? (
                <Button size="sm" onClick={handlePublish} className="gap-2">
                   <Send className="w-3.5 h-3.5" /> Publish
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={handleUnpublish}>
                  Unpublish
                </Button>
              )}
            </div>

            {/* MOBILE VIEW (Visible on small screens) */}
            <div className="flex md:hidden items-center gap-1">
              {/* Primary Action: Publish (Icon Only) */}
              {status === "draft" && (
                 <Button variant="ghost" size="icon" onClick={handlePublish} className="text-primary">
                    <Send className="w-5 h-5" />
                 </Button>
              )}

              {/* "More" Menu for Settings/Media */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {/* Note: DialogTriggers inside DropdownItems need preventDefault to work properly */}
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <div className="flex items-center w-full" onClick={(e) => e.stopPropagation()}>
                       {/* Render Modal Trigger directly but styled like a menu item */}
                       <MediaUploaderModal 
                          onUploadSuccess={() => window.location.reload()} 
                          mediaId={articleId} 
                          label="Add Media"
                          variant="ghost"
                          
                          
                       />
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <div className="flex items-center w-full" onClick={(e) => e.stopPropagation()}>
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
                        // You might need to adjust your BlogSettingsDialog trigger to accept className/variant props 
                        // to blend in perfectly, or just wrap it like this.
                      />
                    </div>
                  </DropdownMenuItem>

                  {status === "published" && (
                    <>
                      <DropdownMenuItem onClick={handleUnpublish} className="text-destructive focus:text-destructive">
                        Unpublish Article
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        </div>
      </header>

      {/* Editor Content Area */}
      <main className="container max-w-5xl mx-auto px-4 py-6 sm:py-10">
        <div className="space-y-4 sm:space-y-6">
          
          {/* Title Input - Adjusted for Mobile */}
          <div className="px-14">
            <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="
              text-3xl sm:text-4xl md:text-5xl 
              font-bold tracking-tight 
            
              border-none px-0 shadow-none
              focus-visible:ring-0 
              placeholder:text-muted-foreground/40
              text-left /* Medium style: Left align title */
              h-auto py-2
              
            "
          />
          </div>

          <div className="max-w-none min-h-[50vh]">
            {hasLoadedContent || isNew ? (
              <div className="not-prose -mx-4 sm:mx-0"> 
                {/* Negative margin on mobile to let editor touch edges if desired */}
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