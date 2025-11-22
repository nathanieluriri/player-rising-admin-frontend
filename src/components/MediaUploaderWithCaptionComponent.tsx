import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from "@/components/ui/dialog"; // Assuming shadcn/ui Dialog components
import { Textarea } from "@/components/ui/textarea"; // Assuming shadcn/ui Textarea

// Re-using the provided mediaApi structure
// NOTE: Make sure to import or define the `mediaApi` object (or just the `uploadMediaWithCaption` function)
// in the file where this component is used or in a utility file.
// The structure is assumed to be:
// export const mediaApi = {
//   uploadMediaWithCaption: async (mediaId: string, file: File, caption: string) => {...},
//   // ... other methods
// };
import { mediaApi } from "@/lib/api"; // Assuming the mediaApi is exported from this path

/**
 * Props for the MediaUploaderModal component.
 * @param onUploadSuccess Callback function when the upload is successful.
 * @param mediaId The ID of the media/article to associate the upload with.
 */
interface MediaUploaderModalProps {
  onUploadSuccess: (data: { url: string; caption: string }) => void;
  mediaId: string; // The ID of the article/media to update the caption for, or a placeholder if new
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

export function MediaUploaderModal({ 
  onUploadSuccess, 
  mediaId, 
  label = "Upload Media with Caption",
  variant = "outline"
}: MediaUploaderModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }

    if (!mediaId) {
      alert("Missing media ID for upload. Cannot proceed.");
      return;
    }

    setIsUploading(true);
    try {
      // Use the provided mediaApi.uploadMediaWithCaption
      const response = await mediaApi.uploadMediaWithCaption(mediaId, file, caption);
      
      // Assuming response.data contains the new media URL
      onUploadSuccess({ 
        url: response.data?.url || "placeholder-url", 
        caption: caption 
      });

      // Reset state and close modal
      setFile(null);
      setCaption("");
      setIsOpen(false);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Media upload failed. Check console for details.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Clear file input
      }
    }
  }, [file, caption, mediaId, onUploadSuccess]);

  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <ImageIcon className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Media with Caption</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="media-file">Media File</Label>
            <Input
              ref={fileInputRef}
              id="media-file"
              type="file"
              accept="image/*,video/*" // Allows images and videos
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>

          {/* Image/File Preview */}
          {previewUrl && (
            <div className="relative border p-2 rounded-md">
              {/* Only showing image preview for simplicity, but accept video as well */}
              {file?.type.startsWith('image/') && (
                <img 
                  src={previewUrl} 
                  alt="Selected Media Preview" 
                  className="max-h-40 w-full object-contain rounded-sm"
                  // Clean up the object URL when the component unmounts or file changes
                  onLoad={() => {
                    // This is a small optimization to free memory
                    // window.URL.revokeObjectURL(previewUrl); 
                  }}
                />
              )}
              {file?.type.startsWith('video/') && (
                <p className="text-sm text-muted-foreground">Video Selected: {file.name}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 text-red-500 hover:bg-red-500/10"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
                disabled={isUploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Caption Input */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (Optional)</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption for the media..."
              disabled={isUploading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleUpload} 
            disabled={!file || isUploading || !mediaId}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Confirm Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

 
