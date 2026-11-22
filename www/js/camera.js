import { getPlugin, isCapacitorNative, toWebSrc } from './utils.js';
import { ensureCameraPermission } from './permissions.js';

export async function captureBillPhoto() {
  const perm = await ensureCameraPermission();
  if (!perm.granted) {
    return { ok: false, errorType: 'permission_denied', ...perm };
  }

  if (isCapacitorNative()) {
    const cam = getPlugin('NativeCamera');
    if (cam?.openCamera) {
      try {
        const res = await cam.openCamera();
        if (res?.cancelled) return { ok: false, cancelled: true };
        if (res?.imageUri || res?.dataUrl) {
          return {
            ok: true,
            imageUri: res.imageUri || res.dataUrl,
            autoCorrected: Boolean(res.autoCorrected),
            documentDetected: Boolean(res.documentDetected)
          };
        }
      } catch (err) {
        return {
          ok: false,
          errorType: 'camera_unavailable',
          message: err?.message || 'Camera is currently unavailable on this device.'
        };
      }
    }
  }

  // Web browser fallback using getUserMedia
  return { ok: false, useWebCamera: true };
}

export function createThumbnailDataUrl(imageSrc, maxDim = 220) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = toWebSrc(imageSrc);
  });
}
