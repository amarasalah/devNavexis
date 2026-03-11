/**
 * CLOUDINARY WEB HELPER
 * Handles image upload from web admin panel (signed upload with API key)
 * Used for driver/truck profile photos
 */

const CLOUD_NAME = 'dr1ud7cb3';
const API_KEY = '228221642645181';
const UPLOAD_PRESET = 'fleettrack_unsigned'; // unsigned preset for simplicity

/**
 * Upload an image file to Cloudinary from the web
 * @param {File} file - The file to upload
 * @param {string} folder - Target folder (e.g. 'profiles/drivers')
 * @returns {Promise<{url: string, publicId: string}>}
 */
export async function uploadToCloudinary(file, folder = 'profiles') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cloudinary upload failed: ${err}`);
    }

    const data = await response.json();
    console.log('[Cloudinary Web] ✅ Uploaded:', data.secure_url);

    return {
        url: data.secure_url,
        publicId: data.public_id,
    };
}

/**
 * Get a Cloudinary thumbnail URL (optimized for cards)
 * @param {string} url - Original Cloudinary URL
 * @param {number} width - Target width
 * @param {number} height - Target height
 */
export function getThumbnail(url, width = 200, height = 200) {
    if (!url || !url.includes('cloudinary')) return url;
    return url.replace('/upload/', `/upload/c_fill,w_${width},h_${height},q_auto,f_auto/`);
}

window.CloudinaryHelper = { uploadToCloudinary, getThumbnail };
