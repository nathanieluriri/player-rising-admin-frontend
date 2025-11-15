import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "react-use";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BlockNoteEditor } from "@/components/BlockNoteEditor";
import { ImageUploader } from "@/components/ImageUploader";
import { blogApi } from "@/lib/api";
import { blockNoteToApi } from "@/lib/translator";
import type { APIBlock } from "@/lib/translator";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { name: "Juventus", slug: "juventus" },
  { name: "Manchester United", slug: "manchester-united" },
  { name: "Manchester City", slug: "manchester-city" },
  { name: "Arsenal", slug: "arsenal" },
  { name: "Chelsea", slug: "chelsea" },
  { name: "Liverpool", slug: "liverpool" },
];

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

  // Load existing article
  useEffect(() => {
    if (!isNew && articleId) {
      loadArticle(articleId);
    } else {
      setIsInitialLoad(false);
    }
  }, [articleId, isNew]);

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
      setBlogBlocks(blog.currentPageBody);
    } catch (error) {
      toast.error("Failed to load article");
    } finally {
      setIsInitialLoad(false);
    }
  };

  const saveArticle = useCallback(async () => {
    if (!title.trim()) return;

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
    } catch (error: any) {
      console.error("Save failed:", error);
      setSaveStatus("error");
      toast.error(error.response?.data?.detail || "Failed to save");
    }
  }, [articleId, title, authorName, authorAvatar, authorAffiliation, category, featureImageUrl, status, blogBlocks, navigate]);

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
        {/* Metadata Form */}
        <div className="space-y-6 mb-8">
          <div className="space-y-2">
            <Input
              placeholder="Article title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-4xl font-bold border-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-y border-border">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Author Name</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Author Affiliation</Label>
                <Input
                  value={authorAffiliation}
                  onChange={(e) => setAuthorAffiliation(e.target.value)}
                  placeholder="Sports Journalist"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category.slug}
                  onValueChange={(slug) => {
                    const cat = CATEGORIES.find(c => c.slug === slug);
                    if (cat) setCategory(cat);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Author Avatar</Label>
                <ImageUploader
                  currentUrl={authorAvatar}
                  onChange={setAuthorAvatar}
                  label="Upload Avatar"
                />
              </div>

              <div className="space-y-2">
                <Label>Feature Image</Label>
                <ImageUploader
                  currentUrl={featureImageUrl}
                  onChange={setFeatureImageUrl}
                  label="Upload Feature Image"
                />
              </div>
            </div>
          </div>
        </div>

        {/* BlockNote Editor */}
        <div className="prose prose-lg max-w-none">
          <BlockNoteEditor
            initialContent={blogBlocks}
            onChange={setBlogBlocks}
          />
        </div>
      </main>
    </div>
  );
}
