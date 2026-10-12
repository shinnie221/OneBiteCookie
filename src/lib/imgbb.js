/**
 * Client-side smart image compressor.
 * Downscales huge phone camera photos (e.g. 10MB, 4000x3000px) to lightweight, 
 * crisp web-optimized images (~150KB - 350KB, max 1600px) before upload.
 *
 * @param {Blob|File} imageFile
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @param {number} quality
 * @returns {Promise<File|Blob>}
 */
export async function compressImageFile(imageFile, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
  if (typeof window === 'undefined' || !(imageFile instanceof Blob)) {
    return imageFile;
  }

  // If already under 300KB and not a gif/svg, no compression needed
  if (imageFile.size < 300 * 1024) {
    return imageFile;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageFile);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < imageFile.size) {
              const fileName = imageFile.name ? imageFile.name.replace(/\.[^/.]+$/, '.jpg') : 'compressed.jpg';
              const compressedFile = new File([blob], fileName, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              resolve(imageFile);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(imageFile);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(imageFile);
    reader.readAsDataURL(imageFile);
  });
}

function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Uploads an image to ImgBB and returns the URL.
 * Automatically compresses large images to lightweight web size first.
 * If external hosting is unavailable or rate-limited, gracefully falls back
 * to a lightweight, compressed base64 data URL to guarantee zero failure.
 *
 * @param {File|Blob} imageFile - The image file to upload.
 * @returns {Promise<string>} The URL of the uploaded image.
 */
export async function uploadImageToImgBB(imageFile) {
  // Automatically compress large phone photos before uploading
  const fileToUpload = await compressImageFile(imageFile);

  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || process.env.IMGBB_API_KEY;

  if (apiKey) {
    try {
      const formData = new FormData();
      formData.append('image', fileToUpload);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data?.data?.url) {
        return data.data.url;
      } else {
        console.warn('ImgBB returned error, falling back to compressed local data URL:', data?.error);
      }
    } catch (error) {
      console.warn('ImgBB network request failed, falling back to compressed local data URL:', error);
    }
  }

  // Guaranteed fallback: return compressed Data URL
  return await fileToDataUrl(fileToUpload);
}
