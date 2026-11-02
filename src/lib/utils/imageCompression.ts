/**
 * Client-Side Image Compression Utility
 * Compresses images in-browser via Canvas API before uploading to cloud storage.
 * Drastically cuts upload bandwidth, accelerates mobile uploads, and prevents storage bloat.
 */

export interface CompressionResult {
  file: File;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  ratioPercent: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/webp" | "image/jpeg";
}

export async function compressImageClientSide(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    mimeType = "image/webp",
  } = options;

  const originalSizeBytes = file.size;

  // If not an image or SVG/GIF, return as is
  if (!file.type.startsWith("image/") || file.type.includes("svg") || file.type.includes("gif")) {
    return {
      file,
      originalSizeBytes,
      compressedSizeBytes: originalSizeBytes,
      ratioPercent: 0,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Proportional resize
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback to original file if context not available
          return resolve({
            file,
            originalSizeBytes,
            compressedSizeBytes: originalSizeBytes,
            ratioPercent: 0,
          });
        }

        // Draw image smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve({
                file,
                originalSizeBytes,
                compressedSizeBytes: originalSizeBytes,
                ratioPercent: 0,
              });
            }

            // Only use compressed if it actually saved space, or if format was converted to WebP
            if (blob.size < originalSizeBytes || mimeType === "image/webp") {
              const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
              const ext = mimeType === "image/webp" ? ".webp" : ".jpg";
              const newFileName = `${baseName}${ext}`;

              const compressedFile = new File([blob], newFileName, {
                type: blob.type || mimeType,
                lastModified: Date.now(),
              });

              const ratio = Math.round((1 - compressedFile.size / originalSizeBytes) * 100);

              resolve({
                file: compressedFile,
                originalSizeBytes,
                compressedSizeBytes: compressedFile.size,
                ratioPercent: Math.max(0, ratio),
              });
            } else {
              // Original was already smaller
              resolve({
                file,
                originalSizeBytes,
                compressedSizeBytes: originalSizeBytes,
                ratioPercent: 0,
              });
            }
          },
          mimeType,
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          originalSizeBytes,
          compressedSizeBytes: originalSizeBytes,
          ratioPercent: 0,
        });
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        file,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
        ratioPercent: 0,
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to readable Arabic string (كيلوبايت / ميجابايت)
 */
export function formatBytesArabic(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  const k = 1024;
  const sizes = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
