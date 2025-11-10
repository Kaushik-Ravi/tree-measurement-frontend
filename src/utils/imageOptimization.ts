/**
 * Supabase Storage Image Optimization Helper
 * 
 * CRITICAL: Reduces bandwidth usage by 98% using Supabase's built-in transformations
 * Prevents exceeding free tier cached egress quota (5 GB/month)
 * 
 * Before: Loading 1.5 MB full images for every thumbnail
 * After: Loading 10-100 KB optimized images based on display size
 * 
 * Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
 */

export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

/**
 * Optimized image sizes for different use cases
 * - thumbnail: 48×48px displays (results table, small icons)
 * - small: 150-200px displays (map popups, cards)
 * - medium: 400-600px displays (detail views, modals)
 * - large: 800-1200px displays (full screen viewing)
 * - original: No transformation (downloads only)
 */
const IMAGE_SIZES: Record<ImageSize, { width: number; quality: number }> = {
  thumbnail: { width: 100, quality: 70 },   // ~10 KB per image
  small: { width: 200, quality: 75 },       // ~20 KB per image
  medium: { width: 600, quality: 80 },      // ~80 KB per image
  large: { width: 1200, quality: 85 },      // ~200 KB per image
  original: { width: 0, quality: 100 },     // Original size (1-2 MB)
};

/**
 * Get optimized image URL from Supabase Storage
 * 
 * @param imageUrl - Original Supabase Storage URL
 * @param size - Desired image size (default: 'small')
 * @returns Optimized URL with transformation parameters
 * 
 * @example
 * // Map popup thumbnail (150px)
 * getOptimizedImageUrl(tree.image_url, 'small')
 * 
 * // Results table thumbnail (48px)
 * getOptimizedImageUrl(result.image_url, 'thumbnail')
 * 
 * // Full screen view (600px)
 * getOptimizedImageUrl(tree.image_url, 'medium')
 */
export function getOptimizedImageUrl(
  imageUrl: string | undefined | null,
  size: ImageSize = 'small'
): string {
  if (!imageUrl) return '';
  
  // Skip optimization for original size (downloads only)
  if (size === 'original') return imageUrl;
  
  const { width, quality } = IMAGE_SIZES[size];
  
  // Supabase Storage transformation syntax
  // This happens server-side and is cached by Supabase CDN
  return `${imageUrl}?width=${width}&quality=${quality}`;
}

/**
 * Get srcset for responsive images (advanced usage)
 * Allows browser to choose best size based on screen density
 * 
 * @param imageUrl - Original Supabase Storage URL
 * @returns srcset string for responsive loading
 * 
 * @example
 * <img 
 *   src={getOptimizedImageUrl(tree.image_url, 'small')}
 *   srcSet={getImageSrcSet(tree.image_url)}
 *   sizes="(max-width: 640px) 200px, (max-width: 1024px) 400px, 600px"
 * />
 */
export function getImageSrcSet(imageUrl: string | undefined | null): string {
  if (!imageUrl) return '';
  
  return `
    ${getOptimizedImageUrl(imageUrl, 'small')} 200w,
    ${getOptimizedImageUrl(imageUrl, 'medium')} 600w,
    ${getOptimizedImageUrl(imageUrl, 'large')} 1200w
  `.trim();
}

/**
 * Bandwidth savings calculator (for monitoring)
 * 
 * @example
 * // Before: 1.5 MB × 100 loads = 150 MB
 * // After:  0.02 MB × 100 loads = 2 MB
 * // Savings: 148 MB (98.7% reduction)
 */
export function estimateBandwidthSavings(
  numberOfImages: number,
  viewsPerImage: number,
  averageImageSizeMB: number = 1.5
): {
  beforeMB: number;
  afterMB: number;
  savingsMB: number;
  savingsPercent: number;
} {
  const beforeMB = numberOfImages * viewsPerImage * averageImageSizeMB;
  const afterMB = numberOfImages * viewsPerImage * 0.02; // 20 KB average thumbnail
  const savingsMB = beforeMB - afterMB;
  const savingsPercent = (savingsMB / beforeMB) * 100;
  
  return {
    beforeMB: Math.round(beforeMB),
    afterMB: Math.round(afterMB * 10) / 10,
    savingsMB: Math.round(savingsMB),
    savingsPercent: Math.round(savingsPercent * 10) / 10
  };
}
