/**
 * Compresses an image file or Data URL using HTML5 Canvas
 * Maintains aspect ratio, prevents upscaling, and supports adaptive quality control.
 *
 * @param {File|Blob|string} target - Image File/Blob or Data URL
 * @param {Object} options - Compression parameters
 * @param {number} options.maxWidth - Maximum width (default 1920)
 * @param {number} options.maxHeight - Maximum height (default 1920)
 * @param {number} options.quality - Initial JPEG quality (default 0.88)
 * @param {number} options.maxSizeBytes - Maximum safe Base64 size in bytes (default 1.5MB)
 * @returns {Promise<string>} Compressed Data URL
 */
export const compressImage = (target, {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.88,
    maxSizeBytes = 1.5 * 1024 * 1024
} = {}) => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            let origWidth = img.width;
            let origHeight = img.height;
            let width = origWidth;
            let height = origHeight;

            // NO UPSCALING RULE:
            // Only scale down if image exceeds maxWidth or maxHeight.
            // If original image is smaller than max bounds, preserve original dimensions.
            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Adaptive compression steps if payload size exceeds maxSizeBytes
            const compressionPasses = [
                { width, height, q: quality },
                { width, height, q: Math.min(quality, 0.82) },
                { width: Math.min(width, 1600), height: Math.min(height, 1600), q: 0.85 },
                { width: Math.min(width, 1400), height: Math.min(height, 1400), q: 0.80 }
            ];

            let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

            for (const pass of compressionPasses) {
                // Estimate Base64 byte length
                const approxBytes = Math.round((compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1)) * 0.75);
                if (approxBytes <= maxSizeBytes) {
                    break;
                }

                // Apply next adaptive step
                canvas.width = pass.width;
                canvas.height = pass.height;
                ctx.drawImage(img, 0, 0, pass.width, pass.height);
                compressedDataUrl = canvas.toDataURL('image/jpeg', pass.q);
            }

            resolve(compressedDataUrl);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for compression'));
        };

        if (target instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(target);
        } else if (typeof target === 'string') {
            img.src = target;
        } else {
            reject(new Error('Invalid compression target: must be File, Blob, or Data URL'));
        }
    });
};

