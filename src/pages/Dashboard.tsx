import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { blogApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PlusCircle, LogOut, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Blog {
  _id: string;
  title: string;
  state: "draft" | "published";
  author: { name: string };
  category: { name: string };
  last_updated: number;
}

export default function Dashboard() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { logout, admin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadBlogs();
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

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Blog Admin</h1>
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
            <h2 className="text-3xl font-bold mb-2">Articles</h2>
            <p className="text-muted-foreground">Manage your blog content</p>
          </div>
          <Button onClick={() => navigate("/admin/editor/new")}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Article
          </Button>
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
          <div className="space-y-4">
            {blogs.map((blog) => (
              <Card key={blog._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold truncate">{blog.title}</h3>
                        <Badge variant={blog.state === "published" ? "default" : "secondary"}>
                          {blog.state}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{blog.author.name}</span>
                        <span>•</span>
                        <span>{blog.category.name}</span>
                        <span>•</span>
                        <span>Updated {formatDate(blog.last_updated)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/editor/${blog._id}`)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
