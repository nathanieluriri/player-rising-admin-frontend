import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { blogApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
// ADDED: ChevronDown
import { PlusCircle, LogOut, Edit, Trash2, Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import AnimatedContent from "@/components/AnimatedContent";
import ElectricBorder from "@/components/ElectricBorder";
import BlurText from "@/components/BlurText";

import { Category, fetchCategories } from "@/lib/api";

interface Blog {
  _id: string;
  title: string;
  state: "draft" | "published";
  author: { name: string };
  category: Category;
  last_updated: number;
  excerpt: string;
}

export default function Dashboard() {
  // categories must be inside the component (hooks)
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "draft" | "published">("all");
  
  // ADDED: State for scroll indicator
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const { logout, admin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBlogs();
  }, []);

  // ADDED: Scroll detection logic
  useEffect(() => {
    const checkScroll = () => {
      // Check if content exceeds viewport height
      const hasScroll = document.documentElement.scrollHeight > window.innerHeight;
      // Check if user is at the top (tolerance of 20px)
      const isScrolledDown = window.scrollY > 20;

      setShowScrollIndicator(hasScroll && !isScrolledDown);
    };

    // Initial check and listeners
    checkScroll();
    window.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      window.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
    // Dependencies ensure we re-check when content changes height
  }, [blogs, isLoading, activeTab, selectedCategory]);

  useEffect(() => {
    // load categories (only in this component)
    let mounted = true;
    setCategoriesLoading(true);
    fetchCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(data ?? []);
      })
      .catch((err) => {
        console.error("Failed to fetch categories", err);
        toast.error("Failed to load categories");
      })
      .finally(() => {
        if (mounted) setCategoriesLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadBlogs = async () => {
    try {
      const response = await blogApi.list();
      setBlogs(response.data || []);
    } catch (error) {
      toast.error("Failed to load blogs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await blogApi.delete(id);
      toast.success("Blog deleted");
      loadBlogs();
    } catch (error) {
      toast.error("Failed to delete blog");
    }
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const filteredBlogs = blogs.filter((blog) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      blog.title.toLowerCase().includes(q) ||
      blog._id.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "all" || blog.category?.slug === selectedCategory;

    const matchesTab = activeTab === "all" || blog.state === activeTab;

    return matchesSearch && matchesCategory && matchesTab;
  });

  const renderBlogList = (blogsToRender: Blog[]) => {
    if (!blogsToRender || blogsToRender.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No articles found</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {blogsToRender.map((blog, i) => (
          <AnimatedContent key={blog._id}>
              <Card className="transition-shadow hover:shadow-md" >
                <CardContent className="p-6" onClick={() => navigate(`/admin/editor/${blog._id}`)}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold truncate">
                          <BlurText text={blog.title} />
                        </h3>
                        <Badge
                          variant={blog.state === "published" ? "default" : "secondary"}
                        >
                          {blog.state} 
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          {blog.author.name} 
                        </span>
                        <span>•</span>
                        <span>
                          {blog.category?.name ?? "—"} 
                        </span>
                        <span>•</span>
                        <span>
                          <BlurText text={formatDate(blog.last_updated)} />
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground font-mono">
                        ID: {blog._id}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground font-mono">
                        Excerpt: {blog.excerpt}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/editor/${blog._id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(blog._id, blog.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </AnimatedContent>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background relative pb-20"> 
      {/* Note: Added pb-20 above to ensure bottom content isn't hidden behind fixed elements */}
      
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <BlurText text="Player Rising Admin" />
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{admin?.full_name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">
              <BlurText text="Articles" />
            </h2>
            <p className="text-muted-foreground">Manage your blog content</p>
            
            {/* Floating Action Button */}
            <div className="fixed z-50 bottom-6 right-6">
              <ElectricBorder>
                <Button
                  className="flex items-center gap-2 bg-primary text-white shadow-lg hover:shadow-xl"
                  size="lg"
                  onClick={() => navigate("/admin/editor/new")}
                >
                  <PlusCircle className="h-5 w-5" />
                  New Article
                </Button>
              </ElectricBorder>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : blogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No articles yet</p>
              <Button onClick={() => navigate("/admin/editor/new")}>
                Create your first article
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={selectedCategory}
                onValueChange={(val) => setSelectedCategory(val)}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="published">Published</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-6">
                {renderBlogList(filteredBlogs)}
              </TabsContent>
              <TabsContent value="draft" className="mt-6">
                {renderBlogList(filteredBlogs.filter((b) => b.state === "draft"))}
              </TabsContent>
              <TabsContent value="published" className="mt-6">
                {renderBlogList(filteredBlogs.filter((b) => b.state === "published"))}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* ADDED: Animated Scroll Indicator */}
      {showScrollIndicator && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-bounce text-muted-foreground/80 transition-opacity duration-300">
          <span className="text-[10px] uppercase tracking-widest mb-1 font-medium">Scroll</span>
          <ChevronDown className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}