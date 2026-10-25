import { supabase, isSupabaseConfigured } from './supabaseClient';
import { dataUrlToBlob } from '../utils/imageCompression';

export const PRODUCE_BUCKET = 'produce-images';

export interface StorageUploadResult {
  path: string;
  publicUrl: string;
}

class StorageService {
  /**
   * Checks whether a given string is a remote web/storage URL rather than an inline Base64 data URI.
   */
  public isStorageUrl(url?: string | null): boolean {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Checks whether a string is an inline Base64 data URI.
   */
  public isDataUrl(url?: string | null): boolean {
    if (!url) return false;
    return url.startsWith('data:image/');
  }

  /**
   * Uploads a produce image (File, Blob, or Data URL) to Supabase Storage.
   * Scoped to path: {farmerId}/{listingId}/{timestamp}-{index}.{ext}
   * Returns the permanent public URL.
   */
  public async uploadProduceImage(
    source: File | Blob | string,
    farmerId: string,
    listingId: string,
    index: number = 0
  ): Promise<StorageUploadResult> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    if (!farmerId || !farmerId.trim()) {
      throw new Error('Upload failed: Authenticated farmer ID is required.');
    }

    if (!listingId || !listingId.trim()) {
      throw new Error('Upload failed: Listing ID is required.');
    }

    let blob: Blob;
    let contentType = 'image/jpeg';

    if (typeof source === 'string') {
      if (this.isStorageUrl(source)) {
        // Already a remote URL; return as is
        return { path: source, publicUrl: source };
      }
      blob = dataUrlToBlob(source);
      contentType = blob.type || 'image/jpeg';
    } else {
      blob = source;
      contentType = source.type || 'image/jpeg';
    }

    // Determine extension from content-type
    let extension = 'jpg';
    if (contentType === 'image/png') extension = 'png';
    else if (contentType === 'image/webp') extension = 'webp';

    const cleanFarmerId = farmerId.trim();
    const cleanListingId = listingId.trim();
    const fileName = `${Date.now()}-${index}.${extension}`;
    const filePath = `${cleanFarmerId}/${cleanListingId}/${fileName}`;

    console.log(`[StorageService] Uploading image (${Math.round(blob.size / 1024)}KB) to path: ${filePath}`);
    const t0 = performance.now();

    // 15-second safety timeout on storage upload
    const uploadPromise = supabase.storage
      .from(PRODUCE_BUCKET)
      .upload(filePath, blob, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(
        () => reject(new Error('Produce image upload timed out after 15 seconds. Please check your network connection.')),
        15000
      )
    );

    let data: any;
    let error: any;

    try {
      const res = await Promise.race([uploadPromise, timeoutPromise]);
      data = res.data;
      error = res.error;
    } catch (err: any) {
      console.error('[StorageService] Upload exception:', err);
      throw err;
    }

    if (error) {
      console.error('[StorageService] Upload error from Supabase:', error);
      const errMsg = (error.message || '').toLowerCase();
      if (
        error.statusCode === '404' ||
        errMsg.includes('bucket not found') ||
        error.code === 'NoSuchBucket'
      ) {
        throw new Error(
          "Supabase Storage bucket 'produce-images' does not exist yet. Please run the SQL migration in Supabase SQL Editor to create it."
        );
      }
      if (
        error.statusCode === '403' ||
        errMsg.includes('row-level security') ||
        error.error === 'Unauthorized'
      ) {
        throw new Error(
          'Storage permission denied: Only authenticated active farmers can upload produce images to their designated folder.'
        );
      }
      throw new Error(`Failed to upload produce image: ${error.message || 'Unknown storage error'}`);
    }

    const { data: publicData } = supabase.storage
      .from(PRODUCE_BUCKET)
      .getPublicUrl(filePath);

    const publicUrl = publicData?.publicUrl || '';
    const duration = performance.now() - t0;
    console.log(`[StorageService] Upload successful in ${duration.toFixed(1)}ms. Public URL: ${publicUrl}`);

    return {
      path: data?.path || filePath,
      publicUrl,
    };
  }

  /**
   * Helper to delete an image from the produce-images bucket if needed.
   */
  public async deleteProduceImage(pathOrUrl: string): Promise<void> {
    if (!isSupabaseConfigured || !pathOrUrl) return;

    try {
      let path = pathOrUrl;
      const marker = `/${PRODUCE_BUCKET}/`;
      if (pathOrUrl.includes(marker)) {
        path = pathOrUrl.substring(pathOrUrl.indexOf(marker) + marker.length);
      }

      await supabase.storage.from(PRODUCE_BUCKET).remove([path]);
    } catch (err) {
      console.warn('[StorageService] deleteProduceImage error (ignored):', err);
    }
  }
}

export const storageService = new StorageService();
