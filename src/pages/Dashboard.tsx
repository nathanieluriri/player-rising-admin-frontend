import { useEffect, useState, useMemo } from "react"; // ✅ Added useMemo
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { blogApi, Category, fetchCategories } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { 
    PlusCircle, 
    LogOut, 
    Edit, 
    Trash2, 
    Search, 
    Film,
    FileText,
    CheckSquare,
    Square,
    ChevronLeft,
    ChevronRight,
    UploadCloud,
    FileEdit,
    AlertTriangle,
    ArrowDownWideNarrow, // ✅ Added for sorting icon
} from "lucide-react";
import { toast } from "sonner";

import AnimatedContent from "@/components/AnimatedContent";
import ElectricBorder from "@/components/ElectricBorder";
import BlurText from "@/components/BlurText";

// --- Types ---
interface Blog {
    _id: string;
    title: string;
    state: "draft" | "published";
    author: { name: string };
    category: Category;
    dateCreated:number;
    lastUpdated: number;
    excerpt: string;
    blogType: "normal" | "editors pick" | "hero section" | "featured story"; 
    totalItems: number;
    itemIndex: number;
}

// --- Component Start ---
export default function Dashboard() {
    // Data State
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<"all" | "draft" | "published">("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    
    // ✅ NEW SORT STATE
    const [sortCriteria, setSortCriteria] = useState<'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc'>('updated_desc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Confirmation Dialog State (Kept from previous refactor)
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        description: React.ReactNode;
        action: () => Promise<void> | void;
        variant: "default" | "destructive";
        confirmText: string;
    }>({
        title: "",
        description: "",
        action: () => {},
        variant: "default",
        confirmText: "Continue"
    });

    const { logout, admin } = useAuth();
    const navigate = useNavigate();

    // --- 1. Data Loading (Unchanged) ---
    useEffect(() => {
        loadBlogs();
    }, []);

    useEffect(() => {
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
        return () => { mounted = false; };
    }, []);

    const loadBlogs = async () => {
        try {
            const response = await blogApi.list({ start: 0, stop: 1000 }); 
            setBlogs(response.data || []);
        } catch (error) {
            toast.error("Failed to load blogs");
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. Sorting and Filtering Logic ---

    const sortedAndFilteredBlogs = useMemo(() => {
        // 1. Apply Filtering (on the raw list)
        const filtered = blogs.filter((blog) => {
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                blog.title.toLowerCase().includes(q) ||
                blog._id.toLowerCase().includes(q);
            const matchesCategory =
                selectedCategory === "all" || blog.category?.slug === selectedCategory;
            const matchesType = 
                selectedType === "all" || (blog.blogType || "normal") === selectedType;
            const matchesTab = activeTab === "all" || blog.state === activeTab;
            return matchesSearch && matchesCategory && matchesTab && matchesType;
        });

        // 2. Apply Sorting (on the filtered list)
        return filtered.sort((a, b) => {
            const [field, direction] = sortCriteria.split('_');
            const aValue = field === 'lastUpdated' ? a.lastUpdated : a.dateCreated;
            const bValue = field === 'lastUpdated' ? b.lastUpdated : b.dateCreated;

            if (aValue === bValue) return 0;

            if (direction === 'asc') {
                return aValue < bValue ? -1 : 1;
            } else { // 'desc'
                return aValue > bValue ? -1 : 1;
            }
        });
    }, [blogs, searchQuery, selectedCategory, selectedType, activeTab, sortCriteria]);

    // Reset page when filters/sort change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, selectedType, activeTab, sortCriteria]);

    // --- 3. Pagination Logic ---
    const totalPages = Math.ceil(sortedAndFilteredBlogs.length / itemsPerPage);
    const paginatedBlogs = sortedAndFilteredBlogs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- 4. Action Handlers (Confirmation Logic Unchanged) ---
    const triggerConfirm = (
        title: string, 
        description: React.ReactNode, 
        action: () => Promise<void> | void, 
        variant: "default" | "destructive" = "default",
        confirmText: string = "Continue"
    ) => {
        setConfirmConfig({ title, description, action, variant, confirmText });
        setConfirmOpen(true);
    };

    const handleDelete = (id: string, title: string) => {
        triggerConfirm(
            "Delete Article?",
            <span>Are you sure you want to delete <strong>"{title}"</strong>? This action cannot be undone.</span>,
            async () => {
                try {
                    await blogApi.delete(id);
                    toast.success("Blog deleted");
                    loadBlogs();
                    const newSelected = new Set(selectedIds);
                    newSelected.delete(id);
                    setSelectedIds(newSelected);
                } catch (error) {
                    toast.error("Failed to delete blog");
                }
            },
            "destructive",
            "Delete"
        );
    };

    const handleSelectOne = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === paginatedBlogs.length && paginatedBlogs.length > 0) {
            setSelectedIds(new Set());
        } else {
            const newSelected = new Set(selectedIds);
            paginatedBlogs.forEach(blog => newSelected.add(blog._id));
            setSelectedIds(newSelected);
        }
    };

    // Mass Actions
    const performMassAction = (action: 'delete' | 'publish' | 'draft') => {
        if (selectedIds.size === 0) return;
        
        const actionText = action === 'delete' ? 'delete' : action === 'publish' ? 'publish' : 'revert to draft';
        const variant = action === 'delete' ? 'destructive' : 'default';
        
        triggerConfirm(
            `Confirm ${action === 'delete' ? 'Deletion' : 'Update'}`,
            <span>Are you sure you want to <strong>{actionText} {selectedIds.size}</strong> item(s)?</span>,
            async () => {
                const toastId = toast.loading(`Processing ${selectedIds.size} items...`);
                try {
                    const ids = Array.from(selectedIds);
                    await Promise.all(ids.map(id => {
                        if (action === 'delete') return blogApi.delete(id);
                        if (action === 'publish') return blogApi.update(id, { state: 'published' });
                        if (action === 'draft') return blogApi.update(id, { state: 'draft' });
                        return Promise.resolve();
                    }));

                    toast.dismiss(toastId);
                    toast.success(`Successfully ${action === 'delete' ? 'deleted' : 'updated'} items`);
                    
                    setSelectedIds(new Set());
                    loadBlogs();
                } catch (error) {
                    console.error("Mass action failed:", error);
                    toast.dismiss(toastId);
                    toast.error("Some operations failed. Please try again.");
                }
            },
            variant,
            action === 'delete' ? 'Delete All' : 'Confirm'
        );
    };

    // --- 5. Render Helpers (Unchanged) ---
    const formatDate = (timestamp: number) =>
        new Date(timestamp * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    const renderTypeBadge = (type?: string) => {
        if (!type || type === "normal") return null;
        const styles: Record<string, string> = {
            hero: "bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border-purple-200",
            featured: "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-200",
            editors_pick: "bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 border-rose-200",
        };
        const labels: Record<string, string> = {
            hero: "Hero",
            featured: "Featured",
            editors_pick: "Editor's Pick",
        };
        return (
            <Badge variant="outline" className={`ml-2 ${styles[type] || ""}`}>
                {labels[type] || type}
            </Badge>
        );
    };

    const renderBlogList = () => {
        if (paginatedBlogs.length === 0) {
            return (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">No articles found matching your filters</p>
                    </CardContent>
                </Card>
            );
        }

        const allSelected = paginatedBlogs.length > 0 && paginatedBlogs.every(b => selectedIds.has(b._id));

        return (
            <div className="space-y-4">
                {/* Select All Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-4 py-2 bg-secondary/20 rounded-md text-xs sm:text-sm text-muted-foreground gap-2">
                    <div className="flex items-center gap-3">
                        <button onClick={handleSelectAll} className="hover:text-primary transition-colors p-1">
                            {allSelected ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5" />}
                        </button>
                        <span>Select All on this page</span>
                    </div>
                    <div className="pl-9 sm:pl-0">
                        {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedAndFilteredBlogs.length)} of {sortedAndFilteredBlogs.length}
                    </div>
                </div>

                {paginatedBlogs.map((blog) => {
                    const isSelected = selectedIds.has(blog._id);
                    
                    return (
                        <AnimatedContent key={blog._id}>
                            <Card 
                                className={`transition-all duration-200 hover:shadow-md group border-l-4 ${isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent hover:border-l-primary/50'}`}
                            >
                                <CardContent className="p-3 sm:p-6">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        
                                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => handleSelectOne(blog._id)} className="p-1 -ml-1">
                                                {isSelected ? 
                                                    <CheckSquare className="h-5 w-5 sm:h-5 sm:w-5 text-primary" /> : 
                                                    <Square className="h-5 w-5 sm:h-5 sm:w-5 text-muted-foreground hover:text-primary" />
                                                }
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/editor/${blog._id}`)}>
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                                                        <h3 className="text-base sm:text-xl font-semibold truncate max-w-full">
                                                            <BlurText text={blog.title} />
                                                        </h3>
                                                        <div className="flex gap-1 shrink-0 scale-90 sm:scale-100 origin-left">
                                                            <Badge
                                                                variant={blog.state === "published" ? "default" : "secondary"}
                                                            >
                                                                {blog.state}
                                                            </Badge>
                                                            {renderTypeBadge(blog.blogType)}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
                                                        <span className="font-medium text-foreground/80">{blog.author.name}</span>
                                                        <span>•</span>
                                                        <span className="bg-secondary/50 px-1.5 py-0.5 rounded text-secondary-foreground">
                                                            {blog.category?.name ?? "Uncategorized"}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{formatDate(blog.lastUpdated)}</span>
                                                    </div>

                                                    <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                        {blog.excerpt || "No excerpt provided..."}
                                                    </div>
                                                </div>

                                                <div className="flex sm:flex-col gap-1 mt-2 sm:mt-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 sm:px-3 sm:h-8 sm:w-8 sm:p-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/admin/editor/${blog._id}`);
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4 sm:mr-0 mr-1" /> 
                                                        <span className="sm:hidden text-xs">Edit</span>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 sm:px-3 sm:h-8 sm:w-8 sm:p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(blog._id, blog.title);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 sm:mr-0 mr-1" />
                                                        <span className="sm:hidden text-xs">Delete</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </AnimatedContent>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background relative pb-32">
            
            {/* HEADER (Unchanged) */}
            <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-8">
                            <h1 className="text-xl font-bold hidden sm:block">
                                <BlurText text="Article Library" />
                            </h1>
                            <nav className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg overflow-x-auto">
                                <Button variant="secondary" size="sm" className="gap-2 shadow-sm bg-background text-foreground text-xs sm:text-sm px-2 sm:px-4">
                                    <FileText className="h-3 w-3 sm:h-4 sm:w-4" /> Articles
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-4" onClick={() => navigate('/admin/videos')}>
                                    <Film className="h-3 w-3 sm:h-4 sm:w-4" /> Media
                                </Button>
                            </nav>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline-block">
                                {admin?.full_name}
                            </span>
                            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="container mx-auto px-3 sm:px-4 py-6">
                
                {/* Create Button - HIDDEN WHEN SELECTING (Unchanged) */}
                {selectedIds.size === 0 && (
                    <div className="fixed z-50 bottom-6 right-6 animate-in fade-in zoom-in duration-300">
                        <ElectricBorder className="rounded-full">
                            <Button
                                className="flex items-center gap-2 bg-primary text-primary-foreground shadow-lg hover:shadow-xl rounded-full px-4 sm:px-6 h-12 sm:h-14"
                                onClick={() => navigate("/admin/editor/new")}
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span className="font-semibold text-sm sm:text-base">New Article</span>
                            </Button>
                        </ElectricBorder>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <p className="text-muted-foreground">Loading articles...</p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        
                        {/* FILTERS & SORT */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                            {/* Search */}
                            <div className="md:col-span-5 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 w-full"
                                />
                            </div>
                            {/* Filters & Sort */}
                            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                {/* Category Filter */}
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Categories</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {/* Type Filter */}
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Type" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="featured story">Featured</SelectItem>
                                        <SelectItem value="hero section">Hero</SelectItem>
                                        <SelectItem value="editors pick">Editor's Pick</SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* ✅ SORTING SELECT */}
                                <Select value={sortCriteria} onValueChange={(v: any) => setSortCriteria(v)}>
                                    <SelectTrigger className="w-full gap-1">
                                        <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="updated_desc">Last Updated (Newest)</SelectItem>
                                        <SelectItem value="updated_asc">Last Updated (Oldest)</SelectItem>
                                        <SelectItem value="created_desc">Date Created (Newest)</SelectItem>
                                        <SelectItem value="created_asc">Date Created (Oldest)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {/* Items Per Page */}
                                <Select 
                                    value={String(itemsPerPage)} 
                                    onValueChange={(v) => setItemsPerPage(Number(v))}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Rows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 per page</SelectItem>
                                        <SelectItem value="10">10 per page</SelectItem>
                                        <SelectItem value="20">20 per page</SelectItem>
                                        <SelectItem value="50">50 per page</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 max-w-md mb-4 sm:mb-6">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="draft">Drafts</TabsTrigger>
                                <TabsTrigger value="published">Published</TabsTrigger>
                            </TabsList>

                            <TabsContent value="all" className="mt-0">
                                {renderBlogList()}
                            </TabsContent>
                            <TabsContent value="draft" className="mt-0">
                                {renderBlogList()}
                            </TabsContent>
                            <TabsContent value="published" className="mt-0">
                                {renderBlogList()}
                            </TabsContent>
                        </Tabs>

                        {/* PAGINATION CONTROLS */}
                        {sortedAndFilteredBlogs.length > 0 && ( // Use sortedAndFilteredBlogs length for total
                            <div className="flex items-center justify-between border-t pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Previous</span>
                                </Button>
                                <span className="text-xs sm:text-sm text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4 sm:ml-2" />
                                </Button>
                            </div>
                        )}

                    </div>
                )}
            </main>

            {/* MASS ACTIONS FLOATING BAR - RESPONSIVE (Unchanged) */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] sm:w-[90%] max-w-2xl animate-in slide-in-from-bottom-10 fade-in">
                    <ElectricBorder className="rounded-xl bg-card text-card-foreground shadow-2xl">
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-card rounded-xl border">
                            <div className="flex items-center gap-2 sm:gap-4">
                                <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm">
                                    {selectedIds.size} <span className="hidden sm:inline ml-1">Selected</span>
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs h-8 px-2">
                                    Clear
                                </Button>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    onClick={() => performMassAction('delete')}
                                    className="gap-1 px-2 sm:px-4"
                                    title="Delete Selected"
                                >
                                    <Trash2 className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1">Delete</span>
                                </Button>
                                <div className="h-4 w-[1px] bg-border mx-1"></div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => performMassAction('draft')}
                                    className="gap-1 px-2 sm:px-4"
                                    title="Revert to Draft"
                                >
                                    <FileEdit className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1">To Draft</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={() => performMassAction('publish')}
                                    className="gap-1 px-2 sm:px-4"
                                    title="Publish Selected"
                                >
                                    <UploadCloud className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1">Publish</span>
                                </Button>
                            </div>
                        </div>
                    </ElectricBorder>
                </div>
            )}

            {/* SHADCN ALERT DIALOG IMPLEMENTATION (Unchanged) */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {confirmConfig.variant === 'destructive' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                            {confirmConfig.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault();
                                Promise.resolve(confirmConfig.action()).then(() => setConfirmOpen(false));
                            }}
                            className={confirmConfig.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                        >
                            {confirmConfig.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}