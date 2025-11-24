import { useEffect, useState, useMemo } from "react";
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
import { blogApi, fetchCategories } from "@/lib/api"; 
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
    ArrowDownWideNarrow,
} from "lucide-react";
import { toast } from "sonner";

import AnimatedContent from "@/components/AnimatedContent";
import ElectricBorder from "@/components/ElectricBorder";
import BlurText from "@/components/BlurText";
import StadiumSpotlights from "@/components/stadiumSpotlight"; // Import the new background

// --- Types (Unchanged) ---

interface CategoryItem {
    itemIndex: number;
    name: string;
    slug: string;
}

interface CategoryData {
    listOfCategories: CategoryItem[];
    totalItems: number;
}

interface Blog {
    _id: string;
    title: string;
    state: "draft" | "published";
    author: { name: string };
    category: { 
        name: string;
        slug: string;
    }; 
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
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [activeTab, setActiveTab] = useState<"all" | "draft" | "published">("all");
    const [selectedType, setSelectedType] = useState<string>("all");
    
    // Sort State
    const [sortCriteria, setSortCriteria] = useState<'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc'>('updated_desc');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Confirmation Dialog State
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

    // --- 1. Data Loading ---
    useEffect(() => {
        loadBlogs();
    }, []);

     useEffect(() => {
        fetchCategories()
            .then((data) => {
                // @ts-ignore 
                const list = Array.isArray(data) ? data : (data?.listOfCategories || []);
                setCategories(list);
            })
            .catch((err) => console.error("Cat load fail", err));
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
        const filtered = blogs.filter((blog) => {
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch =
                !q ||
                blog.title.toLowerCase().includes(q) ||
                blog._id.toLowerCase().includes(q);

            const matchesCategory =
                selectedCategory === "all" ||
                blog.category?.slug === selectedCategory; 
            
            const matchesType = 
                selectedType === "all" || (blog.blogType || "normal") === selectedType;
            const matchesTab = activeTab === "all" || blog.state === activeTab;
            return matchesSearch && matchesCategory && matchesTab && matchesType;
        });

        return filtered.sort((a, b) => {
            const [field, direction] = sortCriteria.split('_');
            const aValue = field === 'updated' ? a.lastUpdated : a.dateCreated;
            const bValue = field === 'updated' ? b.lastUpdated : b.dateCreated;

            if (aValue === bValue) return 0;

            if (direction === 'asc') {
                return aValue < bValue ? -1 : 1;
            } else { 
                return aValue > bValue ? -1 : 1;
            }
        });
    }, [blogs, searchQuery, selectedCategory, selectedType, activeTab, sortCriteria]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedCategory, selectedType, activeTab, sortCriteria]);

    // --- 3. Pagination Logic ---
    const totalPages = Math.ceil(sortedAndFilteredBlogs.length / itemsPerPage);
    const paginatedBlogs = sortedAndFilteredBlogs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- 4. Action Handlers ---
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

    // --- 5. Render Helpers ---
    const formatDate = (timestamp: number) =>
        new Date(timestamp * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });

    const renderTypeBadge = (type?: string) => {
        if (!type || type === "normal") return null;
        // THEME: More subtle, high-contrast colors for dark mode
        const styles: Record<string, string> = {
            'hero section': "bg-purple-900/40 text-purple-200 border-purple-500/30",
            'featured story': "bg-amber-900/40 text-amber-200 border-amber-500/30",
            'editors pick': "bg-rose-900/40 text-rose-200 border-rose-500/30",
        };
        const labels: Record<string, string> = {
            'hero section': "Hero",
            'featured story': "Featured",
            'editors pick': "Editor's Pick",
        };
        
        return (
            <Badge variant="outline" className={`ml-2 border ${styles[type] || ""}`}>
                {labels[type] || type}
            </Badge>
        );
    };

    const renderBlogList = () => {
        if (paginatedBlogs.length === 0) {
            return (
                <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <p className="text-neutral-500">No articles found matching your filters</p>
                    </CardContent>
                </Card>
            );
        }

        const allSelected = paginatedBlogs.length > 0 && paginatedBlogs.every(b => selectedIds.has(b._id));

        return (
            <div className="space-y-4">
                {/* Select All Header Row - THEME: Glassy */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 sm:px-4 py-2 bg-white/5 border border-white/5 rounded-md text-xs sm:text-sm text-neutral-400 gap-2 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={handleSelectAll} className="hover:text-white transition-colors p-1">
                            {allSelected ? <CheckSquare className="h-5 w-5 text-white" /> : <Square className="h-5 w-5" />}
                        </button>
                        <span className="uppercase tracking-wider font-semibold text-[10px]">Select All</span>
                    </div>
                    <div className="pl-9 sm:pl-0 font-mono">
                        {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, sortedAndFilteredBlogs.length)} of {sortedAndFilteredBlogs.length}
                    </div>
                </div>

                {paginatedBlogs.map((blog) => {
                    const isSelected = selectedIds.has(blog._id);
                    
                    return (
                        <AnimatedContent key={blog._id}>
                            <Card 
                                // THEME: Glassy cards, white border on hover
                                className={`transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 group border-l-4 
                                ${isSelected ? 'border-l-white bg-white/10 border-t-white/10 border-r-white/10 border-b-white/10' : 'bg-black/40 border-l-transparent hover:border-l-white/60 border-white/5 hover:bg-black/60'}
                                backdrop-blur-md`}
                            >
                                <CardContent className="p-3 sm:p-6">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        
                                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => handleSelectOne(blog._id)} className="p-1 -ml-1">
                                                {isSelected ? 
                                                    <CheckSquare className="h-5 w-5 sm:h-5 sm:w-5 text-white" /> : 
                                                    <Square className="h-5 w-5 sm:h-5 sm:w-5 text-neutral-600 hover:text-white transition-colors" />
                                                }
                                            </button>
                                        </div>

                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/editor/${blog._id}`)}>
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                                                        <h3 className="text-base sm:text-xl font-bold tracking-tight text-white truncate max-w-full">
                                                            <BlurText text={blog.title} />
                                                        </h3>
                                                        <div className="flex gap-1 shrink-0 scale-90 sm:scale-100 origin-left">
                                                            <Badge
                                                                // THEME: High contrast badges
                                                                variant="outline"
                                                                className={blog.state === "published" 
                                                                    ? "bg-white text-black border-white font-bold" 
                                                                    : "bg-transparent text-neutral-400 border-neutral-600"}
                                                            >
                                                                {blog.state.toUpperCase()}
                                                            </Badge>
                                                            {renderTypeBadge(blog.blogType)}
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs text-neutral-400 mb-2 uppercase tracking-wide font-medium">
                                                        <span className="text-white/80">{blog.author.name}</span>
                                                        <span>/</span>
                                                        <span className="text-white/60">
                                                            {blog.category?.name ?? "Uncategorized"}
                                                        </span>
                                                        <span>/</span>
                                                        <span>{formatDate(blog.lastUpdated)}</span>
                                                    </div>

                                                    <div className="text-xs text-neutral-500 line-clamp-2 leading-relaxed font-sans">
                                                        {blog.excerpt || "No excerpt provided..."}
                                                    </div>
                                                </div>

                                                <div className="flex sm:flex-col gap-1 mt-2 sm:mt-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 px-2 sm:px-3 sm:h-8 sm:w-8 sm:p-0 text-neutral-400 hover:text-white hover:bg-white/10"
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
                                                        className="h-8 px-2 sm:px-3 sm:h-8 sm:w-8 sm:p-0 text-neutral-600 hover:text-red-500 hover:bg-red-500/10"
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
        // THEME: Main Container - Dark Background + Spotlights
        <div className="min-h-screen bg-neutral-950 relative pb-32 overflow-hidden selection:bg-white selection:text-black">
            
            <StadiumSpotlights />
            {/* Vignette */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_100%)] pointer-events-none" />

            {/* HEADER - THEME: Glassmorphic + White borders */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4 sm:gap-8">
                            <h1 className="text-xl font-bold hidden sm:block tracking-tighter text-white">
                                <BlurText text="ARTICLE LIBRARY" />
                            </h1>
                            <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-lg overflow-x-auto border border-white/5">
                                <Button variant="ghost" size="sm" className="gap-2 bg-white text-black  text-xs sm:text-sm px-2 sm:px-4 font-bold">
                                    <FileText className="h-3 w-3 sm:h-4 sm:w-4" /> ARTICLES
                                </Button>
                                <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 hover:text-white hover:bg-white/5 text-xs sm:text-sm px-2 sm:px-4 font-bold" onClick={() => navigate('/admin/videos')}>
                                    <Film className="h-3 w-3 sm:h-4 sm:w-4" /> MEDIA
                                </Button>
                            </nav>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="hidden sm:flex mr-2 border-white/20 text-neutral-400">
                                {blogs.length} Items
                            </Badge>
                            <Button variant="ghost" size="icon" onClick={logout} title="Logout" className="text-neutral-400 hover:text-white hover:bg-white/10">
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>
            
            <main className="container relative z-10 mx-auto px-3 sm:px-4 py-6">
                
                {/* Create Button - THEME: White Electric Border */}
                {selectedIds.size === 0 && (
                    <div className="fixed z-50 bottom-6 right-6 animate-in fade-in zoom-in duration-300">
                        <ElectricBorder className="rounded-full" color="#ffffff">
                            <Button
                                className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 shadow-2xl shadow-white/10 rounded-full px-4 sm:px-6 h-12 sm:h-14 font-bold tracking-wide"
                                onClick={() => navigate("/admin/editor/new")}
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span className="text-sm sm:text-base uppercase">New Article</span>
                            </Button>
                        </ElectricBorder>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        <p className="text-neutral-500 uppercase tracking-widest text-xs">Loading Archives...</p>
                    </div>
                ) : (
                    <div className="space-y-4 sm:space-y-6">
                        
                        {/* FILTERS & SORT */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
                            {/* Search */}
                            <div className="md:col-span-5 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                                <Input
                                    placeholder="SEARCH DATABASE..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    // THEME: Dark Input styling
                                    className="pl-9 w-full bg-white/5 border-white/10 text-white placeholder:text-neutral-600 focus-visible:ring-white/20 focus-visible:border-white/30 h-10 transition-all uppercase text-xs tracking-wide"
                                />
                            </div>
                            {/* Filters & Sort */}
                            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                {/* Category Filter */}
                                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-10 text-xs uppercase tracking-wide">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                                </SelectContent>
                                </Select>

                                {/* Type Filter */}
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-10 text-xs uppercase tracking-wide">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="featured story">Featured</SelectItem>
                                        <SelectItem value="hero section">Hero</SelectItem>
                                        <SelectItem value="editors pick">Editor's Pick</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Sorting */}
                                <Select value={sortCriteria} onValueChange={(v: any) => setSortCriteria(v)}>
                                    <SelectTrigger className="w-full gap-1 bg-white/5 border-white/10 text-white h-10 text-xs uppercase tracking-wide">
                                        <ArrowDownWideNarrow className="h-4 w-4 text-neutral-400" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="updated_desc">Newest Update</SelectItem>
                                        <SelectItem value="updated_asc">Oldest Update</SelectItem>
                                        <SelectItem value="created_desc">Newest Created</SelectItem>
                                        <SelectItem value="created_asc">Oldest Created</SelectItem>
                                    </SelectContent>
                                </Select>

                                {/* Items Per Page */}
                                <Select 
                                    value={String(itemsPerPage)} 
                                    onValueChange={(v) => setItemsPerPage(Number(v))}
                                >
                                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white h-10 text-xs uppercase tracking-wide">
                                        <SelectValue placeholder="Rows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5 Rows</SelectItem>
                                        <SelectItem value="10">10 Rows</SelectItem>
                                        <SelectItem value="20">20 Rows</SelectItem>
                                        <SelectItem value="50">50 Rows</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Tabs - THEME: Dark mode tabs */}
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 max-w-md mb-4 sm:mb-6 bg-white/5 p-1">
                                <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:text-black text-neutral-400 uppercase text-xs font-bold">All</TabsTrigger>
                                <TabsTrigger value="draft" className="data-[state=active]:bg-white data-[state=active]:text-black text-neutral-400 uppercase text-xs font-bold">Drafts</TabsTrigger>
                                <TabsTrigger value="published" className="data-[state=active]:bg-white data-[state=active]:text-black text-neutral-400 uppercase text-xs font-bold">Published</TabsTrigger>
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
                        {sortedAndFilteredBlogs.length > 0 && (
                            <div className="flex items-center justify-between border-t border-white/10 pt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
                                >
                                    <ChevronLeft className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Previous</span>
                                </Button>
                                <span className="text-xs sm:text-sm text-neutral-500 font-mono">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white"
                                >
                                    <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4 sm:ml-2" />
                                </Button>
                            </div>
                        )}

                    </div>
                )}
            </main>

            {/* MASS ACTIONS FLOATING BAR */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] sm:w-[90%] max-w-2xl animate-in slide-in-from-bottom-10 fade-in">
                    <ElectricBorder className="rounded-xl bg-neutral-900 text-white shadow-2xl shadow-black border border-white/10" color="#ffffff">
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-neutral-900/90 backdrop-blur-md rounded-xl">
                            <div className="flex items-center gap-2 sm:gap-4">
                                <Badge variant="secondary" className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-white text-black font-bold">
                                    {selectedIds.size} <span className="hidden sm:inline ml-1">SELECTED</span>
                                </Badge>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs h-8 px-2 text-neutral-400 hover:text-white">
                                    Clear
                                </Button>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <Button 
                                    size="sm" 
                                    variant="destructive" 
                                    onClick={() => performMassAction('delete')}
                                    className="gap-1 px-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white"
                                    title="Delete Selected"
                                >
                                    <Trash2 className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1 uppercase font-bold text-xs">Delete</span>
                                </Button>
                                <div className="h-4 w-[1px] bg-white/20 mx-1"></div>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => performMassAction('draft')}
                                    className="gap-1 px-2 sm:px-4 bg-transparent border-white/20 text-white hover:bg-white/10"
                                    title="Revert to Draft"
                                >
                                    <FileEdit className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1 uppercase font-bold text-xs">To Draft</span>
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={() => performMassAction('publish')}
                                    className="gap-1 px-2 sm:px-4 bg-white text-black hover:bg-neutral-200"
                                    title="Publish Selected"
                                >
                                    <UploadCloud className="h-4 w-4" /> 
                                    <span className="hidden sm:inline ml-1 uppercase font-bold text-xs">Publish</span>
                                </Button>
                            </div>
                        </div>
                    </ElectricBorder>
                </div>
            )}

            {/* SHADCN ALERT DIALOG */}
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="bg-neutral-900 border-white/10 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {confirmConfig.variant === 'destructive' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                            {confirmConfig.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            {confirmConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={(e) => {
                                e.preventDefault();
                                Promise.resolve(confirmConfig.action()).then(() => setConfirmOpen(false));
                            }}
                            className={confirmConfig.variant === "destructive" ? "bg-red-600 text-white hover:bg-red-700" : "bg-white text-black hover:bg-neutral-200"}
                        >
                            {confirmConfig.confirmText}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}