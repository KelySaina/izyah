import { ref } from 'vue';
import { pickPhoto } from '@/services/cameraService';
import { compressImage } from '@/services/imageService';
import { api, ApiError } from '@/services/api';
import { useUiStore } from '@/stores/ui';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB source cap (spec)

/**
 * Shared "pick (or shoot) → validate size → compress → upload to MinIO" flow.
 * Returns the stored public URL, or null if the user cancelled / it failed.
 */
export function useImageUpload(kind: 'cover' | 'avatar') {
  const ui = useUiStore();
  const uploading = ref(false);

  async function pickAndUpload(camera = false): Promise<string | null> {
    const file = await pickPhoto({ camera, accept: 'image/*' });
    if (!file) return null;
    if (file.size > MAX_BYTES) {
      ui.toast('Image must be under 5 MB', 'error');
      return null;
    }
    uploading.value = true;
    try {
      const compressed = await compressImage(file, kind === 'avatar' ? { maxDim: 512 } : { maxDim: 1600 });
      const { url } = await api.uploads.image(kind, compressed);
      return url;
    } catch (err) {
      ui.toast(err instanceof ApiError ? err.message : 'Upload failed', 'error');
      return null;
    } finally {
      uploading.value = false;
    }
  }

  return { uploading, pickAndUpload };
}
