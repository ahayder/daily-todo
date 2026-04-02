export const MAX_IMAGE_DIMENSION = 1200;
export const JPEG_QUALITY = 0.8;

/**
 * Reads a File object and compresses it as a JPEG data URI.
 * If the image is smaller than MAX_IMAGE_DIMENSION, it preserves the original resolution.
 */
export async function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;

      // If it's already a very small image (e.g. < 50kb), we can optionally just return it.
      // But re-encoding through Canvas ensures it's always standard JPEG without extreme exif data or bloat.
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = "#ffffff"; // Just in case of transparent pngs becoming jpeg
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert back to base64
        const compressedBase64 = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve(compressedBase64);
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
}
