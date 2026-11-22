import { getPlugin, isCapacitorNative } from './utils.js';

const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

export async function pickBillFromGallery(fileInputEl = null) {
  if (isCapacitorNative()) {
    const cam = getPlugin('NativeCamera');
    if (cam?.pickImage) {
      try {
        const res = await cam.pickImage();
        if (res?.cancelled) return { ok: false, cancelled: true };
        if (res?.imageUri || res?.dataUrl) {
          return {
            ok: true,
            imageUri: res.imageUri || res.dataUrl,
            autoCorrected: Boolean(res.autoCorrected)
          };
        }
      } catch {
        return {
          ok: false,
          errorType: 'gallery_unavailable',
          message: 'Unable to open photo picker. Please try again.'
        };
      }
    }
  }

  // Web / fallback file picker
  return new Promise((resolve) => {
    const input = fileInputEl || document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ ok: false, cancelled: true });
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        resolve({
          ok: false,
          errorType: 'image_too_large',
          message: 'This image is larger than 18 MB. Please choose a smaller photo.'
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ ok: true, imageUri: reader.result });
      reader.onerror = () => resolve({ ok: false, errorType: 'gallery_unavailable', message: 'Could not read the selected image.' });
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
