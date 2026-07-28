/**
 * Uploads an image to ImgBB and returns the URL.
 * @param {File} imageFile - The image file to upload.
 * @returns {Promise<string>} The URL of the uploaded image.
 */
export async function uploadImageToImgBB(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY || process.env.IMGBB_API_KEY; // Using env variable

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      return data.data.url;
    } else {
      console.error('ImgBB Upload Error:', data.error);
      throw new Error(data.error.message || 'Failed to upload image to ImgBB');
    }
  } catch (error) {
    console.error('Error uploading to ImgBB:', error);
    throw error;
  }
}
