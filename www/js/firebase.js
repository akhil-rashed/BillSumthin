import { getPlugin, isCapacitorNative } from './utils.js';

// Client-side Firebase configuration (public identifiers only; no AI secrets)
export const FIREBASE_CONFIG = {
  projectId: 'billsumthin',
  projectNumber: '646755991934',
  storageBucket: 'billsumthin.firebasestorage.app',
  cloudFunctionUrl: 'https://us-central1-billsumthin.cloudfunctions.net/analyzeBill'
};

export async function getAuthState() {
  if (isCapacitorNative()) {
    const plugin = getPlugin('NativeFirebase');
    if (plugin?.getAuthState) {
      try {
        return await plugin.getAuthState();
      } catch {
        return { signedIn: false, uid: null };
      }
    }
  }
  return { signedIn: false, uid: null };
}

export async function signInAnonymouslyIfNeeded() {
  if (!navigator.onLine) return { signedIn: false, uid: null };
  const plugin = getPlugin('NativeFirebase');
  if (plugin?.signInAnonymously) {
    try {
      return await plugin.signInAnonymously();
    } catch {
      return { signedIn: false, uid: null };
    }
  }
  return { signedIn: false, uid: null };
}

export async function syncBillToCloud(bill, cloudSyncEnabled) {
  if (!cloudSyncEnabled || !navigator.onLine) return { synced: false, reason: 'offline_or_disabled' };
  const plugin = getPlugin('NativeFirebase');
  if (plugin?.saveBill) {
    try {
      const sanitized = { ...bill };
      delete sanitized.rawOcrText;
      return await plugin.saveBill({ billJson: JSON.stringify(sanitized) });
    } catch {
      return { synced: false, reason: 'firebase_unavailable' };
    }
  }
  return { synced: false, reason: 'web_local_only' };
}

export async function deleteAllCloudBills(cloudSyncEnabled) {
  if (!cloudSyncEnabled || !navigator.onLine) return { deleted: false };
  const plugin = getPlugin('NativeFirebase');
  if (plugin?.clearUserBills) {
    try {
      return await plugin.clearUserBills();
    } catch {
      return { deleted: false };
    }
  }
  return { deleted: false };
}

async function callDirectGeminiWithUserKey(ocrText, ocrLanguage, preferredCurrency, apiKey) {
  const prompt = [
    'Extract structured bill data from the OCR text below.',
    'Rules:',
    '- NEVER invent or guess missing totals, dates, providers, or account numbers.',
    '- Use null for any field not clearly present in the text.',
    '- Distinguish subtotal, tax/VAT, fees, discount, amountDue, and total carefully.',
    '- Treat ৳ and BDT as currency "BDT". Never confuse ৳ with $, €, £, or ₹.',
    `- Fallback currency if none visible: ${preferredCurrency}.`,
    `- OCR language hint: ${ocrLanguage}.`,
    'Return ONLY valid JSON matching this schema:',
    '{"documentType":"...","provider":"...","currency":"BDT","billingPeriod":{"start":null,"end":null},"issueDate":null,"dueDate":null,"items":[{"name":"...","quantity":1,"unitPrice":0,"amount":0}],"subtotal":null,"tax":null,"fees":null,"discount":null,"total":null,"amountDue":null,"confidence":0.85,"warnings":[]}',
    '',
    'OCR TEXT:',
    String(ocrText || '').slice(0, 12000)
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const rawJson = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) return null;
    const parsed = JSON.parse(rawJson);
    return parsed && typeof parsed === 'object' && parsed.documentType ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function callSecureAiAnalyzer(ocrText, ocrLanguage, preferredCurrency, localApiKey = '') {
  if (!navigator.onLine) return null;

  // If user configured their own personal Gemini API key in Settings (stored locally on-device)
  if (localApiKey && localApiKey.trim().length > 10) {
    const direct = await callDirectGeminiWithUserKey(ocrText, ocrLanguage, preferredCurrency, localApiKey);
    if (direct) return direct;
  }

  try {
    const auth = await getAuthState();
    const headers = { 'Content-Type': 'application/json' };
    if (auth?.idToken) {
      headers.Authorization = `Bearer ${auth.idToken}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    const res = await fetch(FIREBASE_CONFIG.cloudFunctionUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        ocrText,
        ocrLanguage,
        preferredCurrency
      })
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object' || !data.documentType) return null;
    return data;
  } catch {
    return null;
  }
}
