import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEffect, useState} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/ImageUploader";
import { Settings } from "lucide-react";
import React from "react";

// ✅ FIX 1: Import CategoryItem from the hook
import useCategories, { CategoryItem } from "@/hooks/useCategories";
import { fetchCategories } from "@/lib/api";

// Define the valid blog types
export type BlogType = "normal" | "editors pick" | "hero section" | "featured story";

interface BlogSettingsDialogProps {
  // ✅ NEW: Add control props to allow parent to open/close this dialog programmatically
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  authorName: string;
  setAuthorName: (value: string) => void;
  authorAvatar: string;
  setAuthorAvatar: (value: string) => void;
  authorAffiliation: string;
  setAuthorAffiliation: (value: string) => void;
  
  // ✅ FIX 2: Update these types to CategoryItem
  category: CategoryItem | null;
  setCategory: (value: CategoryItem | null) => void;
  
  featureImageUrl: string;
  setFeatureImageUrl: (value: string) => void;
  blogType: BlogType;
  setBlogType: (value: BlogType) => void;
}

export function BlogSettingsDialog({
  open,           // ✅ Destructure new prop
  onOpenChange,   // ✅ Destructure new prop
  authorName,
  setAuthorName,
  authorAvatar,
  setAuthorAvatar,
  authorAffiliation,
  setAuthorAffiliation,
  category,
  setCategory,
  featureImageUrl,
  setFeatureImageUrl,
  blogType,
  setBlogType,
}: BlogSettingsDialogProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

 useEffect(() => {
        fetchCategories()
            .then((data) => {
                // @ts-ignore 
                const list = Array.isArray(data) ? data : (data?.listOfCategories || []);
                setCategories(list);
            })
            .catch((err) => console.error("Cat load fail", err));
    }, []);

  return (
    // ✅ Pass the control props to the Root Dialog component
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Blog Settings</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left Column: Text Fields & Selects */}
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
                // ✅ FIX 3: Safe access to slug
                value={category?.slug ?? ""}
                onValueChange={(slug) => {
                  // ✅ FIX 4: Find the correct CategoryItem object
                  const found = categories.find((c) => c.slug === slug) ?? null;
                  setCategory(found);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                       "Select category"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                                    
                                    {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}
                                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Article Type & Visibility</Label>
              <Select
                value={blogType}
                onValueChange={(val) => setBlogType(val as BlogType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Standard Article</SelectItem>
                  <SelectItem value="featured story">Featured (Highlight)</SelectItem>
                  <SelectItem value="editors pick">Editor's Pick</SelectItem>
                  <SelectItem value="hero section">Hero (Homepage Top)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.8rem] text-muted-foreground">
                Determines where this article is displayed on the home page.
              </p>
            </div>
          </div>

          {/* Right Column: Image Uploaders */}
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
      </DialogContent>
    </Dialog>
  );
}