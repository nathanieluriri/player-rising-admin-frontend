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

import useCategories from "@/hooks/useCategories"; // hook from above
import { Category } from "@/lib/api";

interface BlogSettingsDialogProps {
  authorName: string;
  setAuthorName: (value: string) => void;
  authorAvatar: string;
  setAuthorAvatar: (value: string) => void;
  authorAffiliation: string;
  setAuthorAffiliation: (value: string) => void;
  category: Category | null; // allow null initially
  setCategory: (value: Category | null) => void;
  featureImageUrl: string;
  setFeatureImageUrl: (value: string) => void;
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
}: BlogSettingsDialogProps) {
  const { categories, isLoading } = useCategories();

  // If you want to auto-select the current category when categories load:
  React.useEffect(() => {
    if (!category && !isLoading && categories.length > 0) {
      // optional: set first category as default (or don't auto-set)
      // setCategory(categories[0]);
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

              {/* Disable select while categories loading */}
              <Select
                value={category?.slug ?? ""}
                onValueChange={(slug) => {
                  const found = categories.find((c) => c.slug === slug) ?? null;
                  setCategory(found);
                }}
              >
                <SelectTrigger>
                  {/* Show placeholder when no category is selected */}
                  <SelectValue placeholder={isLoading ? "Loading categories..." : "Select category"} />
                </SelectTrigger>

                <SelectContent>
                  {/* optional loading item */}
                  {isLoading ? (
                    <SelectItem value="">
                      Loading...
                    </SelectItem>
                  ) : (
                    <>
                      <SelectItem value="all">All Categories</SelectItem>
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
      </DialogContent>
    </Dialog>
  );
}
