import { getPlugin, isCapacitorNative } from './utils.js';

export async function runOcrOnImage(imageUri) {
  if (!imageUri) {
    return { ok: false, error: 'No image provided for OCR.' };
  }

  if (isCapacitorNative()) {
    const ocr = getPlugin('NativeOcr');
    if (ocr?.recognizeText) {
      try {
        const res = await ocr.recognizeText({ imageUri });
        if (res && typeof res.text === 'string' && res.text.trim().length > 0) {
          return {
            ok: true,
            text: res.text,
            language: res.detectedLanguage || 'und',
            confidence: typeof res.confidence === 'number' ? res.confidence : 0.85,
            blocks: Array.isArray(res.blocks) ? res.blocks : []
          };
        }
        return { ok: false, error: 'No readable text was detected in this image.' };
      } catch {
        return { ok: false, error: 'Could not read text from the image. Try a clearer photo.' };
      }
    }
  }

  // Browser fallback: if running in web dev mode without native ML Kit,
  // check if user pasted OCR text or return clear message.
  return {
    ok: false,
    error: 'On-device ML Kit OCR requires the Android build. Use "Paste Bill Text" in OCR Inspector for web testing.'
  };
}

export function extractOcrTokens(rawText) {
  const text = String(rawText || '');
  const numbers = text.match(/(?:৳|BDT|\$|€|£|₹|AED|SAR|RM)?\s*[0-9০-৯]{1,3}(?:,[0-9০-৯]{2,3})*(?:\.[0-9০-৯]{1,2})?/g) || [];
  const dates = text.match(/\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})\b/gi) || [];
  return {
    numbers: [...new Set(numbers.map((s) => s.trim()))].slice(0, 24),
    dates: [...new Set(dates.map((s) => s.trim()))].slice(0, 10)
  };
}
