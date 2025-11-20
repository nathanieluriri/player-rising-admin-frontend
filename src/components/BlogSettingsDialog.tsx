// BlogSettingsDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

import useCategories from "@/hooks/useCategories";
import { Category } from "@/lib/api";

// Define the valid blog types
export type BlogType = "normal" | "editors pick" | "hero section" | "featured story";

interface BlogSettingsDialogProps {
  authorName: string;
  setAuthorName: (value: string) => void;
  authorAvatar: string;
  setAuthorAvatar: (value: string) => void;
  authorAffiliation: string;
  setAuthorAffiliation: (value: string) => void;
  category: Category | null;
  setCategory: (value: Category | null) => void;
  featureImageUrl: string;
  setFeatureImageUrl: (value: string) => void;
  // ADDED: Props for Blog Type
  blogType: BlogType;
  setBlogType: (value: BlogType) => void;
}

export function BlogSettingsDialog({
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
  // ADDED: Destructure new props
  blogType,
  setBlogType,
}: BlogSettingsDialogProps) {
  const { categories, isLoading } = useCategories();

  React.useEffect(() => {
    if (!category && !isLoading && categories.length > 0) {
      // optional auto-select logic
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, isLoading]);

  return (
    <Dialog>
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
                value={category?.slug ?? ""}
                onValueChange={(slug) => {
                  const found = categories.find((c) => c.slug === slug) ?? null;
                  setCategory(found);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoading ? "Loading categories..." : "Select category"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading...
                    </SelectItem>
                  ) : (
                    <>
                      {categories.map((cat) => (
                        <SelectItem key={cat.slug} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ADDED: Blog Type Selector */}
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